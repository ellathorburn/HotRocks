const fs = require('node:fs');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');

const migrationRoot = path.join(process.cwd(), 'drizzle');
const migrationFiles = fs.readdirSync(migrationRoot, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => path.join(migrationRoot, entry.name, 'migration.sql'))
  .filter((file) => fs.existsSync(file))
  .sort();

function statementsOf(file) {
  return fs.readFileSync(file, 'utf8')
    .split('--> statement-breakpoint')
    .filter((statement) => statement.trim());
}

/** Mirrors drizzle's Expo migrator: every pending migration runs in one transaction. */
function migrate(database, files) {
  database.exec('BEGIN');
  for (const file of files) {
    for (const statement of statementsOf(file)) database.exec(statement);
  }
  database.exec('COMMIT');
}

function openDatabase() {
  const database = new DatabaseSync(':memory:');
  database.exec('PRAGMA foreign_keys = ON');
  return database;
}

describe('local session persistence schema', () => {
  test('accepts the rows written by a timeline session save', () => {
    const database = openDatabase();
    migrate(database, migrationFiles);
    const now = '2026-09-16T12:00:00.000Z';

    database.exec('BEGIN');
    database.prepare(`INSERT INTO sessions (
      id, user_id, created_at, updated_at, venue_id, venue_name_snapshot,
      started_at, ended_at, timezone_name, elapsed_seconds, heat_seconds,
      cold_seconds, rest_seconds, interval_count, rating, note, entry_method, revision, deleted_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .run('session-1', 'user-1', now, now, null, null, now, now, 'UTC', 1200, 900, 0, 300, 2, 4, null, 'manual', 0, null);
    database.prepare(`INSERT INTO session_intervals (
      id, user_id, created_at, updated_at, session_id, position,
      kind, duration_seconds, temperature_c_tenths
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .run('interval-1', 'user-1', now, now, 'session-1', 0, 'heat', 900, 900);
    database.prepare(`INSERT INTO sync_outbox (
      id, user_id, aggregate_type, aggregate_id, operation, payload_json,
      status, attempt_count, next_attempt_at, last_error, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .run('outbox-1', 'user-1', 'session', 'session-1', 'upsert', '{}', 'pending', 0, null, null, now, now);
    database.exec('COMMIT');

    expect(database.prepare('SELECT count(*) AS count FROM sessions').get().count).toBe(1);
    expect(database.prepare("SELECT count(*) AS count FROM sqlite_master WHERE name IN ('rounds', 'round_parts')").get().count).toBe(0);
    expect(() => database.prepare(`UPDATE sessions SET elapsed_seconds = 1199 WHERE id = 'session-1'`).run())
      .toThrow(/sessions_elapsed_covers_intervals/);
    database.close();
  });

  test('removes test sessions with entries under 30 seconds, then enforces the minimum', () => {
    const database = openDatabase();
    const minimumIndex = migrationFiles.findIndex((file) => file.includes('interval_min_duration'));
    migrate(database, migrationFiles.slice(0, minimumIndex));
    const now = '2026-09-18T12:00:00.000Z';

    const session = database.prepare(`INSERT INTO sessions (
      id, user_id, created_at, updated_at, started_at, timezone_name,
      elapsed_seconds, heat_seconds, cold_seconds, interval_count, entry_method
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
    session.run('session-short', 'user-1', now, now, now, 'UTC', 910, 900, 10, 2, 'timer');
    session.run('session-ok', 'user-1', now, now, now, 'UTC', 930, 900, 30, 2, 'timer');
    const interval = database.prepare(`INSERT INTO session_intervals (
      id, user_id, created_at, updated_at, session_id, position, kind, duration_seconds
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`);
    interval.run('short-heat', 'user-1', now, now, 'session-short', 0, 'heat', 900);
    interval.run('short-cold', 'user-1', now, now, 'session-short', 1, 'cold', 10);
    interval.run('ok-heat', 'user-1', now, now, 'session-ok', 0, 'heat', 900);
    interval.run('ok-cold', 'user-1', now, now, 'session-ok', 1, 'cold', 30);
    const outbox = database.prepare(`INSERT INTO sync_outbox (
      id, user_id, aggregate_type, aggregate_id, operation, payload_json, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`);
    outbox.run('outbox-short', 'user-1', 'session', 'session-short', 'upsert', '{}', now, now);
    outbox.run('outbox-ok', 'user-1', 'session', 'session-ok', 'upsert', '{}', now, now);
    const draft = database.prepare(`INSERT INTO session_drafts (id, user_id, payload_json, updated_at) VALUES (?, ?, ?, ?)`);
    draft.run('draft-short', 'user-1', '{"schemaVersion":2,"intervals":[{"durationSeconds":0}]}', now);
    draft.run('draft-ok', 'user-1', '{"schemaVersion":2,"intervals":[{"durationSeconds":30}]}', now);

    migrate(database, migrationFiles.slice(minimumIndex));

    expect(database.prepare('SELECT id FROM sessions').all().map(({ id }) => id)).toEqual(['session-ok']);
    expect(database.prepare('SELECT count(*) AS count FROM session_intervals').get().count).toBe(2);
    expect(database.prepare('SELECT id FROM sync_outbox').all().map(({ id }) => id)).toEqual(['outbox-ok']);
    expect(database.prepare('SELECT id FROM session_drafts').all().map(({ id }) => id)).toEqual(['draft-ok']);
    expect(() => database.prepare(`UPDATE session_intervals SET duration_seconds = 29 WHERE id = 'ok-cold'`).run())
      .toThrow(/session_intervals_min_duration/);
    database.close();
  });

  test('converts existing rounds into intervals without cascading deletes', () => {
    const database = openDatabase();
    const cutoverIndex = migrationFiles.findIndex((file) => file.includes('timeline_cutover'));
    migrate(database, migrationFiles.slice(0, cutoverIndex));
    const now = '2026-09-16T12:00:00.000Z';

    database.prepare(`INSERT INTO sessions (
      id, user_id, created_at, updated_at, started_at, timezone_name,
      elapsed_seconds, heat_seconds, cold_seconds, round_count, entry_method
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .run('session-1', 'user-1', now, now, now, 'UTC', 2000, 1700, 240, 2, 'manual');
    const round = database.prepare(`INSERT INTO rounds (
      id, user_id, created_at, updated_at, session_id, position
    ) VALUES (?, ?, ?, ?, ?, ?)`);
    round.run('round-2', 'user-1', now, now, 'session-1', 1);
    round.run('round-1', 'user-1', now, now, 'session-1', 0);
    const part = database.prepare(`INSERT INTO round_parts (
      id, user_id, created_at, updated_at, session_id, round_id, position,
      kind, duration_seconds, temperature_c_tenths
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
    part.run('part-4', 'user-1', now, now, 'session-1', 'round-2', 1, 'cold', 120, 110);
    part.run('part-1', 'user-1', now, now, 'session-1', 'round-1', 0, 'heat', 900, 900);
    part.run('part-3', 'user-1', now, now, 'session-1', 'round-2', 0, 'heat', 800, null);
    part.run('part-2', 'user-1', now, now, 'session-1', 'round-1', 1, 'cold', 120, 100);
    database.prepare(`INSERT INTO strava_exports (
      id, user_id, created_at, updated_at, session_id, requested_action, status
    ) VALUES (?, ?, ?, ?, ?, ?, ?)`)
      .run('export-1', 'user-1', now, now, 'session-1', 'post', 'posted');
    database.prepare(`INSERT INTO session_drafts (id, user_id, payload_json, updated_at) VALUES (?, ?, ?, ?)`)
      .run('draft-1', 'user-1', '{"schemaVersion":1}', now);

    migrate(database, migrationFiles.slice(cutoverIndex));

    expect(database.prepare(
      "SELECT group_concat(id, ',') AS ids FROM (SELECT id FROM session_intervals ORDER BY position)",
    ).get().ids).toBe('part-1,part-2,part-3,part-4');
    expect(database.prepare('SELECT interval_count FROM sessions').get().interval_count).toBe(4);
    expect(database.prepare('SELECT count(*) AS count FROM strava_exports').get().count).toBe(1);
    expect(database.prepare('SELECT count(*) AS count FROM session_drafts').get().count).toBe(0);
    database.close();
  });
});
