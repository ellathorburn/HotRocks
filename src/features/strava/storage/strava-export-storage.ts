import { and, eq } from 'drizzle-orm';

import { createId } from '@/lib/ids';
import { database } from '@/services/database/client';
import { stravaExports } from '@/services/database/schema';

/**
 * Local record of what happened to a Strava post, so the session screen can
 * show it immediately instead of waiting for a round trip.
 *
 * Supabase holds the durable copy. `strava_exports` is not part of the session
 * sync aggregate, so these rows are written here rather than pulled.
 */

function upsert(
  sessionId: string,
  userId: string,
  values: {
    status: string;
    stravaActivityId?: number | null;
    postedAt?: string | null;
    lastErrorCode?: string | null;
  },
): void {
  const now = new Date().toISOString();
  database.insert(stravaExports).values({
    id: createId(),
    userId,
    sessionId,
    requestedAction: 'post',
    status: values.status,
    stravaActivityId: values.stravaActivityId ?? null,
    payloadSnapshot: null,
    attemptCount: 0,
    nextAttemptAt: null,
    lastErrorCode: values.lastErrorCode ?? null,
    postedAt: values.postedAt ?? null,
    createdAt: now,
    updatedAt: now,
  }).onConflictDoUpdate({
    target: stravaExports.sessionId,
    set: {
      status: values.status,
      stravaActivityId: values.stravaActivityId ?? null,
      lastErrorCode: values.lastErrorCode ?? null,
      postedAt: values.postedAt ?? null,
      updatedAt: now,
    },
  }).run();
}

export const stravaExportStorage = {
  markPosting(sessionId: string, userId: string): void {
    upsert(sessionId, userId, { status: 'posting' });
  },

  markPosted(sessionId: string, userId: string, stravaActivityId: number, postedAt?: string): void {
    upsert(sessionId, userId, {
      status: 'posted',
      stravaActivityId,
      postedAt: postedAt ?? new Date().toISOString(),
    });
  },

  markFailed(sessionId: string, userId: string, errorCode: string): void {
    upsert(sessionId, userId, { status: 'action_required', lastErrorCode: errorCode });
  },

  /** Clears a failed attempt so the screen stops offering to retry a stale error. */
  clear(sessionId: string, userId: string): void {
    database.delete(stravaExports)
      .where(and(eq(stravaExports.sessionId, sessionId), eq(stravaExports.userId, userId)))
      .run();
  },
};
