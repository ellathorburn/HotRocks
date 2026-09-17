import { sql } from 'drizzle-orm';
import { check, index, integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';

const ownedTimestamps = {
  userId: text('user_id').notNull(),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
};

export const profiles = sqliteTable('profiles', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().unique(),
  temperatureUnit: text('temperature_unit', { enum: ['celsius', 'fahrenheit'] }).notNull(),
  timezoneName: text('timezone_name').notNull(),
  defaultStravaSportType: text('default_strava_sport_type').notNull(),
  defaultPostToStrava: integer('default_post_to_strava', { mode: 'boolean' }).notNull(),
  stravaDescriptionTemplate: text('strava_description_template').notNull(),
  onboardingCompletedAt: text('onboarding_completed_at'),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});

export const venues = sqliteTable('venues', {
  id: text('id').primaryKey(),
  ...ownedTimestamps,
  name: text('name').notNull(),
  lastUsedAt: text('last_used_at'),
  deletedAt: text('deleted_at'),
}, (table) => [
  index('venues_user_recent_idx').on(table.userId, table.lastUsedAt),
]);

export const sessions = sqliteTable('sessions', {
  id: text('id').primaryKey(),
  ...ownedTimestamps,
  venueId: text('venue_id').references(() => venues.id),
  venueNameSnapshot: text('venue_name_snapshot'),
  startedAt: text('started_at').notNull(),
  endedAt: text('ended_at'),
  timezoneName: text('timezone_name').notNull(),
  elapsedSeconds: integer('elapsed_seconds').notNull(),
  heatSeconds: integer('heat_seconds').notNull().default(0),
  coldSeconds: integer('cold_seconds').notNull().default(0),
  restSeconds: integer('rest_seconds').notNull().default(0),
  intervalCount: integer('interval_count').notNull().default(0),
  roundCount: integer('round_count').notNull(),
  rating: integer('rating'),
  note: text('note'),
  entryMethod: text('entry_method', { enum: ['manual', 'timer', 'repeat'] }).notNull(),
  revision: integer('revision').notNull().default(0),
  deletedAt: text('deleted_at'),
}, (table) => [
  index('sessions_user_started_idx').on(table.userId, table.startedAt),
  index('sessions_venue_idx').on(table.venueId),
  check('sessions_positive_elapsed', sql`${table.elapsedSeconds} > 0`),
  check('sessions_elapsed_covers_parts', sql`${table.elapsedSeconds} >= ${table.heatSeconds} + ${table.coldSeconds}`),
  check('sessions_non_negative_rest', sql`${table.restSeconds} >= 0`),
  check('sessions_non_negative_interval_count', sql`${table.intervalCount} >= 0`),
  check('sessions_positive_round_count', sql`${table.roundCount} > 0`),
]);

export const rounds = sqliteTable('rounds', {
  id: text('id').primaryKey(),
  ...ownedTimestamps,
  sessionId: text('session_id').notNull().references(() => sessions.id, { onDelete: 'cascade' }),
  position: integer('position').notNull(),
}, (table) => [
  uniqueIndex('rounds_session_position_idx').on(table.sessionId, table.position),
]);

export const roundParts = sqliteTable('round_parts', {
  id: text('id').primaryKey(),
  ...ownedTimestamps,
  sessionId: text('session_id').notNull().references(() => sessions.id, { onDelete: 'cascade' }),
  roundId: text('round_id').notNull().references(() => rounds.id, { onDelete: 'cascade' }),
  position: integer('position').notNull(),
  kind: text('kind', { enum: ['heat', 'cold'] }).notNull(),
  durationSeconds: integer('duration_seconds').notNull(),
  temperatureCTenths: integer('temperature_c_tenths'),
  startedAt: text('started_at'),
  endedAt: text('ended_at'),
}, (table) => [
  index('round_parts_session_idx').on(table.sessionId),
  uniqueIndex('round_parts_round_position_idx').on(table.roundId, table.position),
  uniqueIndex('round_parts_round_kind_idx').on(table.roundId, table.kind),
  check('round_parts_positive_duration', sql`${table.durationSeconds} > 0`),
]);

