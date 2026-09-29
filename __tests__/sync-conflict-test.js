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

jest.mock('@/services/database/client', () => ({ database: mockDatabase }));
// Without a configured environment `requestSync` returns immediately, so the
// resolution itself is exercised without reaching the network.
jest.mock('@/services/supabase/client', () => ({
  hasSupabaseEnvironment: () => false,
  getSupabaseClient: () => {
    throw new Error('The conflict tests must not reach Supabase.');
  },
}));

const { resolveSessionConflict } = require('../src/services/sync/sync-engine');

const readOutbox = (aggregateId) =>
  mockClient.prepare('SELECT * FROM sync_outbox WHERE aggregate_id = ?').get(aggregateId);

/** Queues one session command already parked as a revision conflict. */
function seedConflict(aggregateId, {
  userId = 'user-1',
  serverRevision = 6,
  baseRevision = 3,
  status = 'action_required',
} = {}) {
  mockClient.prepare(`
    INSERT INTO sync_outbox (
      id, user_id, aggregate_type, aggregate_id, operation, payload_json,
      status, attempt_count, next_attempt_at, last_error,
      conflict_server_revision, created_at, updated_at
    ) VALUES (?, ?, 'session', ?, 'upsert', ?, ?, 4, '2026-09-25T10:00:00.000Z', 'Revision conflict (server 6)', ?, '2026-09-25T09:00:00.000Z', '2026-09-25T09:30:00.000Z')
  `).run(
    `outbox-${aggregateId}`,
    userId,
    aggregateId,
    JSON.stringify({
      schemaVersion: 2,
      baseRevision,
      session: { id: aggregateId, venueNameSnapshot: 'Conflicted Sauna' },
      intervals: [{ id: 'interval-1', kind: 'heat', durationSeconds: 900, temperatureCTenths: 900 }],
    }),
    status,
    status === 'action_required' ? serverRevision : null,
  );
}

describe('resolveSessionConflict', () => {
  afterAll(() => mockClient.close());

  test('keeping the local version rebases onto the revision the server held and retries', async () => {
    seedConflict('keep-mine');

    await resolveSessionConflict('user-1', 'keep-mine', 'keep-local');

    const outbox = readOutbox('keep-mine');
    expect(outbox).toMatchObject({
      status: 'pending',
      attempt_count: 0,
      next_attempt_at: null,
      last_error: null,
      conflict_server_revision: null,
    });
    // The retry must claim the revision the server actually holds, otherwise it
    // is refused again for the same reason.
    expect(JSON.parse(outbox.payload_json)).toMatchObject({
      schemaVersion: 2,
      baseRevision: 6,
      session: { venueNameSnapshot: 'Conflicted Sauna' },
    });
  });

  test('the retry reuses the outbox id, which is also the idempotency key', async () => {
    seedConflict('same-key');

    await resolveSessionConflict('user-1', 'same-key', 'keep-local');

    // A conflict stores no receipt server-side, so the original key is still
    // free and the coalescing unique key stays intact.
    expect(readOutbox('same-key').id).toBe('outbox-same-key');
    expect(mockClient.prepare("SELECT count(*) AS count FROM sync_outbox WHERE aggregate_id = 'same-key'").get().count)
      .toBe(1);
  });

  test('a conflict with no server revision rebases onto a session the server has never seen', async () => {
    seedConflict('missing-revision');
    mockClient.prepare('UPDATE sync_outbox SET conflict_server_revision = NULL WHERE aggregate_id = ?')
      .run('missing-revision');

    await resolveSessionConflict('user-1', 'missing-revision', 'keep-local');

    expect(JSON.parse(readOutbox('missing-revision').payload_json).baseRevision).toBe(0);
  });

  test('using the remote version drops the queued command so the pull can proceed', async () => {
    seedConflict('use-theirs');

    await resolveSessionConflict('user-1', 'use-theirs', 'use-remote');

    expect(readOutbox('use-theirs')).toBeUndefined();
  });

  test('a command that is not conflicted is left exactly as it is', async () => {
    seedConflict('still-pending', { status: 'pending' });
    const before = readOutbox('still-pending');

    await resolveSessionConflict('user-1', 'still-pending', 'keep-local');
    expect(readOutbox('still-pending')).toEqual(before);

    await resolveSessionConflict('user-1', 'still-pending', 'use-remote');
    expect(readOutbox('still-pending')).toEqual(before);
  });

  test('a conflict belonging to another account is not touched', async () => {
    seedConflict('other-account', { userId: 'user-2' });
    const before = readOutbox('other-account');

    await resolveSessionConflict('user-1', 'other-account', 'use-remote');

    expect(readOutbox('other-account')).toEqual(before);
  });

  test('resolving a session with nothing queued is a no-op', async () => {
    await expect(resolveSessionConflict('user-1', 'never-queued', 'keep-local')).resolves.toBeUndefined();
    expect(readOutbox('never-queued')).toBeUndefined();
  });
});
