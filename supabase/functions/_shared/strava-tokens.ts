/**
 * Strava token handling shared by the connect callback and the poster.
 *
 * Tokens are AES-GCM sealed with the nonce prepended, and only ever exist in
 * plaintext inside a function invocation. The app is never given them, and
 * Postgres only stores the ciphertext, so the key never reaches the database.
 */

export const STRAVA_TOKEN_URL = 'https://www.strava.com/oauth/token';
export const STRAVA_ACTIVITIES_URL = 'https://www.strava.com/api/v3/activities';
export const STRAVA_AUTHORIZE_URL = 'https://www.strava.com/oauth/authorize';
/** Writing activities is the only scope HotRocks needs. */
export const STRAVA_REQUIRED_SCOPE = 'activity:write';

export type StravaTokenResponse = {
  access_token: string;
  refresh_token: string;
  expires_at: number;
  scope?: string;
  athlete?: { id?: number; firstname?: string; lastname?: string };
};

export function requireEnv(name: string): string {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`${name} is not configured.`);
  return value;
}

async function encryptionKey(): Promise<CryptoKey> {
  const raw = Uint8Array.from(
    atob(requireEnv('STRAVA_TOKEN_ENCRYPTION_KEY')),
    (character) => character.charCodeAt(0),
  );
  if (raw.byteLength !== 32) {
    throw new Error('STRAVA_TOKEN_ENCRYPTION_KEY must be 32 bytes, base64 encoded.');
  }
  return await crypto.subtle.importKey('raw', raw, 'AES-GCM', false, ['encrypt', 'decrypt']);
}

export async function encryptToken(plaintext: string): Promise<string> {
  const nonce = crypto.getRandomValues(new Uint8Array(12));
  const sealed = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: nonce },
    await encryptionKey(),
    new TextEncoder().encode(plaintext),
  );
  const packed = new Uint8Array(nonce.byteLength + sealed.byteLength);
  packed.set(nonce, 0);
  packed.set(new Uint8Array(sealed), nonce.byteLength);
  return btoa(String.fromCharCode(...packed));
}

export async function decryptToken(base64: string): Promise<string> {
  const packed = Uint8Array.from(atob(base64), (character) => character.charCodeAt(0));
  const opened = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: packed.subarray(0, 12) },
    await encryptionKey(),
    packed.subarray(12),
  );
  return new TextDecoder().decode(opened);
}

/** Strava returns scopes comma- or space-delimited depending on the endpoint. */
export function parseScopes(scope: string | undefined): string[] {
  return String(scope ?? '').split(/[,\s]+/).filter(Boolean);
}

async function postToken(body: Record<string, string>): Promise<StravaTokenResponse> {
  const response = await fetch(STRAVA_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: requireEnv('STRAVA_CLIENT_ID'),
      client_secret: requireEnv('STRAVA_CLIENT_SECRET'),
      ...body,
    }),
  });
  if (!response.ok) {
    // The response can echo the request, including the client secret, so the
    // body is deliberately not propagated.
    throw new Error(`strava_token_failed_${response.status}`);
  }
  return await response.json() as StravaTokenResponse;
}

export function exchangeAuthorizationCode(code: string): Promise<StravaTokenResponse> {
  return postToken({ grant_type: 'authorization_code', code });
}

export function refreshAccessToken(refreshToken: string): Promise<StravaTokenResponse> {
  return postToken({ grant_type: 'refresh_token', refresh_token: refreshToken });
}
