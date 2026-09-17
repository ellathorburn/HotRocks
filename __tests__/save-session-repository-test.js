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

const { saveSession } = require('../src/features/sessions/data/session-repository');

describe('saveSession', () => {
  afterAll(() => mockClient.close());

  test('atomically saves a session aggregate and queues sync', async () => {
    const sessionId = await saveSession({
      id: 'session-1',
      userId: 'user-1',
      startedAt: '2026-09-16T12:00:00.000Z',
      elapsedSeconds: 1_020,
      venueName: 'Test Sauna',
      rating: 4,
      note: 'Regression test',
      timezoneName: 'Africa/Johannesburg',
      entryMethod: 'manual',
      rounds: [{
        id: 'round-1',
        parts: [
          { id: 'heat-1', kind: 'heat', durationSeconds: 900, temperatureCTenths: 900 },
          { id: 'cold-1', kind: 'cold', durationSeconds: 120, temperatureCTenths: 110 },
        ],
      }],
    });

    expect(sessionId).toBe('session-1');
    expect(mockClient.prepare('SELECT count(*) AS count FROM sessions').get().count).toBe(1);
    expect(mockClient.prepare('SELECT count(*) AS count FROM rounds').get().count).toBe(1);
    expect(mockClient.prepare('SELECT count(*) AS count FROM round_parts').get().count).toBe(2);
    expect(mockClient.prepare('SELECT count(*) AS count FROM sync_outbox').get().count).toBe(1);
    expect(mockRequestSync).toHaveBeenCalledWith('user-1');
  });
});
