const fs = require('node:fs');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');
const { drizzle } = require('drizzle-orm/node-sqlite');

const mockClient = new DatabaseSync(':memory:');
mockClient.exec('PRAGMA foreign_keys = ON');
const migrationRoot = path.join(process.cwd(), 'drizzle');
for (const entry of fs.readdirSync(migrationRoot, { withFileTypes: true })
  .filter((candidate) => candidate.isDirectory())
  .sort((left, right) => left.name.localeCompare(right.name))) {
  const migrationFile = path.join(migrationRoot, entry.name, 'migration.sql');
  if (!fs.existsSync(migrationFile)) continue;
  for (const statement of fs.readFileSync(migrationFile, 'utf8').split('--> statement-breakpoint')) {
    if (statement.trim()) mockClient.exec(statement);
  }
}
const mockDatabase = drizzle({ client: mockClient });
const mockRequestSync = jest.fn();

jest.mock('@/services/database/client', () => ({ database: mockDatabase }));
jest.mock('@/services/sync/sync-engine', () => ({ requestSync: mockRequestSync }));

const { sessionService } = require('../src/features/sessions/services/session-service');
const { sessionTimelineDraftService } = require('../src/features/sessions/services/session-draft-service');

const readOutbox = (aggregateId) =>
  mockClient.prepare('SELECT * FROM sync_outbox WHERE aggregate_id = ?').get(aggregateId);

const readIntervals = (sessionId) =>
  mockClient
    .prepare('SELECT id, kind, position, duration_seconds FROM session_intervals WHERE session_id = ? ORDER BY position')
    .all(sessionId);

const readSession = (sessionId) =>
  mockClient.prepare('SELECT * FROM sessions WHERE id = ?').get(sessionId);

/**
 * Saves a sauna / break / plunge session to edit. Interval IDs are primary keys
 * across the whole table, so each session gets its own, and every test seeds its
 * own session rather than sharing one.
 */
async function seedSession(id, userId) {
  await sessionService.save({
    id,
    userId,
    startedAt: '2026-09-20T09:00:00.000Z',
    elapsedSeconds: 1800,
    venueName: 'Original Sauna',
    rating: 3,
    note: 'Original note',
    timezoneName: 'Africa/Johannesburg',
    entryMethod: 'manual',
    intervals: [
      { id: `${id}-heat`, kind: 'heat', durationSeconds: 900, temperatureCTenths: 900 },
      { id: `${id}-rest`, kind: 'rest', durationSeconds: 300, temperatureCTenths: null },
      { id: `${id}-cold`, kind: 'cold', durationSeconds: 120, temperatureCTenths: 110 },
    ],
  });
}

const saveEdit = (draftId, userId, details = {}) => sessionService.saveDraft({
  sessionId: 'ignored-when-editing',
  draftId,
  userId,
  timezoneName: 'Africa/Johannesburg',
  rating: null,
  note: null,
  now: new Date('2026-09-25T10:00:00.000Z'),
  ...details,
});

