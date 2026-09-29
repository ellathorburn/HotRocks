import '@supabase/functions-js/edge-runtime.d.ts';
import { withSupabase } from '@supabase/server';

import {
  requireEnv,
  STRAVA_AUTHORIZE_URL,
  STRAVA_REQUIRED_SCOPE,
} from '../_shared/strava-tokens.ts';

/**
 * Starts an in-app Strava connection for the signed-in athlete.
 *
 * Returns the URL the app should open in a browser. The athlete is taken from
 * the JWT and recorded against a single-use state nonce, so the callback — which
 * arrives from Strava with no JWT — can still tell whose connection it is. This
 * is why connecting can never attach to the wrong account.
 */

/** Long enough to approve in a browser, short enough that a leaked state is stale. */
const STATE_TTL_SECONDS = 10 * 60;

export default {
  fetch: withSupabase({ auth: 'user' }, async (req, ctx) => {
    if (req.method !== 'POST') {
      return Response.json({ message: 'Method not allowed.' }, { status: 405 });
    }

    const userId = ctx.userClaims?.id;
    if (!userId) {
      return Response.json({ message: 'User identity is missing.' }, { status: 401 });
    }

    // Strava redirects here, not into the app: it validates the redirect host
    // against the configured callback domain, and Expo Go has no stable scheme.
    const redirectUri = `${requireEnv('SUPABASE_URL').replace(/\/$/, '')}/functions/v1/strava-callback`;
    const state = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + STATE_TTL_SECONDS * 1000).toISOString();

    const { error } = await ctx.supabaseAdmin.rpc('create_strava_oauth_state', {
      p_user_id: userId,
      p_state: state,
      p_redirect_uri: redirectUri,
      p_expires_at: expiresAt,
    });
    if (error) throw error;

    const authorizeUrl = new URL(STRAVA_AUTHORIZE_URL);
    authorizeUrl.searchParams.set('client_id', requireEnv('STRAVA_CLIENT_ID'));
    authorizeUrl.searchParams.set('redirect_uri', redirectUri);
    authorizeUrl.searchParams.set('response_type', 'code');
    authorizeUrl.searchParams.set('approval_prompt', 'auto');
    authorizeUrl.searchParams.set('scope', STRAVA_REQUIRED_SCOPE);
    authorizeUrl.searchParams.set('state', state);

    return Response.json({ authorizeUrl: authorizeUrl.toString(), expiresAt });
  }),
};
