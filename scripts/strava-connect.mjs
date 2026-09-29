#!/usr/bin/env node
/**
 * One-time Strava connection for a single athlete (you).
 *
 * The full product design does this in-app through an Edge Function with an
 * OAuth state table. That is what many users need. For one athlete it is faster
 * and no less safe to authorize once from a terminal: the tokens still end up
 * encrypted in private.strava_connections, and the client secret never enters
 * the app bundle.
 *
 * Usage:
 *   node scripts/strava-connect.mjs                 # prints the authorize URL
 *   node scripts/strava-connect.mjs <code|url>      # exchanges and stores it
 *
 * Required environment (a local .env is read automatically):
 *   STRAVA_CLIENT_ID, STRAVA_CLIENT_SECRET, STRAVA_TOKEN_ENCRYPTION_KEY,
 *   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, HOTROCKS_ATHLETE_EMAIL
 *
 * Generate a key with:
 *   node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
 */

import { createCipheriv, randomBytes } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { createInterface } from 'node:readline';

const REDIRECT_URI = 'http://localhost/strava-connected';
const SCOPE = 'activity:write';
const KEY_GENERATION_HINT =
  `  node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`;

function loadDotEnv() {
  // `.env.scripts` is read first and is the right home for server-only values
  // such as SUPABASE_SERVICE_ROLE_KEY: unlike `.env`, Expo never loads it.
  for (const file of ['.env.scripts', '.env.local', '.env']) {
    let contents;
    try {
      contents = readFileSync(file, 'utf8');
    } catch {
      continue;
    }
    for (const line of contents.split(/\r?\n/)) {
      const match = /^\s*([A-Z0-9_]+)\s*=\s*(.*)$/.exec(line);
      if (!match) continue;
      const value = match[2].trim().replace(/^["']|["']$/g, '');
      // A real environment variable always wins over the file.
      if (!(match[1] in process.env)) process.env[match[1]] = value;
    }
  }
}

function requireEnv(name) {
  const value = process.env[name];
  if (!value) {
    console.error(`Missing ${name}. See the comment at the top of this script.`);
    process.exit(1);
  }
  return value;
}

/**
 * Fails before the authorization code is spent. A code is single-use, so a bad
 * key discovered after the exchange would cost a fresh trip to the browser.
 */
function requireEncryptionKey() {
  const keyBase64 = requireEnv('STRAVA_TOKEN_ENCRYPTION_KEY');
  if (Buffer.from(keyBase64, 'base64').byteLength !== 32) {
    console.error('STRAVA_TOKEN_ENCRYPTION_KEY must be 32 bytes, base64 encoded.');
    console.error('Generate one with:');
    console.error(KEY_GENERATION_HINT);
    process.exit(1);
  }
  return keyBase64;
}

/** AES-GCM with the nonce prepended, matching the post-to-strava function. */
function encryptToken(plaintext, keyBase64) {
  const key = Buffer.from(keyBase64, 'base64');
  const nonce = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, nonce);
  const sealed = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  return Buffer.concat([nonce, sealed, cipher.getAuthTag()]).toString('base64');
}

function printAuthorizeUrl(clientId) {
  const url = new URL('https://www.strava.com/oauth/authorize');
  url.searchParams.set('client_id', clientId);
  url.searchParams.set('redirect_uri', REDIRECT_URI);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('approval_prompt', 'force');
  url.searchParams.set('scope', SCOPE);

  console.log('\n1. Open this URL and approve access:\n');
  console.log(url.toString());
  console.log(`\n2. The browser will fail to load ${REDIRECT_URI} - that is expected.`);
  console.log('   Copy the whole address bar, then run:\n');
  console.log('   node scripts/strava-connect.mjs "<paste the URL here>"\n');
}

/** Accepts a bare code or the full redirected URL. */
function extractCode(argument) {
  if (!argument.includes('://')) return argument.trim();
  const code = new URL(argument).searchParams.get('code');
  if (!code) {
    console.error('That URL has no ?code= parameter. Approve access again.');
    process.exit(1);
  }
  return code;
}

async function findAthleteUserId(supabaseUrl, serviceRoleKey, email) {
  const response = await fetch(
    `${supabaseUrl}/auth/v1/admin/users?per_page=200`,
    { headers: { apikey: serviceRoleKey, Authorization: `Bearer ${serviceRoleKey}` } },
  );
  if (!response.ok) {
    console.error(`Could not list users (HTTP ${response.status}). Check SUPABASE_URL and the service role key.`);
    process.exit(1);
  }
  const { users = [] } = await response.json();
  const match = users.find((user) => user.email?.toLowerCase() === email.toLowerCase());
  if (!match) {
    console.error(`No account found for ${email}. Sign in to HotRocks once first.`);
    process.exit(1);
  }
  return match.id;
}

async function confirm(question) {
  const readline = createInterface({ input: process.stdin, output: process.stdout });
  const answer = await new Promise((resolve) => readline.question(`${question} [y/N] `, resolve));
  readline.close();
  return /^y(es)?$/i.test(answer.trim());
}

async function main() {
  loadDotEnv();
  const clientId = requireEnv('STRAVA_CLIENT_ID');
  const argument = process.argv[2];

  if (!argument) {
    printAuthorizeUrl(clientId);
    return;
  }

  const clientSecret = requireEnv('STRAVA_CLIENT_SECRET');
  const encryptionKeyBase64 = requireEncryptionKey();
  // Same value as the app's URL, so either name is accepted.
  if (!process.env.SUPABASE_URL && process.env.EXPO_PUBLIC_SUPABASE_URL) {
    process.env.SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
  }
  const supabaseUrl = requireEnv('SUPABASE_URL').replace(/\/$/, '');
  const serviceRoleKey = requireEnv('SUPABASE_SERVICE_ROLE_KEY');
  const email = requireEnv('HOTROCKS_ATHLETE_EMAIL');

  const exchange = await fetch('https://www.strava.com/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: 'authorization_code',
      code: extractCode(argument),
    }),
  });

  if (!exchange.ok) {
    console.error(`Strava rejected the code (HTTP ${exchange.status}).`);
    console.error('Authorization codes are single-use, so request a fresh one and retry.');
    process.exit(1);
  }

  const token = await exchange.json();
  const grantedScopes = String(token.scope ?? '').split(/[,\s]+/).filter(Boolean);
  if (!grantedScopes.includes('activity:write')) {
    console.error(`Strava granted "${token.scope}" but activity:write is required to post sessions.`);
    console.error('Strava defaults to read-only scope, which is why the token shown on');
    console.error('strava.com/settings/api cannot create activities. Run this script with no');
    console.error('arguments and approve the request it generates instead.');
    process.exit(1);
  }

  const athleteName = [token.athlete?.firstname, token.athlete?.lastname].filter(Boolean).join(' ');
  console.log(`\nStrava athlete: ${athleteName || token.athlete?.id} (id ${token.athlete?.id})`);
  console.log(`Scopes        : ${grantedScopes.join(', ')}`);
  console.log(`HotRocks user : ${email}`);
  console.log(`Supabase      : ${supabaseUrl}`);
  if (!await confirm('\nStore this connection?')) {
    console.log('Nothing was stored.');
    return;
  }

  const userId = await findAthleteUserId(supabaseUrl, serviceRoleKey, email);
  const stored = await fetch(`${supabaseUrl}/rest/v1/rpc/save_strava_connection`, {
    method: 'POST',
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      p_user_id: userId,
      p_athlete_id: token.athlete?.id,
      p_scopes: grantedScopes,
      p_access_token_ciphertext: encryptToken(token.access_token, encryptionKeyBase64),
      p_refresh_token_ciphertext: encryptToken(token.refresh_token, encryptionKeyBase64),
      p_expires_at: new Date(token.expires_at * 1000).toISOString(),
    }),
  });

  if (!stored.ok) {
    console.error(`Could not store the connection (HTTP ${stored.status}): ${await stored.text()}`);
    process.exit(1);
  }

  console.log('\nConnected. Post a session from its screen in the app.');
  console.log('The tokens are encrypted in private.strava_connections; this terminal holds none of them.');
}

await main();
