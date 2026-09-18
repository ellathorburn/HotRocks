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

const intervals = [
  { id: 'heat-1', kind: 'heat', durationSeconds: 900, temperatureCTenths: 900 },
  { id: 'rest-1', kind: 'rest', durationSeconds: 300, temperatureCTenths: null },
  { id: 'cold-1', kind: 'cold', durationSeconds: 120, temperatureCTenths: 110 },
];

describe('sessionService', () => {
  afterAll(() => mockClient.close());

  test('saves a timeline session, its venue and one sync command atomically', async () => {
    const sessionId = await sessionService.save({
      id: 'session-1',
      userId: 'user-1',
      startedAt: '2026-09-17T12:00:00.000Z',
      elapsedSeconds: 1500,
      venueName: 'Test Sauna',
      rating: 4,
      note: 'Regression test',
      timezoneName: 'Africa/Johannesburg',
      entryMethod: 'manual',
      intervals,
    });

    expect(sessionId).toBe('session-1');
    const session = mockClient.prepare('SELECT * FROM sessions WHERE id = ?').get('session-1');
    expect(session).toMatchObject({
      heat_seconds: 900,
      cold_seconds: 120,
      rest_seconds: 300,
      interval_count: 3,
      elapsed_seconds: 1500,
    });
    expect(mockClient.prepare(
      "SELECT group_concat(kind, ',') AS kinds FROM (SELECT kind FROM session_intervals WHERE session_id = 'session-1' ORDER BY position)",
    ).get().kinds).toBe('heat,rest,cold');
    expect(mockClient.prepare('SELECT count(*) AS count FROM venues').get().count).toBe(1);

    const outbox = mockClient.prepare('SELECT * FROM sync_outbox').get();
    const payload = JSON.parse(outbox.payload_json);
    expect(payload.schemaVersion).toBe(2);
    expect(payload.intervals).toHaveLength(3);
    expect(mockRequestSync).toHaveBeenCalledWith('user-1');
  });

  test('saves a draft, consumes it, and rejects a timeline that cannot be saved', async () => {
    const draftId = sessionTimelineDraftService.create('user-2', {
      intervals: [{ ...intervals[0], id: 'draft-heat-1' }],
      venueName: 'Draft Sauna',
      rating: null,
      note: null,
      startedAt: '2026-09-17T12:00:00.000Z',
      elapsedSeconds: 0,
      entryMethod: 'manual',
    });

    await sessionService.saveDraft({
      sessionId: 'session-2',
      draftId,
      userId: 'user-2',
      timezoneName: 'UTC',
      rating: 5,
      note: 'Saved from a draft',
      now: new Date('2026-09-17T13:00:00.000Z'),
    });

    const session = mockClient.prepare('SELECT * FROM sessions WHERE id = ?').get('session-2');
    // A manual draft ends now, so its start is derived from the recorded time.
    expect(session).toMatchObject({
      started_at: '2026-09-17T12:45:00.000Z',
      elapsed_seconds: 900,
      rating: 5,
      note: 'Saved from a draft',
    });
    expect(sessionTimelineDraftService.get(draftId, 'user-2')).toBeNull();

    const emptyDraftId = sessionTimelineDraftService.create('user-2', {
      intervals: [],
      venueName: null,
      rating: null,
      note: null,
      startedAt: '2026-09-17T12:00:00.000Z',
      elapsedSeconds: 0,
      entryMethod: 'manual',
    });
    await expect(sessionService.saveDraft({
      sessionId: 'session-3',
      draftId: emptyDraftId,
      userId: 'user-2',
      timezoneName: 'UTC',
      rating: null,
      note: null,
    })).rejects.toThrow();
    expect(mockClient.prepare('SELECT count(*) AS count FROM sessions').get().count).toBe(2);
  });

  test('repeats a saved session as a new draft with fresh interval ids', () => {
    const draftId = sessionTimelineDraftService.createRepeat('user-1', 'session-1');
    const draft = sessionTimelineDraftService.get(draftId, 'user-1');

    expect(draft).toMatchObject({ venueName: 'Test Sauna', entryMethod: 'repeat', elapsedSeconds: 0 });
    expect(draft.intervals.map((interval) => interval.kind)).toEqual(['heat', 'rest', 'cold']);
    expect(draft.intervals.map((interval) => interval.id)).not.toContain('heat-1');
  });
});
