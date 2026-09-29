import '@supabase/functions-js/edge-runtime.d.ts';
import { withSupabase } from '@supabase/server';

import {
  encryptToken,
  exchangeAuthorizationCode,
  parseScopes,
  STRAVA_REQUIRED_SCOPE,
} from '../_shared/strava-tokens.ts';

/**
 * Receives Strava's redirect after an athlete approves access.
 *
 * Strava calls this with no JWT, so it runs without user auth. The single-use
 * state nonce created by `strava-authorize` is the only thing that says whose
 * connection this is, and consuming it is an atomic claim, so a captured
 * redirect cannot be replayed or aimed at another account.
 *
 * It answers with a small page rather than a redirect into the app, because the
 * app cannot be reached by a custom scheme from Expo Go. The app notices the
 * connection when the browser closes and it re-reads its status.
 */

function page(title: string, detail: string, tone: 'ok' | 'error'): Response {
  const accent = tone === 'ok' ? '#208AEF' : '#B3412C';
  return new Response(
    `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title}</title>
<style>
  :root { color-scheme: light dark; }
  body {
    margin: 0; min-height: 100vh; display: grid; place-items: center;
    padding: 24px; background: Canvas; color: CanvasText;
    font: 16px/1.5 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  }
  main { max-width: 22rem; text-align: center; }
  h1 { font-size: 1.4rem; margin: 0 0 .5rem; color: ${accent}; }
  p { margin: 0; opacity: .8; }
</style>
</head>
<body><main><h1>${title}</h1><p>${detail}</p></main></body>
</html>`,
    { status: tone === 'ok' ? 200 : 400, headers: { 'Content-Type': 'text/html; charset=utf-8' } },
  );
}

export default {
  // No user auth: this request comes from Strava, not from the app. The state
  // nonce is the authentication.
  fetch: withSupabase({ auth: 'none' }, async (req, ctx) => {
    const url = new URL(req.url);
    const code = url.searchParams.get('code');
    const state = url.searchParams.get('state');
    const denied = url.searchParams.get('error');

    if (denied) {
      return page('Not connected', 'Strava access was declined. You can close this and try again.', 'error');
    }
    if (!code || !state) {
      return page('Something is missing', 'That link is incomplete. Start again from HotRocks.', 'error');
    }

    const { data: userId, error: stateError } = await ctx.supabaseAdmin
      .rpc('consume_strava_oauth_state', { p_state: state });
    if (stateError) throw stateError;
    if (!userId) {
      return page('This link has expired', 'Start connecting again from HotRocks.', 'error');
    }

    const token = await exchangeAuthorizationCode(code);
    const scopes = parseScopes(token.scope);
    if (!scopes.includes(STRAVA_REQUIRED_SCOPE)) {
      return page(
        'Permission missing',
        'HotRocks needs permission to add activities. Try again and leave that box ticked.',
        'error',
      );
    }
    if (!token.athlete?.id) {
      return page('Something went wrong', 'Strava did not identify the athlete. Try again.', 'error');
    }

    const { error: saveError } = await ctx.supabaseAdmin.rpc('save_strava_connection', {
      p_user_id: userId,
      p_athlete_id: token.athlete.id,
      p_scopes: scopes,
      p_access_token_ciphertext: await encryptToken(token.access_token),
      p_refresh_token_ciphertext: await encryptToken(token.refresh_token),
      p_expires_at: new Date(token.expires_at * 1000).toISOString(),
    });
    if (saveError) throw saveError;

    const name = [token.athlete.firstname, token.athlete.lastname].filter(Boolean).join(' ');
    return page(
      'Strava connected',
      `${name || 'Your account'} is connected. Return to HotRocks and post a session.`,
      'ok',
    );
  }),
};
