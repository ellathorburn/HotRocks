import { and, asc, eq, isNull, lt, lte, or } from 'drizzle-orm';
import { z } from 'zod';

import { database } from '@/services/database/client';
import { roundParts, rounds, sessions, syncOutbox, syncState, venues } from '@/services/database/schema';
import { getSupabaseClient, hasSupabaseEnvironment } from '@/services/supabase/client';
import type { Json } from '@/services/supabase/database.types';

const syncResponseSchema = z.discriminatedUnion('status', [
  z.object({ status: z.enum(['applied', 'deleted']), sessionId: z.string(), revision: z.number() }),
  z.object({ status: z.literal('conflict'), sessionId: z.string(), serverRevision: z.number().nullable() }),
]);

const payloadEnvelopeSchema = z.object({
  baseRevision: z.number().int().nonnegative().default(0),
}).passthrough();

const remotePartSchema = z.object({
  id: z.string(),
  position: z.number().int().nonnegative(),
  kind: z.enum(['heat', 'cold']),
  durationSeconds: z.number().int().positive(),
  temperatureCTenths: z.number().int().nullable(),
  startedAt: z.string().nullable(),
  endedAt: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

const remoteRoundSchema = z.object({
  id: z.string(),
  position: z.number().int().nonnegative(),
  createdAt: z.string(),
  updatedAt: z.string(),
  parts: z.array(remotePartSchema),
});

const remoteAggregateSchema = z.object({
  venue: z.object({
    id: z.string(),
    name: z.string(),
    lastUsedAt: z.string().nullable(),
    createdAt: z.string(),
    updatedAt: z.string(),
    deletedAt: z.string().nullable(),
  }).nullable(),
  session: z.object({
    id: z.string(),
    venueId: z.string().nullable(),
    venueNameSnapshot: z.string().nullable(),
    startedAt: z.string(),
    endedAt: z.string().nullable(),
    timezoneName: z.string(),
    elapsedSeconds: z.number().int().positive(),
    heatSeconds: z.number().int().nonnegative(),
    coldSeconds: z.number().int().nonnegative(),
    roundCount: z.number().int().positive(),
    rating: z.number().int().nullable(),
    note: z.string().nullable(),
    entryMethod: z.enum(['manual', 'timer', 'repeat']),
    revision: z.number().int().positive(),
    createdAt: z.string(),
    updatedAt: z.string(),
    deletedAt: z.string().nullable(),
  }),
  rounds: z.array(remoteRoundSchema),
});

const pullResponseSchema = z.object({
  changes: z.array(z.object({
    sequence: z.number().int().positive(),
    aggregateId: z.string(),
    operation: z.enum(['upsert', 'delete']),
    revision: z.number().int().positive(),
    changedAt: z.string(),
    aggregate: remoteAggregateSchema.nullable(),
  })),
  nextCursor: z.number().int().nonnegative(),
  hasMore: z.boolean(),
});

const MAX_BACKOFF_SECONDS = 60 * 60;
const STALE_UPLOAD_MS = 2 * 60 * 1000;
let activeRun: Promise<void> | null = null;

function retryAt(attempt: number): string {
  const seconds = Math.min(MAX_BACKOFF_SECONDS, 2 ** Math.min(attempt, 10) * 5);
  return new Date(Date.now() + seconds * 1000).toISOString();
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message.slice(0, 500);
  return 'Sync request failed';
}

async function uploadPendingSessions(userId: string): Promise<void> {
  const supabase = getSupabaseClient();
  const now = new Date().toISOString();
  const staleBefore = new Date(Date.now() - STALE_UPLOAD_MS).toISOString();

  database.update(syncOutbox)
    .set({ status: 'pending' })
    .where(and(
      eq(syncOutbox.userId, userId),
      eq(syncOutbox.status, 'uploading'),
      lt(syncOutbox.updatedAt, staleBefore),
    ))
    .run();

  const pending = database
    .select()
    .from(syncOutbox)
    .where(and(
      eq(syncOutbox.userId, userId),
      eq(syncOutbox.aggregateType, 'session'),
      eq(syncOutbox.status, 'pending'),
      or(isNull(syncOutbox.nextAttemptAt), lte(syncOutbox.nextAttemptAt, now)),
    ))
    .orderBy(asc(syncOutbox.createdAt))
    .all();

  for (const item of pending) {
    database.update(syncOutbox)
      .set({ status: 'uploading' })
      .where(and(eq(syncOutbox.id, item.id), eq(syncOutbox.updatedAt, item.updatedAt)))
      .run();

    try {
      const payload = payloadEnvelopeSchema.parse(JSON.parse(item.payloadJson));
      const { data, error } = await supabase.rpc('push_session_aggregate', {
        p_idempotency_key: item.id,
        p_operation: item.operation,
        p_payload: payload as Json,
        p_base_revision: payload.baseRevision,
      });
      if (error) throw error;

      const response = syncResponseSchema.parse(data);
      if (response.status === 'conflict') {
        database.update(syncOutbox)
          .set({
            status: 'action_required',
            lastError: `Revision conflict (server ${response.serverRevision ?? 'missing'})`,
          })
          .where(and(eq(syncOutbox.id, item.id), eq(syncOutbox.updatedAt, item.updatedAt)))
          .run();
        continue;
      }

      database.transaction((tx) => {
        tx.update(sessions)
          .set({ revision: response.revision })
          .where(and(eq(sessions.id, response.sessionId), eq(sessions.userId, userId)))
          .run();

        const latest = tx.select().from(syncOutbox).where(eq(syncOutbox.id, item.id)).get();
        if (!latest) return;

        if (latest.updatedAt === item.updatedAt) {
          tx.delete(syncOutbox).where(eq(syncOutbox.id, item.id)).run();
          return;
        }

        const latestPayload = JSON.parse(latest.payloadJson) as Record<string, unknown>;
        tx.update(syncOutbox).set({
          payloadJson: JSON.stringify({ ...latestPayload, baseRevision: response.revision }),
          status: 'pending',
          attemptCount: 0,
          nextAttemptAt: null,
          lastError: null,
        }).where(eq(syncOutbox.id, item.id)).run();
      });
    } catch (error) {
      const attemptCount = item.attemptCount + 1;
      database.update(syncOutbox).set({
        status: 'pending',
        attemptCount,
        nextAttemptAt: retryAt(attemptCount),
        lastError: errorMessage(error),
      }).where(and(eq(syncOutbox.id, item.id), eq(syncOutbox.updatedAt, item.updatedAt))).run();
    }
  }

  database.insert(syncState).values({
    userId,
    pullCursor: null,
    lastSyncedAt: new Date().toISOString(),
    lastError: null,
  }).onConflictDoUpdate({
    target: syncState.userId,
    set: { lastSyncedAt: new Date().toISOString(), lastError: null },
  }).run();
}

function applyRemoteChanges(
  userId: string,
  response: z.infer<typeof pullResponseSchema>,
): { cursor: number; blocked: boolean } {
  let appliedCursor = Number(database
    .select({ pullCursor: syncState.pullCursor })
    .from(syncState)
    .where(eq(syncState.userId, userId))
    .get()?.pullCursor ?? 0);
  let blocked = false;

  database.transaction((tx) => {
    for (const change of response.changes) {
      const localMutation = tx.select({ id: syncOutbox.id })
        .from(syncOutbox)
        .where(and(
          eq(syncOutbox.userId, userId),
          eq(syncOutbox.aggregateType, 'session'),
          eq(syncOutbox.aggregateId, change.aggregateId),
        ))
        .get();
      if (localMutation) {
        blocked = true;
        break;
      }

      if (change.operation === 'delete') {
        tx.update(sessions).set({
          deletedAt: change.changedAt,
          updatedAt: change.changedAt,
          revision: change.revision,
        }).where(and(eq(sessions.id, change.aggregateId), eq(sessions.userId, userId))).run();
        appliedCursor = change.sequence;
        continue;
      }

      const aggregate = remoteAggregateSchema.parse(change.aggregate);
      if (aggregate.venue) {
        tx.insert(venues).values({
          id: aggregate.venue.id,
          userId,
          name: aggregate.venue.name,
          lastUsedAt: aggregate.venue.lastUsedAt,
          createdAt: aggregate.venue.createdAt,
          updatedAt: aggregate.venue.updatedAt,
          deletedAt: aggregate.venue.deletedAt,
        }).onConflictDoUpdate({
          target: venues.id,
          set: {
            name: aggregate.venue.name,
            lastUsedAt: aggregate.venue.lastUsedAt,
            updatedAt: aggregate.venue.updatedAt,
            deletedAt: aggregate.venue.deletedAt,
          },
        }).run();
      }

      const session = aggregate.session;
      tx.insert(sessions).values({
        id: session.id,
        userId,
        venueId: session.venueId,
        venueNameSnapshot: session.venueNameSnapshot,
        startedAt: session.startedAt,
        endedAt: session.endedAt,
        timezoneName: session.timezoneName,
        elapsedSeconds: session.elapsedSeconds,
        heatSeconds: session.heatSeconds,
        coldSeconds: session.coldSeconds,
        roundCount: session.roundCount,
        rating: session.rating,
        note: session.note,
        entryMethod: session.entryMethod,
        revision: session.revision,
        deletedAt: session.deletedAt,
        createdAt: session.createdAt,
        updatedAt: session.updatedAt,
      }).onConflictDoUpdate({
        target: sessions.id,
        set: {
          venueId: session.venueId,
          venueNameSnapshot: session.venueNameSnapshot,
          startedAt: session.startedAt,
          endedAt: session.endedAt,
          timezoneName: session.timezoneName,
          elapsedSeconds: session.elapsedSeconds,
          heatSeconds: session.heatSeconds,
          coldSeconds: session.coldSeconds,
          roundCount: session.roundCount,
          rating: session.rating,
          note: session.note,
          entryMethod: session.entryMethod,
          revision: session.revision,
          deletedAt: session.deletedAt,
          updatedAt: session.updatedAt,
        },
      }).run();

      tx.delete(rounds).where(and(eq(rounds.sessionId, session.id), eq(rounds.userId, userId))).run();
      for (const round of aggregate.rounds) {
        tx.insert(rounds).values({
          id: round.id,
          userId,
          sessionId: session.id,
          position: round.position,
          createdAt: round.createdAt,
          updatedAt: round.updatedAt,
        }).run();

        for (const part of round.parts) {
          tx.insert(roundParts).values({
            id: part.id,
            userId,
            sessionId: session.id,
            roundId: round.id,
            position: part.position,
            kind: part.kind,
            durationSeconds: part.durationSeconds,
            temperatureCTenths: part.temperatureCTenths,
            startedAt: part.startedAt,
            endedAt: part.endedAt,
            createdAt: part.createdAt,
            updatedAt: part.updatedAt,
          }).run();
        }
      }
      appliedCursor = change.sequence;
    }

    tx.insert(syncState).values({
      userId,
      pullCursor: String(appliedCursor),
      lastSyncedAt: new Date().toISOString(),
      lastError: null,
    }).onConflictDoUpdate({
      target: syncState.userId,
      set: {
        pullCursor: String(appliedCursor),
        lastSyncedAt: new Date().toISOString(),
        lastError: null,
      },
    }).run();
  });

  return { cursor: appliedCursor, blocked };
}

async function pullRemoteSessions(userId: string): Promise<void> {
  const supabase = getSupabaseClient();
  let cursor = Number(database
    .select({ pullCursor: syncState.pullCursor })
    .from(syncState)
    .where(eq(syncState.userId, userId))
    .get()?.pullCursor ?? 0);

  for (;;) {
    const { data, error } = await supabase.rpc('pull_session_changes', {
      p_after_sequence: cursor,
      p_limit: 50,
    });
    if (error) throw error;

    const response = pullResponseSchema.parse(data);
    const applied = applyRemoteChanges(userId, response);
    cursor = applied.cursor;
    if (applied.blocked || !response.hasMore || response.changes.length === 0) return;
  }
}

/** Coalesces concurrent triggers into one foreground upload pass. */
export function requestSync(userId: string): Promise<void> {
  if (!hasSupabaseEnvironment()) return Promise.resolve();
  if (activeRun) return activeRun;

  activeRun = (async () => {
    const { data } = await getSupabaseClient().auth.getSession();
    if (data.session?.user.id !== userId) return;
    await uploadPendingSessions(userId);
    await pullRemoteSessions(userId);
  })().catch((error) => {
    database.insert(syncState).values({
      userId,
      pullCursor: null,
      lastSyncedAt: null,
      lastError: errorMessage(error),
    }).onConflictDoUpdate({
      target: syncState.userId,
      set: { lastError: errorMessage(error) },
    }).run();
  }).finally(() => {
    activeRun = null;
  });

  return activeRun;
}