/** Canonical ordered timeline. Round tables remain temporarily for the current UI. */
export const sessionIntervals = sqliteTable('session_intervals', {
  id: text('id').primaryKey(),
  ...ownedTimestamps,
  sessionId: text('session_id').notNull().references(() => sessions.id, { onDelete: 'cascade' }),
  position: integer('position').notNull(),
  kind: text('kind', { enum: ['heat', 'cold', 'rest'] }).notNull(),
  durationSeconds: integer('duration_seconds').notNull(),
  temperatureCTenths: integer('temperature_c_tenths'),
  startedAt: text('started_at'),
  endedAt: text('ended_at'),
}, (table) => [
  index('session_intervals_session_idx').on(table.sessionId),
  index('session_intervals_user_idx').on(table.userId),
  uniqueIndex('session_intervals_session_position_idx').on(table.sessionId, table.position),
  check('session_intervals_non_negative_position', sql`${table.position} >= 0`),
  check('session_intervals_positive_duration', sql`${table.durationSeconds} > 0`),
  check(
    'session_intervals_rest_has_no_temperature',
    sql`${table.kind} <> 'rest' OR ${table.temperatureCTenths} IS NULL`,
  ),
]);

export const sessionPhotos = sqliteTable('session_photos', {
  id: text('id').primaryKey(),
  ...ownedTimestamps,
  sessionId: text('session_id').notNull().references(() => sessions.id, { onDelete: 'cascade' }),
  storagePath: text('storage_path').notNull(),
  thumbnailPath: text('thumbnail_path'),
  localUri: text('local_uri'),
  position: integer('position').notNull(),
  width: integer('width'),
  height: integer('height'),
  uploadedAt: text('uploaded_at'),
  deletedAt: text('deleted_at'),
}, (table) => [
  uniqueIndex('session_photos_position_idx').on(table.sessionId, table.position),
]);

export const stravaExports = sqliteTable('strava_exports', {
  id: text('id').primaryKey(),
  ...ownedTimestamps,
  sessionId: text('session_id').notNull().references(() => sessions.id, { onDelete: 'cascade' }).unique(),
  requestedAction: text('requested_action', { enum: ['post', 'keep_private'] }).notNull(),
  status: text('status').notNull(),
  stravaActivityId: integer('strava_activity_id'),
  payloadSnapshot: text('payload_snapshot'),
  attemptCount: integer('attempt_count').notNull().default(0),
  nextAttemptAt: text('next_attempt_at'),
  lastErrorCode: text('last_error_code'),
  postedAt: text('posted_at'),
});

export const sessionDrafts = sqliteTable('session_drafts', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull(),
  payloadJson: text('payload_json').notNull(),
  updatedAt: text('updated_at').notNull(),
});

export const syncOutbox = sqliteTable('sync_outbox', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull(),
  aggregateType: text('aggregate_type', { enum: ['session', 'profile', 'photo'] }).notNull(),
  aggregateId: text('aggregate_id').notNull(),
  operation: text('operation', { enum: ['upsert', 'delete'] }).notNull(),
  payloadJson: text('payload_json').notNull(),
  status: text('status', { enum: ['pending', 'uploading', 'action_required'] }).notNull().default('pending'),
  attemptCount: integer('attempt_count').notNull().default(0),
  nextAttemptAt: text('next_attempt_at'),
  lastError: text('last_error'),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
}, (table) => [
  uniqueIndex('sync_outbox_aggregate_idx').on(table.userId, table.aggregateType, table.aggregateId),
  index('sync_outbox_pending_idx').on(table.userId, table.status, table.nextAttemptAt),
]);

export const syncState = sqliteTable('sync_state', {
  userId: text('user_id').primaryKey(),
  pullCursor: text('pull_cursor'),
  lastSyncedAt: text('last_synced_at'),
  lastError: text('last_error'),
});

export type LocalSessionRow = typeof sessions.$inferSelect;
export type LocalRoundPartRow = typeof roundParts.$inferSelect;
export type LocalSessionIntervalRow = typeof sessionIntervals.$inferSelect;
