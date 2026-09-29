import '@supabase/functions-js/edge-runtime.d.ts';
import { withSupabase } from '@supabase/server';

/**
 * Posts one saved session to the signed-in athlete's Strava account.
 *
 * The client sends the session ID and the activity text it rendered; this
 * function owns everything the app is not allowed to hold: the client secret,
 * the refresh token, and the decryption key. The athlete is taken from the JWT,
 * never from the request body, so a caller can only post their own sessions.
 */

const STRAVA_TOKEN_URL = 'https://www.strava.com/oauth/token';
const STRAVA_ACTIVITIES_URL = 'https://www.strava.com/api/v3/activities';
/** Refresh early so a slow request cannot run past the expiry mid-flight. */
const EXPIRY_MARGIN_SECONDS = 120;

type StravaTokenResponse = {
  access_token: string;
  refresh_token: string;
  expires_at: number;
};

function requireEnv(name: string): string {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`${name} is not configured.`);
  return value;
}

async function encryptionKey(): Promise<CryptoKey> {
  const raw = Uint8Array.from(atob(requireEnv('STRAVA_TOKEN_ENCRYPTION_KEY')), (c) => c.charCodeAt(0));
  if (raw.byteLength !== 32) {
    throw new Error('STRAVA_TOKEN_ENCRYPTION_KEY must be 32 bytes, base64 encoded.');
  }
  return crypto.subtle.importKey('raw', raw, 'AES-GCM', false, ['encrypt', 'decrypt']);
}

/** AES-GCM with the 12-byte nonce prepended to the ciphertext. */
async function encryptToken(plaintext: string): Promise<string> {
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

async function decryptToken(base64: string): Promise<string> {
  const packed = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
  const opened = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: packed.subarray(0, 12) },
    await encryptionKey(),
    packed.subarray(12),
  );
  return new TextDecoder().decode(opened);
}

async function refreshAccessToken(refreshToken: string): Promise<StravaTokenResponse> {
  const response = await fetch(STRAVA_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: requireEnv('STRAVA_CLIENT_ID'),
      client_secret: requireEnv('STRAVA_CLIENT_SECRET'),
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    }),
  });
  if (!response.ok) {
    // The body can carry the client secret back in an error echo, so it is
    // deliberately not forwarded to the app.
    throw new Error(`strava_refresh_failed_${response.status}`);
  }
  return await response.json() as StravaTokenResponse;
}

export default {
  fetch: withSupabase({ auth: 'user' }, async (req, ctx) => {
    if (req.method !== 'POST') {
      return Response.json({ message: 'Method not allowed.' }, { status: 405 });
    }

    const userId = ctx.userClaims?.id;
    if (!userId) {
      return Response.json({ message: 'User identity is missing.' }, { status: 401 });
    }

    const body = await req.json().catch(() => null);
    const sessionId = typeof body?.sessionId === 'string' ? body.sessionId : null;
    const name = typeof body?.name === 'string' ? body.name.trim().slice(0, 255) : '';
    const description = typeof body?.description === 'string' ? body.description.slice(0, 4000) : '';
    const sportType = typeof body?.sportType === 'string' ? body.sportType : 'Workout';
    if (!sessionId || !name) {
      return Response.json({ message: 'A session and activity name are required.' }, { status: 400 });
    }

    // Read through the caller's own client so RLS proves ownership; a session
    // belonging to somebody else simply is not found.
    const { data: session, error: sessionError } = await ctx.supabase
      .from('sessions')
      .select('id, started_at, elapsed_seconds, deleted_at')
      .eq('id', sessionId)
      .is('deleted_at', null)
      .maybeSingle();
    if (sessionError) throw sessionError;
    if (!session) {
      return Response.json(
        { code: 'session_not_found', message: 'That session is not available to post.' },
        { status: 404 },
      );
    }

    const { data: existing, error: existingError } = await ctx.supabase
      .from('strava_exports')
      .select('strava_activity_id, status')
      .eq('session_id', sessionId)
      .maybeSingle();
    if (existingError) throw existingError;
    if (existing?.strava_activity_id) {
      // Idempotent: posting twice must not create a second Strava activity.
      return Response.json({ alreadyPosted: true, stravaActivityId: existing.strava_activity_id });
    }

    const { data: connections, error: connectionError } = await ctx.supabaseAdmin
      .rpc('get_strava_connection', { p_user_id: userId });
    if (connectionError) throw connectionError;
    const connection = connections?.[0];
    if (!connection) {
      return Response.json(
        { code: 'not_connected', message: 'Connect Strava before posting a session.' },
        { status: 409 },
      );
    }
    if (!connection.scopes?.includes('activity:write')) {
      return Response.json(
        { code: 'missing_scope', message: 'Reconnect Strava and allow it to add activities.' },
        { status: 409 },
      );
    }

    let accessToken = await decryptToken(connection.access_token_ciphertext);
    const expiresAt = Date.parse(connection.expires_at) / 1000;
    if (!Number.isFinite(expiresAt) || expiresAt - EXPIRY_MARGIN_SECONDS <= Date.now() / 1000) {
      const refreshed = await refreshAccessToken(await decryptToken(connection.refresh_token_ciphertext));
      accessToken = refreshed.access_token;
      const { error: rotateError } = await ctx.supabaseAdmin.rpc('rotate_strava_tokens', {
        p_user_id: userId,
        p_access_token_ciphertext: await encryptToken(refreshed.access_token),
        p_refresh_token_ciphertext: await encryptToken(refreshed.refresh_token),
        p_expires_at: new Date(refreshed.expires_at * 1000).toISOString(),
      });
      if (rotateError) throw rotateError;
    }

    const created = await fetch(STRAVA_ACTIVITIES_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        name,
        sport_type: sportType,
        start_date_local: new Date(session.started_at).toISOString(),
        elapsed_time: String(session.elapsed_seconds),
        ...(description ? { description } : {}),
      }),
    });

    if (!created.ok) {
      // Recorded so a failed post is visible in the app rather than silent.
      await ctx.supabaseAdmin.from('strava_exports').upsert({
        id: crypto.randomUUID(),
        user_id: userId,
        session_id: sessionId,
        requested_action: 'post',
        status: created.status === 401 ? 'disconnected' : 'action_required',
        last_error_code: `strava_create_${created.status}`,
      }, { onConflict: 'session_id' });

      return Response.json({
        code: created.status === 401 ? 'not_connected' : 'strava_rejected',
        message: created.status === 401
          ? 'Strava rejected the connection. Connect it again.'
          : 'Strava would not accept this session. Try again later.',
      }, { status: 502 });
    }

    const activity = await created.json() as { id: number };
    const postedAt = new Date().toISOString();
    const { error: exportError } = await ctx.supabaseAdmin.from('strava_exports').upsert({
      id: crypto.randomUUID(),
      user_id: userId,
      session_id: sessionId,
      requested_action: 'post',
      status: 'posted',
      strava_activity_id: activity.id,
      posted_at: postedAt,
      last_error_code: null,
    }, { onConflict: 'session_id' });
    if (exportError) throw exportError;

    return Response.json({ stravaActivityId: activity.id, postedAt });
  }),
};
