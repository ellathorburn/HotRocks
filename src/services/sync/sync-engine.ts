import { and, asc, eq, isNull, lt, lte, or } from 'drizzle-orm';
import { z } from 'zod';

import { database } from '@/services/database/client';
import { sessionIntervals, sessions, syncOutbox, syncState, venues } from '@/services/database/schema';
import { getSupabaseClient, hasSupabaseEnvironment } from '@/services/supabase/client';
import type { Json } from '@/services/supabase/database.types';

const syncResponseSchema = z.discriminatedUnion('status', [
  z.object({ status: z.enum(['applied', 'deleted']), sessionId: z.string(), revision: z.number() }),
  z.object({ status: z.literal('conflict'), sessionId: z.string(), serverRevision: z.number().nullable() }),
]);

const payloadEnvelopeSchema = z.object({
  baseRevision: z.number().int().nonnegative().default(0),
}).passthrough();

const remoteIntervalSchema = z.object({
  id: z.string(),
  position: z.number().int().nonnegative(),
  kind: z.enum(['heat', 'cold', 'rest']),
  durationSeconds: z.number().int().positive(),
  temperatureCTenths: z.number().int().nullable(),
  startedAt: z.string().nullable(),
  endedAt: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
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
    restSeconds: z.number().int().nonnegative(),
    intervalCount: z.number().int().nonnegative(),
    rating: z.number().int().nullable(),
    note: z.string().nullable(),
    entryMethod: z.enum(['manual', 'timer', 'repeat']),
    revision: z.number().int().positive(),
    createdAt: z.string(),
    updatedAt: z.string(),
    deletedAt: z.string().nullable(),
  }),
  intervals: z.array(remoteIntervalSchema),
});

/** Round-shaped payloads queued by app versions before the timeline cutover. */
const legacyRoundPayloadSchema = z.object({
  rounds: z.array(z.object({
    parts: z.array(z.object({
      id: z.string(),
      kind: z.enum(['heat', 'cold']),
      durationSeconds: z.number().int().positive(),
      temperatureCTenths: z.number().int().nullable(),
    })),
  })),
}).passthrough();

/** Upgrades a queued version-one upsert so it can still reach the server. */
export function upgradeLegacySessionPayload(payload: Record<string, unknown>): Record<string, unknown> {
  if (payload.schemaVersion === 2 || !('rounds' in payload)) return payload;
  const { rounds, ...rest } = legacyRoundPayloadSchema.parse(payload);
  return {
    ...rest,
    schemaVersion: 2,
    intervals: rounds.flatMap((round) => round.parts.map((part) => ({
      id: part.id,
      kind: part.kind,
      durationSeconds: part.durationSeconds,
      temperatureCTenths: part.temperatureCTenths,
    }))),
  };
}

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
const activeRuns = new Map<string, Promise<void>>();
let syncEpoch = 0;

class SyncCancelledError extends Error {
  constructor() {
    super('Sync was cancelled because the authenticated account changed.');
  }
}

/** Invalidates in-flight work before an authentication transition. */
export function invalidateSyncRuns(): void {
  syncEpoch += 1;
  activeRuns.clear();
}

async function assertSyncIdentity(userId: string, epoch: number): Promise<void> {
  if (epoch !== syncEpoch) throw new SyncCancelledError();
  const { data, error } = await getSupabaseClient().auth.getSession();
  if (error || data.session?.user.id !== userId || epoch !== syncEpoch) {
    throw new SyncCancelledError();
  }
}

function retryAt(attempt: number): string {
  const seconds = Math.min(MAX_BACKOFF_SECONDS, 2 ** Math.min(attempt, 10) * 5);
  return new Date(Date.now() + seconds * 1000).toISOString();
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message.slice(0, 500);
  return 'Sync request failed';
}

async function uploadPendingSessions(userId: string, epoch: number): Promise<void> {
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
    await assertSyncIdentity(userId, epoch);
    database.update(syncOutbox)
      .set({ status: 'uploading' })
      .where(and(eq(syncOutbox.id, item.id), eq(syncOutbox.updatedAt, item.updatedAt)))
      .run();

    try {
      const payload = payloadEnvelopeSchema.parse(
        item.operation === 'upsert'
          ? upgradeLegacySessionPayload(JSON.parse(item.payloadJson) as Record<string, unknown>)
          : JSON.parse(item.payloadJson),
      );
      const { data, error } = await supabase.rpc('push_session_aggregate', {
        p_idempotency_key: item.id,
        p_operation: item.operation,
        p_payload: payload as Json,
        p_base_revision: payload.baseRevision,
      });
      if (error) throw error;
      await assertSyncIdentity(userId, epoch);

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
      if (error instanceof SyncCancelledError) throw error;
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
        restSeconds: session.restSeconds,
        intervalCount: session.intervalCount,
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
          restSeconds: session.restSeconds,
          intervalCount: session.intervalCount,
          rating: session.rating,
          note: session.note,
          entryMethod: session.entryMethod,
          revision: session.revision,
          deletedAt: session.deletedAt,
          updatedAt: session.updatedAt,
        },
      }).run();

      tx.delete(sessionIntervals)
        .where(and(eq(sessionIntervals.sessionId, session.id), eq(sessionIntervals.userId, userId)))
        .run();
      for (const interval of aggregate.intervals) {
        tx.insert(sessionIntervals).values({
          id: interval.id,
          userId,
          sessionId: session.id,
          position: interval.position,
          kind: interval.kind,
          durationSeconds: interval.durationSeconds,
          temperatureCTenths: interval.kind === 'rest' ? null : interval.temperatureCTenths,
          startedAt: interval.startedAt,
          endedAt: interval.endedAt,
          createdAt: interval.createdAt,
          updatedAt: interval.updatedAt,
        }).run();
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

async function pullRemoteSessions(userId: string, epoch: number): Promise<void> {
  const supabase = getSupabaseClient();
  let cursor = Number(database
    .select({ pullCursor: syncState.pullCursor })
    .from(syncState)
    .where(eq(syncState.userId, userId))
    .get()?.pullCursor ?? 0);

  for (;;) {
    await assertSyncIdentity(userId, epoch);
    const { data, error } = await supabase.rpc('pull_session_changes', {
      p_after_sequence: cursor,
      p_limit: 50,
    });
    if (error) throw error;
    await assertSyncIdentity(userId, epoch);

    const response = pullResponseSchema.parse(data);
    const applied = applyRemoteChanges(userId, response);
    cursor = applied.cursor;
    if (applied.blocked || !response.hasMore || response.changes.length === 0) return;
  }
}

/** Coalesces concurrent triggers into one foreground upload pass. */
export function requestSync(userId: string): Promise<void> {
  if (!hasSupabaseEnvironment()) return Promise.resolve();
  const existingRun = activeRuns.get(userId);
  if (existingRun) return existingRun;

  const epoch = syncEpoch;
  const run = (async () => {
    await assertSyncIdentity(userId, epoch);
    await uploadPendingSessions(userId, epoch);
    await pullRemoteSessions(userId, epoch);
  })().catch((error) => {
    if (error instanceof SyncCancelledError) return;
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
    if (activeRuns.get(userId) === run) activeRuns.delete(userId);
  });

  activeRuns.set(userId, run);
  return run;
}
