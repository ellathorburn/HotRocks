export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

type Table<Row, Insert, Update = Partial<Row>> = {
  Row: Row;
  Insert: Insert;
  Update: Update;
  Relationships: [];
};

type InsertRow<Row, RequiredKeys extends keyof Row> = Partial<Row> &
  Pick<Row, RequiredKeys>;

type Owned = {
  id: string;
  user_id: string;
  created_at: string;
  updated_at: string;
};

type ProfileRow = {
  id: string;
  user_id: string;
  temperature_unit: string;
  timezone_name: string;
  default_strava_sport_type: string;
  default_post_to_strava: boolean;
  strava_description_template: string;
  onboarding_completed_at: string | null;
  created_at: string;
  updated_at: string;
};

type VenueRow = Owned & {
  name: string;
  last_used_at: string | null;
  deleted_at: string | null;
};

type SessionRow = Owned & {
  venue_id: string | null;
  venue_name_snapshot: string | null;
  started_at: string;
  ended_at: string | null;
  timezone_name: string;
  elapsed_seconds: number;
  heat_seconds: number;
  cold_seconds: number;
  round_count: number;
  rating: number | null;
  note: string | null;
  entry_method: string;
  deleted_at: string | null;
};

type RoundRow = Owned & {
  session_id: string;
  position: number;
};

type RoundPartRow = Owned & {
  session_id: string;
  round_id: string;
  kind: string;
  position: number;
  duration_seconds: number;
  temperature_c_tenths: number | null;
  started_at: string | null;
  ended_at: string | null;
};

type SessionPhotoRow = Owned & {
  session_id: string;
  storage_path: string;
  thumbnail_path: string | null;
  position: number;
  width: number | null;
  height: number | null;
  uploaded_at: string | null;
  deleted_at: string | null;
};

type StravaExportRow = Owned & {
  session_id: string;
  requested_action: string;
  status: string;
  strava_activity_id: number | null;
  payload_snapshot: Json | null;
  attempt_count: number;
  next_attempt_at: string | null;
  last_error_code: string | null;
  posted_at: string | null;
};

/**
 * Application-facing database types mirroring the generated Supabase schema.
 * Regenerate from the linked project once hosted environments are connected.
 */
export type Database = {
  public: {
    Tables: {
      profiles: Table<ProfileRow, InsertRow<ProfileRow, 'user_id'>>;
      venues: Table<VenueRow, InsertRow<VenueRow, 'id' | 'user_id' | 'name'>>;
      sessions: Table<
        SessionRow,
        InsertRow<SessionRow, 'id' | 'user_id' | 'started_at' | 'timezone_name' | 'elapsed_seconds' | 'round_count'>
      >;
      rounds: Table<RoundRow, InsertRow<RoundRow, 'id' | 'user_id' | 'session_id' | 'position'>>;
      round_parts: Table<
        RoundPartRow,
        InsertRow<RoundPartRow, 'id' | 'user_id' | 'session_id' | 'round_id' | 'kind' | 'position' | 'duration_seconds'>
      >;
      session_photos: Table<
        SessionPhotoRow,
        InsertRow<SessionPhotoRow, 'id' | 'user_id' | 'session_id' | 'storage_path' | 'position'>
      >;
      strava_exports: Table<
        StravaExportRow,
        InsertRow<StravaExportRow, 'id' | 'user_id' | 'session_id'>
      >;
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};

export type Tables<
  TableName extends keyof Database['public']['Tables'],
> = Database['public']['Tables'][TableName]['Row'];

export type TablesInsert<
  TableName extends keyof Database['public']['Tables'],
> = Database['public']['Tables'][TableName]['Insert'];

export type TablesUpdate<
  TableName extends keyof Database['public']['Tables'],
> = Database['public']['Tables'][TableName]['Update'];
