import {
  buildStravaActivityText,
  DEFAULT_STRAVA_SPORT_TYPE,
} from './strava-activity-text';
import { stravaExportStorage } from '../storage/strava-export-storage';
import type { SessionTimelineTotals } from '@/features/sessions/types/session-types';
import type { TemperatureUnit } from '@/lib/format';
import { getSupabaseClient } from '@/services/supabase/client';
import { requestSync } from '@/services/sync/sync-engine';

/**
 * Posts a saved session to the athlete's Strava account.
 *
 * The app never holds a Strava token: it renders the activity text and asks the
 * `post-to-strava` Edge Function to do the rest. The session must already exist
 * in Supabase, so this pushes any queued work first.
 */

export type StravaPostFailure =
  | 'not_connected'
  | 'missing_scope'
  | 'not_synced'
  | 'strava_rejected'
  | 'not_deployed'
  | 'server_error'
  | 'offline'
  | 'unknown';

/** Thrown with a reason a screen can turn into a specific message. */
export class StravaPostError extends Error {
  readonly reason: StravaPostFailure;

  constructor(reason: StravaPostFailure, message: string) {
    super(message);
    this.name = 'StravaPostError';
    this.reason = reason;
  }
}

export const stravaPostMessages: Record<StravaPostFailure, string> = {
  not_connected: 'Connect Strava before posting a session.',
  missing_scope: 'Reconnect Strava and allow it to add activities.',
  not_synced: 'This session has not reached the cloud yet. Try again in a moment.',
  strava_rejected: 'Strava would not accept this session. Try again later.',
  not_deployed: 'Strava posting is not available on this project yet.',
  server_error: 'Posting to Strava failed on the server. Try again.',
  offline: 'Check your internet connection and try again.',
  unknown: 'Could not post to Strava. Try again.',
};

type PostToStravaInput = {
  sessionId: string;
  userId: string;
  venueName: string | null;
  totals: SessionTimelineTotals;
  note: string | null;
  temperatureUnit: TemperatureUnit;
};

type PostToStravaResponse = {
  stravaActivityId?: number;
  postedAt?: string;
  alreadyPosted?: boolean;
  code?: string;
};

function isOffline(error: unknown): boolean {
  return error instanceof Error
    && /failed to fetch|network request failed|network error/i.test(error.message);
}

type FunctionErrorDetail = { status: number | null; code: string | null };

/**
 * Reads why the function refused.
 *
 * `functions.invoke` does not parse a non-2xx body into `data`: it returns the
 * raw Response on `error.context`. Reading the body from there is the only way
 * to tell "not connected" from "Strava is unhappy", so without this every
 * failure looks identical.
 */
async function readFunctionError(error: unknown): Promise<FunctionErrorDetail> {
  const context = (error as { context?: unknown }).context;
  if (!(context instanceof Response)) return { status: null, code: null };
  try {
    const body = await context.clone().json() as { code?: unknown };
    return {
      status: context.status,
      code: typeof body.code === 'string' ? body.code : null,
    };
  } catch {
    return { status: context.status, code: null };
  }
}

function reasonFor({ status, code }: FunctionErrorDetail, error: unknown): StravaPostFailure {
  switch (code) {
    case 'not_connected':
    case 'missing_scope':
    case 'strava_rejected':
      return code;
    case 'session_not_found':
      return 'not_synced';
    default:
      break;
  }
  if (status === 404) return 'not_deployed';
  if (status !== null && status >= 500) return 'server_error';
  if (isOffline(error)) return 'offline';
  return 'unknown';
}

/** Posts the session and records the result so the screen reflects it at once. */
async function post(input: PostToStravaInput): Promise<number> {
  const { name, description } = buildStravaActivityText(input);

  // A session queued only on this device cannot be read by the function, so
  // give the outbox a chance to drain before asking.
  await requestSync(input.userId).catch(() => undefined);

  stravaExportStorage.markPosting(input.sessionId, input.userId);

  let response;
  try {
    response = await getSupabaseClient().functions.invoke<PostToStravaResponse>('post-to-strava', {
      body: { sessionId: input.sessionId, name, description, sportType: DEFAULT_STRAVA_SPORT_TYPE },
    });
  } catch (error) {
    stravaExportStorage.markFailed(input.sessionId, input.userId, 'invoke_failed');
    throw new StravaPostError(isOffline(error) ? 'offline' : 'unknown', stravaPostMessages.unknown);
  }

  const { data, error } = response;
  if (error) {
    const detail = await readFunctionError(error);
    const reason = reasonFor(detail, error);
    if (__DEV__) {
      console.error('post-to-strava refused', {
        status: detail.status,
        code: detail.code,
        reason,
      });
    }
    stravaExportStorage.markFailed(
      input.sessionId,
      input.userId,
      detail.code ?? `http_${detail.status ?? 'unknown'}`,
    );
    throw new StravaPostError(reason, stravaPostMessages[reason]);
  }

  const activityId = data?.stravaActivityId;
  if (typeof activityId !== 'number') {
    stravaExportStorage.markFailed(input.sessionId, input.userId, 'missing_activity_id');
    throw new StravaPostError('unknown', stravaPostMessages.unknown);
  }

  stravaExportStorage.markPosted(input.sessionId, input.userId, activityId, data?.postedAt);
  return activityId;
}

export const stravaExportService = { post };
