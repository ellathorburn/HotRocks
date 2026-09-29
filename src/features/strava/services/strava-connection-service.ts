import * as WebBrowser from 'expo-web-browser';

import { getSupabaseClient } from '@/services/supabase/client';

/**
 * Connecting and disconnecting Strava from inside the app.
 *
 * The app never sees a Strava token or the client secret. It asks an Edge
 * Function for an authorization URL, opens it in a browser, and afterwards
 * re-reads its own connection status. Because the function derives the athlete
 * from the signed-in JWT, the connection always belongs to the account using the
 * app; there is no address to configure and nothing to get out of step.
 */

export type StravaConnection = {
  athleteId: number;
  scopes: string[];
  connectedAt: string;
};

export type StravaConnectOutcome = 'connected' | 'dismissed';

export class StravaConnectError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'StravaConnectError';
  }
}

/** The signed-in athlete's connection, or null. Never includes tokens. */
async function status(): Promise<StravaConnection | null> {
  const { data, error } = await getSupabaseClient().rpc('my_strava_connection');
  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : null;
  if (!row) return null;
  return {
    athleteId: row.athlete_id,
    scopes: row.scopes ?? [],
    connectedAt: row.connected_at,
  };
}

/**
 * Runs the browser authorization. Resolves once the browser closes, which is
 * not proof of success, so the caller confirms by re-reading the status.
 */
async function connect(): Promise<StravaConnectOutcome> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.functions.invoke<{ authorizeUrl?: string }>(
    'strava-authorize',
    { body: {} },
  );
  if (error || !data?.authorizeUrl) {
    throw new StravaConnectError('Could not start the Strava connection. Try again.');
  }

  // The callback lands on an Edge Function rather than the app, so there is no
  // return URL to wait for; dismissing the browser ends the attempt.
  await WebBrowser.openAuthSessionAsync(data.authorizeUrl);

  return (await status()) ? 'connected' : 'dismissed';
}

async function disconnect(): Promise<void> {
  const { error } = await getSupabaseClient().rpc('disconnect_my_strava');
  if (error) throw error;
}

export const stravaConnectionService = { status, connect, disconnect };
