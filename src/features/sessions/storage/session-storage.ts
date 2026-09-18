import { and, asc, eq, isNull, sql } from 'drizzle-orm';

import { toSessionInterval } from '../services/session-calculation-service';

import type {
  SaveSessionTimelineInput,
  SessionInterval,
  SessionTimelineTotals,
} from '../types/session-types';
import { createId } from '@/lib/ids';
import { database } from '@/services/database/client';
import {
  sessionDrafts,
  sessionIntervals,
  sessionPhotos,
  sessions,
  syncOutbox,
  venues,
} from '@/services/database/schema';

/** Version of the session aggregate payload understood by `push_session_aggregate`. */
export const SESSION_SYNC_SCHEMA_VERSION = 2;

type SaveTimelineAggregateInput = {
  input: SaveSessionTimelineInput;
  totals: SessionTimelineTotals;
  now: string;
  /** Draft consumed by this save; deleted in the same transaction. */
  draftId?: string;
};

export type StoredSessionTimeline = {
  venueName: string | null;
  intervals: SessionInterval[];
};

/** Internal SQLite operations. Screens must use services/hooks, not this module. */
export const sessionStorage = {
  createDraft(userId: string, payloadJson: string): string {
    const id = createId();
    database.insert(sessionDrafts).values({
      id,
      userId,
      payloadJson,
      updatedAt: new Date().toISOString(),
    }).run();
    return id;
  },

  readDraft(id: string, userId: string): string | null {
    return database.select({ payloadJson: sessionDrafts.payloadJson })
      .from(sessionDrafts)
      .where(and(eq(sessionDrafts.id, id), eq(sessionDrafts.userId, userId)))
      .get()?.payloadJson ?? null;
  },

  updateDraft(id: string, userId: string, payloadJson: string): void {
    database.update(sessionDrafts).set({
      payloadJson,
      updatedAt: new Date().toISOString(),
    }).where(and(eq(sessionDrafts.id, id), eq(sessionDrafts.userId, userId))).run();
  },

  deleteDraft(id: string, userId: string): void {
    database.delete(sessionDrafts)
      .where(and(eq(sessionDrafts.id, id), eq(sessionDrafts.userId, userId)))
      .run();
  },

  /** Reads one owned, non-deleted session timeline, e.g. to repeat it. */
  readSessionTimeline(sessionId: string, userId: string): StoredSessionTimeline | null {
    const session = database.select({ venueName: sessions.venueNameSnapshot })
      .from(sessions)
      .where(and(eq(sessions.id, sessionId), eq(sessions.userId, userId), isNull(sessions.deletedAt)))
      .get();
    if (!session) return null;

    const rows = database.select({
      id: sessionIntervals.id,
      kind: sessionIntervals.kind,
      durationSeconds: sessionIntervals.durationSeconds,
      temperatureCTenths: sessionIntervals.temperatureCTenths,
    }).from(sessionIntervals)
      .where(and(eq(sessionIntervals.sessionId, sessionId), eq(sessionIntervals.userId, userId)))
      .orderBy(asc(sessionIntervals.position))
      .all();

    return {
      venueName: session.venueName,
      intervals: rows.map(toSessionInterval),
    };
  },

  saveTimelineAggregate({ input, totals, now, draftId }: SaveTimelineAggregateInput): void {
    database.transaction((tx) => {
      let venueId: string | null = null;

      if (input.venueName) {
        const existing = tx
          .select({ id: venues.id })
          .from(venues)
          .where(and(
            eq(venues.userId, input.userId),
            isNull(venues.deletedAt),
            sql`lower(${venues.name}) = lower(${input.venueName})`,
          ))
          .limit(1)
          .get();
        venueId = existing?.id ?? createId();

        if (existing) {
          tx.update(venues)
            .set({ name: input.venueName, lastUsedAt: now, updatedAt: now })
            .where(eq(venues.id, venueId))
            .run();
        } else {
          tx.insert(venues).values({
            id: venueId,
            userId: input.userId,
            name: input.venueName,
            lastUsedAt: now,
            createdAt: now,
            updatedAt: now,
            deletedAt: null,
          }).run();
        }
      }

      const endedAt = new Date(
        new Date(input.startedAt).getTime() + totals.elapsedSeconds * 1000,
      ).toISOString();
      tx.insert(sessions).values({
        id: input.id,
        userId: input.userId,
        venueId,
        venueNameSnapshot: input.venueName,
        startedAt: input.startedAt,
        endedAt,
        timezoneName: input.timezoneName,
        elapsedSeconds: totals.elapsedSeconds,
        heatSeconds: totals.heatSeconds,
        coldSeconds: totals.coldSeconds,
        restSeconds: totals.restSeconds,
        intervalCount: totals.intervalCount,
        rating: input.rating,
        note: input.note,
        entryMethod: input.entryMethod,
        revision: 0,
        createdAt: now,
        updatedAt: now,
        deletedAt: null,
      }).run();

      for (const [position, interval] of input.intervals.entries()) {
        tx.insert(sessionIntervals).values({
          id: interval.id,
          userId: input.userId,
          sessionId: input.id,
          position,
          kind: interval.kind,
          durationSeconds: interval.durationSeconds,
          temperatureCTenths: interval.temperatureCTenths,
          startedAt: null,
          endedAt: null,
          createdAt: now,
          updatedAt: now,
        }).run();
      }

      const payload = JSON.stringify({
        schemaVersion: SESSION_SYNC_SCHEMA_VERSION,
        baseRevision: 0,
        venue: venueId && input.venueName
          ? { id: venueId, name: input.venueName, lastUsedAt: now }
          : null,
        session: {
          id: input.id,
          venueId,
          venueNameSnapshot: input.venueName,
          startedAt: input.startedAt,
          endedAt,
          timezoneName: input.timezoneName,
          elapsedSeconds: totals.elapsedSeconds,
          rating: input.rating,
          note: input.note,
          entryMethod: input.entryMethod,
          createdAt: now,
          updatedAt: now,
        },
        intervals: input.intervals.map((interval) => ({
          id: interval.id,
          kind: interval.kind,
          durationSeconds: interval.durationSeconds,
          temperatureCTenths: interval.temperatureCTenths,
        })),
      });

      tx.insert(syncOutbox).values({
        id: createId(),
        userId: input.userId,
        aggregateType: 'session',
        aggregateId: input.id,
        operation: 'upsert',
        payloadJson: payload,
        status: 'pending',
        attemptCount: 0,
        nextAttemptAt: null,
        lastError: null,
        createdAt: now,
        updatedAt: now,
      }).onConflictDoUpdate({
        target: [syncOutbox.userId, syncOutbox.aggregateType, syncOutbox.aggregateId],
        set: {
          operation: 'upsert',
          payloadJson: payload,
          status: 'pending',
          attemptCount: 0,
          nextAttemptAt: null,
          lastError: null,
          updatedAt: now,
        },
      }).run();

      if (draftId) {
        tx.delete(sessionDrafts)
          .where(and(eq(sessionDrafts.id, draftId), eq(sessionDrafts.userId, input.userId)))
          .run();
      }
    });
  },

  softDelete(sessionId: string, userId: string, now: string): void {
    const current = database
      .select({ revision: sessions.revision })
      .from(sessions)
      .where(and(eq(sessions.id, sessionId), eq(sessions.userId, userId)))
      .get();
    const payload = JSON.stringify({
      schemaVersion: SESSION_SYNC_SCHEMA_VERSION,
      baseRevision: current?.revision ?? 0,
      sessionId,
      deletedAt: now,
    });

    database.transaction((tx) => {
      tx.update(sessions)
        .set({ deletedAt: now, updatedAt: now })
        .where(and(eq(sessions.id, sessionId), eq(sessions.userId, userId)))
        .run();
      tx.update(sessionPhotos)
        .set({ deletedAt: now, updatedAt: now })
        .where(and(eq(sessionPhotos.sessionId, sessionId), eq(sessionPhotos.userId, userId)))
        .run();
      tx.insert(syncOutbox).values({
        id: createId(),
        userId,
        aggregateType: 'session',
        aggregateId: sessionId,
        operation: 'delete',
        payloadJson: payload,
        status: 'pending',
        attemptCount: 0,
        nextAttemptAt: null,
        lastError: null,
        createdAt: now,
        updatedAt: now,
      }).onConflictDoUpdate({
        target: [syncOutbox.userId, syncOutbox.aggregateType, syncOutbox.aggregateId],
        set: {
          operation: 'delete',
          payloadJson: payload,
          status: 'pending',
          attemptCount: 0,
          nextAttemptAt: null,
          lastError: null,
          updatedAt: now,
        },
      }).run();
    });
  },
};
