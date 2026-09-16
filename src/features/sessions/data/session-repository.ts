import { and, eq, isNull, sql } from 'drizzle-orm';
import { ulid } from 'ulid';

import { calculateSessionTotals, sessionDraftSchema, type SessionDraft } from '../domain/session';
import { database } from '@/services/database/client';
import { roundParts, rounds, sessionPhotos, sessions, syncOutbox, venues } from '@/services/database/schema';
import { requestSync } from '@/services/sync/sync-engine';

export type SaveSessionInput = SessionDraft & {
  userId: string;
  timezoneName: string;
  entryMethod?: 'manual' | 'timer' | 'repeat';
};

/** Writes the complete session aggregate and its durable upload operation atomically. */
export async function saveSession(input: SaveSessionInput): Promise<string> {
  const draft = sessionDraftSchema.parse(input);
  const totals = calculateSessionTotals(draft);
  const now = new Date().toISOString();

  database.transaction((tx) => {
    let venueId: string | null = null;

    if (draft.venueName) {
      const existing = tx
        .select({ id: venues.id })
        .from(venues)
        .where(and(
          eq(venues.userId, input.userId),
          isNull(venues.deletedAt),
          sql`lower(${venues.name}) = lower(${draft.venueName})`,
        ))
        .limit(1)
        .get();
      venueId = existing?.id ?? ulid();

      if (existing) {
        tx.update(venues)
          .set({ name: draft.venueName, lastUsedAt: now, updatedAt: now })
          .where(eq(venues.id, venueId))
          .run();
      } else {
        tx.insert(venues).values({
          id: venueId,
          userId: input.userId,
          name: draft.venueName,
          lastUsedAt: now,
          createdAt: now,
          updatedAt: now,
          deletedAt: null,
        }).run();
      }
    }

    const endedAt = new Date(new Date(draft.startedAt).getTime() + totals.elapsedSeconds * 1000).toISOString();
    tx.insert(sessions).values({
      id: draft.id,
      userId: input.userId,
      venueId,
      venueNameSnapshot: draft.venueName,
      startedAt: draft.startedAt,
      endedAt,
      timezoneName: input.timezoneName,
      elapsedSeconds: totals.elapsedSeconds,
      heatSeconds: totals.heatSeconds,
      coldSeconds: totals.coldSeconds,
      roundCount: totals.roundCount,
      rating: draft.rating,
      note: draft.note,
      entryMethod: input.entryMethod ?? 'manual',
      revision: 0,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    }).run();

    for (const [roundPosition, round] of draft.rounds.entries()) {
      tx.insert(rounds).values({
        id: round.id,
        userId: input.userId,
        sessionId: draft.id,
        position: roundPosition,
        createdAt: now,
        updatedAt: now,
      }).run();

      for (const [partPosition, part] of round.parts.entries()) {
        tx.insert(roundParts).values({
          id: part.id,
          userId: input.userId,
          sessionId: draft.id,
          roundId: round.id,
          position: partPosition,
          kind: part.kind,
          durationSeconds: part.durationSeconds,
          temperatureCTenths: part.temperatureCTenths,
          startedAt: null,
          endedAt: null,
          createdAt: now,
          updatedAt: now,
        }).run();
      }
    }

    const payload = JSON.stringify({
      schemaVersion: 1,
      baseRevision: 0,
      venue: venueId && draft.venueName ? { id: venueId, name: draft.venueName, lastUsedAt: now } : null,
      session: {
        id: draft.id,
        venueId,
        venueNameSnapshot: draft.venueName,
        startedAt: draft.startedAt,
        endedAt,
        timezoneName: input.timezoneName,
        elapsedSeconds: totals.elapsedSeconds,
        heatSeconds: totals.heatSeconds,
        coldSeconds: totals.coldSeconds,
        roundCount: totals.roundCount,
        rating: draft.rating,
        note: draft.note,
        entryMethod: input.entryMethod ?? 'manual',
        createdAt: now,
        updatedAt: now,
      },
      rounds: draft.rounds,
    });

    tx.insert(syncOutbox).values({
      id: ulid(),
      userId: input.userId,
      aggregateType: 'session',
      aggregateId: draft.id,
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
  });

  void requestSync(input.userId);
  return draft.id;
}

/** Hides a session immediately and queues a tombstone for the cloud. */
export async function softDeleteSession(sessionId: string, userId: string): Promise<void> {
  const now = new Date().toISOString();
  const current = database
    .select({ revision: sessions.revision })
    .from(sessions)
    .where(and(eq(sessions.id, sessionId), eq(sessions.userId, userId)))
    .get();
  const payload = JSON.stringify({
    schemaVersion: 1,
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
      id: ulid(),
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

  void requestSync(userId);
}
