const fs = require('node:fs');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');
const { drizzle } = require('drizzle-orm/node-sqlite');

const mockClient = new DatabaseSync(':memory:');
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

const {
  createSessionDraft,
  deleteSessionDraft,
  readSessionDraft,
  updateSessionDraft,
} = require('../src/features/sessions/data/session-draft-repository');

describe('session draft navigation handoff', () => {
  afterAll(() => mockClient.close());

  test('round-trips a draft only for its owning user', () => {
    const id = createSessionDraft('user-1', {
      rounds: [{
        id: 'round-1',
        parts: [{ id: 'part-1', kind: 'heat', durationSeconds: 900, temperatureCTenths: 900 }],
      }],
      venueName: null,
      rating: null,
      note: null,
      startedAt: '2026-09-16T12:00:00.000Z',
      elapsedSeconds: 900,
      entryMethod: 'manual',
    });

    expect(readSessionDraft(id, 'user-2')).toBeNull();
    expect(readSessionDraft(id, 'user-1')).toMatchObject({ entryMethod: 'manual', elapsedSeconds: 900 });

    updateSessionDraft(id, 'user-1', (draft) => ({ ...draft, venueName: 'Test Sauna' }));
    expect(readSessionDraft(id, 'user-1').venueName).toBe('Test Sauna');

    deleteSessionDraft(id, 'user-1');
    expect(readSessionDraft(id, 'user-1')).toBeNull();
  });
});
