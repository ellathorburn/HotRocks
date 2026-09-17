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

describe('local session persistence schema', () => {
  test('accepts the rows written by a normal session save', () => {
    const database = migratedDatabase();
    const now = '2026-09-16T12:00:00.000Z';

    database.exec('BEGIN');
    database.prepare(`INSERT INTO sessions (
      id, user_id, created_at, updated_at, venue_id, venue_name_snapshot,
      started_at, ended_at, timezone_name, elapsed_seconds, heat_seconds,
      cold_seconds, round_count, rating, note, entry_method, revision, deleted_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .run('session-1', 'user-1', now, now, null, null, now, now, 'UTC', 900, 900, 0, 1, 4, null, 'manual', 0, null);
    database.prepare(`INSERT INTO rounds (
      id, user_id, created_at, updated_at, session_id, position
    ) VALUES (?, ?, ?, ?, ?, ?)`)
      .run('round-1', 'user-1', now, now, 'session-1', 0);
    database.prepare(`INSERT INTO round_parts (
      id, user_id, created_at, updated_at, session_id, round_id, position,
      kind, duration_seconds, temperature_c_tenths, started_at, ended_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .run('part-1', 'user-1', now, now, 'session-1', 'round-1', 0, 'heat', 900, 900, null, null);
    database.prepare(`INSERT INTO sync_outbox (
      id, user_id, aggregate_type, aggregate_id, operation, payload_json,
      status, attempt_count, next_attempt_at, last_error, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .run('outbox-1', 'user-1', 'session', 'session-1', 'upsert', '{}', 'pending', 0, null, null, now, now);
    database.exec('COMMIT');

    expect(database.prepare('SELECT count(*) AS count FROM sessions').get().count).toBe(1);
    expect(database.prepare('SELECT count(*) AS count FROM sync_outbox').get().count).toBe(1);
    database.close();
  });
});
