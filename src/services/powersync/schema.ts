import { column, Schema, Table } from '@powersync/react-native';

const profiles = new Table({
  user_id: column.text,
  temperature_unit: column.text,
  timezone_name: column.text,
  default_strava_sport_type: column.text,
  default_post_to_strava: column.integer,
  strava_description_template: column.text,
  onboarding_completed_at: column.text,
  created_at: column.text,
  updated_at: column.text,
});

const venues = new Table(
  {
    user_id: column.text,
    name: column.text,
    last_used_at: column.text,
    created_at: column.text,
    updated_at: column.text,
    deleted_at: column.text,
  },
  { indexes: { user_recent: ['user_id', 'last_used_at'] } },
);

const sessions = new Table(
  {
    user_id: column.text,
    venue_id: column.text,
    venue_name_snapshot: column.text,
    started_at: column.text,
    ended_at: column.text,
    timezone_name: column.text,
    elapsed_seconds: column.integer,
    heat_seconds: column.integer,
    cold_seconds: column.integer,
    round_count: column.integer,
    rating: column.integer,
    note: column.text,
    entry_method: column.text,
    created_at: column.text,
    updated_at: column.text,
    deleted_at: column.text,
  },
  { indexes: { user_started: ['user_id', 'started_at'], venue: ['venue_id'] } },
);

const rounds = new Table(
  {
    user_id: column.text,
    session_id: column.text,
    position: column.integer,
    created_at: column.text,
    updated_at: column.text,
  },
  { indexes: { session_position: ['session_id', 'position'] } },
);

const roundParts = new Table(
  {
    user_id: column.text,
    session_id: column.text,
    round_id: column.text,
    position: column.integer,
    kind: column.text,
    duration_seconds: column.integer,
    temperature_c_tenths: column.integer,
    started_at: column.text,
    ended_at: column.text,
    created_at: column.text,
    updated_at: column.text,
  },
  { indexes: { session: ['session_id'], round_position: ['round_id', 'position'] } },
);

const sessionPhotos = new Table(
  {
    user_id: column.text,
    session_id: column.text,
    storage_path: column.text,
    thumbnail_path: column.text,
    position: column.integer,
    width: column.integer,
    height: column.integer,
    uploaded_at: column.text,
    created_at: column.text,
    updated_at: column.text,
    deleted_at: column.text,
  },
  { indexes: { session_position: ['session_id', 'position'] } },
);

const stravaExports = new Table(
  {
    user_id: column.text,
    session_id: column.text,
    requested_action: column.text,
    status: column.text,
    strava_activity_id: column.integer,
    payload_snapshot: column.text,
    attempt_count: column.integer,
    next_attempt_at: column.text,
    last_error_code: column.text,
    posted_at: column.text,
    created_at: column.text,
    updated_at: column.text,
  },
  { indexes: { user_status: ['user_id', 'status'], session: ['session_id'] } },
);

const sessionDrafts = Table.createLocalOnly({
  user_id: column.text,
  payload_json: column.text,
  updated_at: column.text,
});

export const AppSchema = new Schema({
  profiles,
  venues,
  sessions,
  rounds,
  round_parts: roundParts,
  session_photos: sessionPhotos,
  strava_exports: stravaExports,
  session_drafts: sessionDrafts,
});

export type LocalDatabase = (typeof AppSchema)['types'];
