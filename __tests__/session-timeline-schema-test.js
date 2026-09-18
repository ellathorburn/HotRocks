const fs = require('node:fs');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');

function migratedDatabase() {
  const database = new DatabaseSync(':memory:');
  database.exec('PRAGMA foreign_keys = ON');
  const root = path.join(process.cwd(), 'drizzle');
  const migrations = fs.readdirSync(root, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => path.join(root, entry.name, 'migration.sql'))
    .filter((file) => fs.existsSync(file))
    .sort();

  for (const file of migrations) {
    for (const statement of fs.readFileSync(file, 'utf8').split('--> statement-breakpoint')) {
      if (statement.trim()) database.exec(statement);
    }
  }
  return database;
}

describe('local session timeline schema', () => {
  test('stores arbitrary ordered intervals and enforces break temperature rules', () => {
    const database = migratedDatabase();
    const now = '2026-09-17T08:00:00.000Z';

    database.prepare(`INSERT INTO sessions (
      id, user_id, created_at, updated_at, started_at, timezone_name,
      elapsed_seconds, heat_seconds, cold_seconds, rest_seconds,
      interval_count, entry_method
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .run('session-1', 'user-1', now, now, now, 'UTC', 1380, 900, 0, 480, 2, 'manual');

    database.prepare(`INSERT INTO session_intervals (
      id, user_id, created_at, updated_at, session_id, position,
      kind, duration_seconds, temperature_c_tenths
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .run('interval-1', 'user-1', now, now, 'session-1', 0, 'heat', 900, 900);
    database.prepare(`INSERT INTO session_intervals (
      id, user_id, created_at, updated_at, session_id, position,
      kind, duration_seconds, temperature_c_tenths
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .run('interval-2', 'user-1', now, now, 'session-1', 1, 'rest', 480, null);

    expect(database.prepare(
      'SELECT group_concat(kind, ?) AS kinds FROM session_intervals ORDER BY position',
    ).get(',').kinds).toBe('heat,rest');
    expect(() => database.prepare(`INSERT INTO session_intervals (
      id, user_id, created_at, updated_at, session_id, position,
      kind, duration_seconds, temperature_c_tenths
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .run('interval-3', 'user-1', now, now, 'session-1', 2, 'rest', 60, 200))
      .toThrow(/session_intervals_rest_has_no_temperature/);

    database.close();
  });
});
