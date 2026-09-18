import { and, asc, count, desc, eq, isNull, max, sql } from 'drizzle-orm';

import { database } from '@/services/database/client';
import {
  sessionDrafts,
  sessionIntervals,
  sessions,
  stravaExports,
  syncOutbox,
  venues,
} from '@/services/database/schema';

const sessionColumns = {
  id: sessions.id,
  venue: sessions.venueNameSnapshot,
  startedAt: sessions.startedAt,
  elapsedSeconds: sessions.elapsedSeconds,
  heatSeconds: sessions.heatSeconds,
  coldSeconds: sessions.coldSeconds,
  restSeconds: sessions.restSeconds,
  intervalCount: sessions.intervalCount,
  rating: sessions.rating,
  note: sessions.note,
};

const intervalColumns = {
  id: sessionIntervals.id,
  sessionId: sessionIntervals.sessionId,
  position: sessionIntervals.position,
  kind: sessionIntervals.kind,
  durationSeconds: sessionIntervals.durationSeconds,
  temperatureCTenths: sessionIntervals.temperatureCTenths,
};

/** Read-only SQLite query builders consumed only by feature hooks. */
export const sessionQueries = {
  sessionsForUser(userId: string) {
    return database.select(sessionColumns).from(sessions)
      .where(and(eq(sessions.userId, userId), isNull(sessions.deletedAt)))
      .orderBy(desc(sessions.startedAt), desc(sessions.id));
  },

  intervalsForUser(userId: string) {
    return database.select(intervalColumns).from(sessionIntervals)
      .where(eq(sessionIntervals.userId, userId))
      .orderBy(asc(sessionIntervals.sessionId), asc(sessionIntervals.position));
  },

  pendingSessionSync(userId: string) {
    return database.select({ aggregateId: syncOutbox.aggregateId })
      .from(syncOutbox)
      .where(and(eq(syncOutbox.userId, userId), eq(syncOutbox.aggregateType, 'session')));
  },

  sessionById(sessionId: string, userId: string) {
    return database.select(sessionColumns).from(sessions)
      .where(and(
        eq(sessions.id, sessionId),
        eq(sessions.userId, userId),
        isNull(sessions.deletedAt),
      ))
      .limit(1);
  },

  intervalsForSession(sessionId: string, userId: string) {
    return database.select(intervalColumns).from(sessionIntervals)
      .where(and(eq(sessionIntervals.sessionId, sessionId), eq(sessionIntervals.userId, userId)))
      .orderBy(asc(sessionIntervals.position));
  },

  stravaExportForSession(sessionId: string, userId: string) {
    return database.select({
      status: stravaExports.status,
      stravaActivityId: stravaExports.stravaActivityId,
    }).from(stravaExports)
      .where(and(eq(stravaExports.sessionId, sessionId), eq(stravaExports.userId, userId)))
      .limit(1);
  },

  pendingSyncForSession(sessionId: string, userId: string) {
    return database.select({ id: syncOutbox.id })
      .from(syncOutbox)
      .where(and(
        eq(syncOutbox.userId, userId),
        eq(syncOutbox.aggregateType, 'session'),
        eq(syncOutbox.aggregateId, sessionId),
      ))
      .limit(1);
  },

  draftPayload(draftId: string, userId: string) {
    return database.select({ payloadJson: sessionDrafts.payloadJson })
      .from(sessionDrafts)
      .where(and(eq(sessionDrafts.id, draftId), eq(sessionDrafts.userId, userId)))
      .limit(1);
  },

  /** Venues with usage derived from the owner's non-deleted sessions. */
  venuesForUser(userId: string) {
    return database.select({
      id: venues.id,
      name: venues.name,
      lastUsedAt: venues.lastUsedAt,
      sessionCount: count(sessions.id),
      heatSeconds: sql<number>`coalesce(sum(${sessions.heatSeconds}), 0)`,
      lastSessionAt: max(sessions.startedAt),
    })
      .from(venues)
      .leftJoin(sessions, and(
        eq(sessions.venueId, venues.id),
        eq(sessions.userId, userId),
        isNull(sessions.deletedAt),
      ))
      .where(and(eq(venues.userId, userId), isNull(venues.deletedAt)))
      .groupBy(venues.id)
      .orderBy(desc(venues.lastUsedAt), asc(venues.name));
  },
};
