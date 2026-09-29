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

/** The subset of a Drizzle transaction these writers use. */
type Transaction = Parameters<Parameters<typeof database.transaction>[0]>[0];

/**
 * Finds or records the venue named by a save, returning the ID the session and
 * its sync payload should reference. A name is matched case-insensitively so
 * "Hot Rocks" and "hot rocks" stay one venue.
 */
function resolveVenue(
  tx: Transaction,
  userId: string,
  venueName: string | null,
  now: string,
): string | null {
  if (!venueName) return null;

  const existing = tx
    .select({ id: venues.id })
    .from(venues)
    .where(and(
      eq(venues.userId, userId),
      isNull(venues.deletedAt),
      sql`lower(${venues.name}) = lower(${venueName})`,
    ))
    .limit(1)
    .get();

  if (existing) {
    tx.update(venues)
      .set({ name: venueName, lastUsedAt: now, updatedAt: now })
      .where(eq(venues.id, existing.id))
      .run();
    return existing.id;
  }

  const id = createId();
  tx.insert(venues).values({
    id,
    userId,
    name: venueName,
    lastUsedAt: now,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
  }).run();
  return id;
}

/**
 * Replaces a session's intervals with the given order. Rewriting rather than
 * diffing keeps positions contiguous under the unique (session, position)
 * index, and matches how the server and the pull path apply an aggregate.
 */
function writeIntervals(
  tx: Transaction,
  input: SaveSessionTimelineInput,
  now: string,
): void {
  tx.delete(sessionIntervals)
    .where(and(
      eq(sessionIntervals.sessionId, input.id),
      eq(sessionIntervals.userId, input.userId),
    ))
    .run();

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
}

function endedAtFor(startedAt: string, elapsedSeconds: number): string {
  return new Date(new Date(startedAt).getTime() + elapsedSeconds * 1000).toISOString();
}

/**
 * Builds the version-two upsert payload. `baseRevision` is the revision the
 * server is expected to hold: 0 for a session it has never seen, and the
 * locally known revision for one it has.
 */