describe('editing a saved session', () => {
  afterAll(() => mockClient.close());

  test('createEdit keeps the session identity, interval ids and recorded details', async () => {
    await seedSession('identity', 'user-1');

    const draftId = sessionTimelineDraftService.createEdit('user-1', 'identity');
    const draft = sessionTimelineDraftService.get(draftId, 'user-1');

    expect(draft).toMatchObject({
      editingSessionId: 'identity',
      venueName: 'Original Sauna',
      rating: 3,
      note: 'Original note',
      startedAt: '2026-09-20T09:00:00.000Z',
      elapsedSeconds: 1800,
      entryMethod: 'manual',
    });
    // Unlike a repeat, an edit reuses the interval ids so the server replaces
    // the same rows instead of accumulating new ones.
    expect(draft.intervals.map((interval) => interval.id))
      .toEqual(['identity-heat', 'identity-rest', 'identity-cold']);
  });

  test('a repeat is still a new session, not an edit', () => {
    const draftId = sessionTimelineDraftService.createRepeat('user-1', 'identity');
    const draft = sessionTimelineDraftService.get(draftId, 'user-1');

    expect(draft.editingSessionId).toBeNull();
    expect(draft.intervals.map((interval) => interval.id)).not.toContain('identity-heat');
  });

  test('saving an edited draft rewrites the session in place and consumes the draft', async () => {
    await seedSession('rewrite', 'user-1');
    const createdAt = readSession('rewrite').created_at;

    const draftId = sessionTimelineDraftService.createEdit('user-1', 'rewrite');
    sessionTimelineDraftService.removeInterval(draftId, 'user-1', 'rewrite-rest');
    sessionTimelineDraftService.updateInterval(draftId, 'user-1', 'rewrite-heat', (interval) => ({
      ...interval,
      durationSeconds: 1200,
      temperatureCTenths: 950,
    }));
    sessionTimelineDraftService.setVenue(draftId, 'user-1', 'Edited Sauna');

    const sessionId = await saveEdit(draftId, 'user-1', { rating: 5, note: 'Edited note' });

    expect(sessionId).toBe('rewrite');
    expect(readSession('rewrite')).toMatchObject({
      // The edit keeps the session's place in the feed and its creation time.
      started_at: '2026-09-20T09:00:00.000Z',
      created_at: createdAt,
      heat_seconds: 1200,
      cold_seconds: 120,
      rest_seconds: 0,
      interval_count: 2,
      rating: 5,
      note: 'Edited note',
      venue_name_snapshot: 'Edited Sauna',
    });
    expect(readIntervals('rewrite')).toEqual([
      { id: 'rewrite-heat', kind: 'heat', position: 0, duration_seconds: 1200 },
      { id: 'rewrite-cold', kind: 'cold', position: 1, duration_seconds: 120 },
    ]);
    expect(sessionTimelineDraftService.get(draftId, 'user-1')).toBeNull();
  });

  test('an edit does not create a second session', async () => {
    await seedSession('single', 'user-4');
    const countFor = () =>
      mockClient.prepare("SELECT count(*) AS count FROM sessions WHERE user_id = 'user-4'").get().count;
    expect(countFor()).toBe(1);

    const draftId = sessionTimelineDraftService.createEdit('user-4', 'single');
    sessionTimelineDraftService.setVenue(draftId, 'user-4', 'Still One Sauna');
    await saveEdit(draftId, 'user-4');

    expect(countFor()).toBe(1);
  });

  test('a reordered timeline is stored with contiguous positions', async () => {
    await seedSession('reorder', 'user-1');
    const draftId = sessionTimelineDraftService.createEdit('user-1', 'reorder');

    sessionTimelineDraftService.moveInterval(draftId, 'user-1', 'reorder-cold', 1);
    await saveEdit(draftId, 'user-1');

    expect(readIntervals('reorder').map((row) => [row.id, row.position])).toEqual([
      ['reorder-heat', 0],
      ['reorder-cold', 1],
      ['reorder-rest', 2],
    ]);
    expect(JSON.parse(readOutbox('reorder').payload_json).intervals.map((item) => item.kind))
      .toEqual(['heat', 'cold', 'rest']);
  });

  test('the queued command carries the revision the server is known to hold', async () => {
    await seedSession('revision', 'user-1');
    // Pretend the save reached the server and advanced the revision.
    mockClient.prepare('UPDATE sessions SET revision = 4 WHERE id = ?').run('revision');
    mockClient.prepare('DELETE FROM sync_outbox WHERE aggregate_id = ?').run('revision');

    const draftId = sessionTimelineDraftService.createEdit('user-1', 'revision');
    sessionTimelineDraftService.setVenue(draftId, 'user-1', 'Revision Sauna');
    await saveEdit(draftId, 'user-1');

    const outbox = readOutbox('revision');
    expect(outbox.operation).toBe('upsert');
    expect(outbox.status).toBe('pending');
    expect(JSON.parse(outbox.payload_json)).toMatchObject({
      schemaVersion: 2,
      baseRevision: 4,
    });
  });

  test('a conflicted command is requeued cleanly when the session is edited again', async () => {
    await seedSession('requeue', 'user-1');
    mockClient
      .prepare("UPDATE sync_outbox SET status = 'action_required', conflict_server_revision = 7, last_error = 'Revision conflict' WHERE aggregate_id = ?")
      .run('requeue');

    const draftId = sessionTimelineDraftService.createEdit('user-1', 'requeue');
    sessionTimelineDraftService.setVenue(draftId, 'user-1', 'Requeued Sauna');
    await saveEdit(draftId, 'user-1');

    expect(readOutbox('requeue')).toMatchObject({
      status: 'pending',
      conflict_server_revision: null,
      last_error: null,
      attempt_count: 0,
    });
  });

  test('repeated edits coalesce into one queued command', async () => {
    await seedSession('coalesce', 'user-1');
    const countOutbox = () =>
      mockClient.prepare("SELECT count(*) AS count FROM sync_outbox WHERE aggregate_id = 'coalesce'").get().count;

    for (const venueName of ['First Edit', 'Second Edit', 'Third Edit']) {
      const draftId = sessionTimelineDraftService.createEdit('user-1', 'coalesce');
      sessionTimelineDraftService.setVenue(draftId, 'user-1', venueName);
      await saveEdit(draftId, 'user-1');
    }

    expect(countOutbox()).toBe(1);
    expect(JSON.parse(readOutbox('coalesce').payload_json).session.venueNameSnapshot)
      .toBe('Third Edit');
  });

  test('an edit cannot leave a session starting with a break', async () => {
    await seedSession('leading-break', 'user-1');
    const draftId = sessionTimelineDraftService.createEdit('user-1', 'leading-break');

    // Removing the opening sauna would leave the break first.
    expect(() => sessionTimelineDraftService.removeInterval(draftId, 'user-1', 'leading-break-heat'))
      .toThrow();
    expect(readSession('leading-break')).toMatchObject({ interval_count: 3 });
  });

  test('an edit that removes every active interval is refused and leaves the session intact', async () => {
    await seedSession('no-active', 'user-1');
    const draftId = sessionTimelineDraftService.createEdit('user-1', 'no-active');

    sessionTimelineDraftService.removeInterval(draftId, 'user-1', 'no-active-cold');
    sessionTimelineDraftService.removeInterval(draftId, 'user-1', 'no-active-rest');
    // Only the sauna is left; removing it too leaves nothing that can be saved.
    sessionTimelineDraftService.removeInterval(draftId, 'user-1', 'no-active-heat');

    await expect(saveEdit(draftId, 'user-1')).rejects.toThrow();
    expect(readSession('no-active')).toMatchObject({ interval_count: 3, rest_seconds: 300 });
    expect(readIntervals('no-active')).toHaveLength(3);
  });

  test('editing is refused for a session another account owns, or one deleted', async () => {
    await seedSession('ownership', 'user-1');
    expect(() => sessionTimelineDraftService.createEdit('user-2', 'ownership'))
      .toThrow(/not found/i);

    await sessionService.delete('ownership', 'user-1');
    expect(() => sessionTimelineDraftService.createEdit('user-1', 'ownership'))
      .toThrow(/not found/i);
  });

  test('a draft held over a session deleted meanwhile cannot resurrect it', async () => {
    await seedSession('too-late', 'user-3');
    const draftId = sessionTimelineDraftService.createEdit('user-3', 'too-late');
    sessionTimelineDraftService.setVenue(draftId, 'user-3', 'Too Late Sauna');

    await sessionService.delete('too-late', 'user-3');

    await expect(saveEdit(draftId, 'user-3')).rejects.toThrow(/no longer exists/i);

    const session = readSession('too-late');
    expect(session.deleted_at).not.toBeNull();
    expect(session.venue_name_snapshot).toBe('Original Sauna');
    // The queued delete must survive: the refused edit did not replace it.
    expect(readOutbox('too-late').operation).toBe('delete');
  });
});
