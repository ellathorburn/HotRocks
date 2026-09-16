import { ulid } from 'ulid';

import { calculateSessionTotals, sessionDraftSchema, type SessionDraft } from '../domain/session';
import { powerSync, prepareLocalDatabase } from '@/services/powersync/system';

export type SaveSessionInput = SessionDraft & {
  userId: string;
  timezoneName: string;
  entryMethod?: 'manual' | 'timer' | 'repeat';
};

/** Writes the session and every child row as one durable SQLite transaction. */
export async function saveSession(input: SaveSessionInput): Promise<string> {
  const draft = sessionDraftSchema.parse(input);
  const totals = calculateSessionTotals(draft);
  const now = new Date().toISOString();

  await prepareLocalDatabase();
  await powerSync.writeTransaction(async (tx) => {
    let venueId: string | null = null;

    if (draft.venueName) {
      const existing = await tx.getOptional<{ id: string }>(
        'SELECT id FROM venues WHERE user_id = ? AND lower(name) = lower(?) AND deleted_at IS NULL LIMIT 1',
        [input.userId, draft.venueName],
      );
      venueId = existing?.id ?? ulid();

      if (existing) {
        await tx.execute('UPDATE venues SET name = ?, last_used_at = ?, updated_at = ? WHERE id = ?', [draft.venueName, now, now, venueId]);
      } else {
        await tx.execute(
          'INSERT INTO venues (id, user_id, name, last_used_at, created_at, updated_at, deleted_at) VALUES (?, ?, ?, ?, ?, ?, NULL)',
          [venueId, input.userId, draft.venueName, now, now, now],
        );
      }
    }

    await tx.execute(
      `INSERT INTO sessions (
        id, user_id, venue_id, venue_name_snapshot, started_at, ended_at,
        timezone_name, elapsed_seconds, heat_seconds, cold_seconds, round_count,
        rating, note, entry_method, created_at, updated_at, deleted_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)`,
      [
        draft.id,
        input.userId,
        venueId,
        draft.venueName,
        draft.startedAt,
        new Date(new Date(draft.startedAt).getTime() + totals.elapsedSeconds * 1000).toISOString(),
        input.timezoneName,
        totals.elapsedSeconds,
        totals.heatSeconds,
        totals.coldSeconds,
        totals.roundCount,
        draft.rating,
        draft.note,
        input.entryMethod ?? 'manual',
        now,
        now,
      ],
    );

    for (const [roundPosition, round] of draft.rounds.entries()) {
      await tx.execute(
        'INSERT INTO rounds (id, user_id, session_id, position, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
        [round.id, input.userId, draft.id, roundPosition, now, now],
      );

      for (const [partPosition, part] of round.parts.entries()) {
        await tx.execute(
          `INSERT INTO round_parts (
            id, user_id, session_id, round_id, position, kind, duration_seconds,
            temperature_c_tenths, started_at, ended_at, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL, ?, ?)`,
          [
            part.id,
            input.userId,
            draft.id,
            round.id,
            partPosition,
            part.kind,
            part.durationSeconds,
            part.temperatureCTenths,
            now,
            now,
          ],
        );
      }
    }
  });

  return draft.id;
}

/** Hides a session immediately while preserving a tombstone for remote sync. */
export async function softDeleteSession(sessionId: string, userId: string): Promise<void> {
  const now = new Date().toISOString();
  await prepareLocalDatabase();
  await powerSync.writeTransaction(async (tx) => {
    await tx.execute(
      'UPDATE sessions SET deleted_at = ?, updated_at = ? WHERE id = ? AND user_id = ?',
      [now, now, sessionId, userId],
    );
    await tx.execute(
      'UPDATE session_photos SET deleted_at = ?, updated_at = ? WHERE session_id = ? AND user_id = ?',
      [now, now, sessionId, userId],
    );
  });
}