function buildUpsertPayload({
  input,
  totals,
  now,
  venueId,
  baseRevision,
}: {
  input: SaveSessionTimelineInput;
  totals: SessionTimelineTotals;
  now: string;
  venueId: string | null;
  baseRevision: number;
}): string {
  return JSON.stringify({
    schemaVersion: SESSION_SYNC_SCHEMA_VERSION,
    baseRevision,
    venue: venueId && input.venueName
      ? { id: venueId, name: input.venueName, lastUsedAt: now }
      : null,
    session: {
      id: input.id,
      venueId,
      venueNameSnapshot: input.venueName,
      startedAt: input.startedAt,
      endedAt: endedAtFor(input.startedAt, totals.elapsedSeconds),
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
}

/**
 * Queues one durable command per aggregate. The unique key coalesces repeated
 * offline edits into the latest intended state instead of a command per edit.
 */
function queueOutboxCommand(
  tx: Transaction,
  {
    userId,
    aggregateId,
    operation,
    payloadJson,
    now,
  }: {
    userId: string;
    aggregateId: string;
    operation: 'upsert' | 'delete';
    payloadJson: string;
    now: string;
  },
): void {
  tx.insert(syncOutbox).values({
    id: createId(),
    userId,
    aggregateType: 'session',
    aggregateId,
    operation,
    payloadJson,
    status: 'pending',
    attemptCount: 0,
    nextAttemptAt: null,
    lastError: null,
    conflictServerRevision: null,
    createdAt: now,
    updatedAt: now,
  }).onConflictDoUpdate({
    target: [syncOutbox.userId, syncOutbox.aggregateType, syncOutbox.aggregateId],
    set: {
      operation,
      payloadJson,
      status: 'pending',
      attemptCount: 0,
      nextAttemptAt: null,
      lastError: null,
      conflictServerRevision: null,
      updatedAt: now,
    },
  }).run();
}

export type StoredSessionTimeline = {
  venueName: string | null;
  intervals: SessionInterval[];
  startedAt: string;
  elapsedSeconds: number;
  rating: number | null;
  note: string | null;
  entryMethod: SaveSessionTimelineInput['entryMethod'];
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

  /** Reads one owned, non-deleted session timeline, e.g. to repeat or edit it. */
  readSessionTimeline(sessionId: string, userId: string): StoredSessionTimeline | null {
    const session = database.select({
      venueName: sessions.venueNameSnapshot,
      startedAt: sessions.startedAt,
      elapsedSeconds: sessions.elapsedSeconds,
      rating: sessions.rating,
      note: sessions.note,
      entryMethod: sessions.entryMethod,
    })
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
      startedAt: session.startedAt,
      elapsedSeconds: session.elapsedSeconds,
      rating: session.rating,
      note: session.note,
      entryMethod: session.entryMethod,
    };
  },

  saveTimelineAggregate({ input, totals, now, draftId }: SaveTimelineAggregateInput): void {
    database.transaction((tx) => {
      const venueId = resolveVenue(tx, input.userId, input.venueName, now);

      tx.insert(sessions).values({
        id: input.id,
        userId: input.userId,
        venueId,
        venueNameSnapshot: input.venueName,
        startedAt: input.startedAt,
        endedAt: endedAtFor(input.startedAt, totals.elapsedSeconds),
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

      writeIntervals(tx, input, now);
      queueOutboxCommand(tx, {
        userId: input.userId,
        aggregateId: input.id,
        operation: 'upsert',
        payloadJson: buildUpsertPayload({ input, totals, now, venueId, baseRevision: 0 }),
        now,
      });

      if (draftId) {
        tx.delete(sessionDrafts)
          .where(and(eq(sessionDrafts.id, draftId), eq(sessionDrafts.userId, input.userId)))
          .run();
      }
    });
  },

  /**
   * Rewrites an already-saved session in one transaction: the venue, the
   * session row, its whole interval order, the queued command, and the draft
   * the edit was made in. The session keeps its ID, creation time and
   * revision, so the queued command carries that revision as its base and the
   * server can still detect an edit made on another device.
   *
   * Returns false when the session is missing or already deleted, so a stale
   * screen cannot resurrect it.
   */
  updateTimelineAggregate({ input, totals, now, draftId }: SaveTimelineAggregateInput): boolean {
    return database.transaction((tx) => {
      const current = tx
        .select({ revision: sessions.revision })
        .from(sessions)
        .where(and(
          eq(sessions.id, input.id),
          eq(sessions.userId, input.userId),
          isNull(sessions.deletedAt),
        ))
        .get();
      if (!current) return false;

      const venueId = resolveVenue(tx, input.userId, input.venueName, now);

      tx.update(sessions).set({
        venueId,
        venueNameSnapshot: input.venueName,
        startedAt: input.startedAt,
        endedAt: endedAtFor(input.startedAt, totals.elapsedSeconds),
        timezoneName: input.timezoneName,
        elapsedSeconds: totals.elapsedSeconds,
        heatSeconds: totals.heatSeconds,
        coldSeconds: totals.coldSeconds,
        restSeconds: totals.restSeconds,
        intervalCount: totals.intervalCount,
        rating: input.rating,
        note: input.note,
        updatedAt: now,
      }).where(and(eq(sessions.id, input.id), eq(sessions.userId, input.userId))).run();

      writeIntervals(tx, input, now);
      queueOutboxCommand(tx, {
        userId: input.userId,
        aggregateId: input.id,
        operation: 'upsert',
        payloadJson: buildUpsertPayload({
          input,
          totals,
          now,
          venueId,
          baseRevision: current.revision,
        }),
        now,
      });

      if (draftId) {
        tx.delete(sessionDrafts)
          .where(and(eq(sessionDrafts.id, draftId), eq(sessionDrafts.userId, input.userId)))
          .run();
      }

      return true;
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
      queueOutboxCommand(tx, {
        userId,
        aggregateId: sessionId,
        operation: 'delete',
        payloadJson: payload,
        now,
      });
    });
  },
};
