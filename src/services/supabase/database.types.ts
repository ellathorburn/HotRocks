export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      profiles: {
        Row: {
          created_at: string
          default_post_to_strava: boolean
          default_strava_sport_type: string
          id: string
          onboarding_completed_at: string | null
          strava_description_template: string
          temperature_unit: string
          timezone_name: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          default_post_to_strava?: boolean
          default_strava_sport_type?: string
          id?: string
          onboarding_completed_at?: string | null
          strava_description_template?: string
          temperature_unit?: string
          timezone_name?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          default_post_to_strava?: boolean
          default_strava_sport_type?: string
          id?: string
          onboarding_completed_at?: string | null
          strava_description_template?: string
          temperature_unit?: string
          timezone_name?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      round_parts: {
        Row: {
          created_at: string
          duration_seconds: number
          ended_at: string | null
          id: string
          kind: string
          position: number
          round_id: string
          session_id: string
          started_at: string | null
          temperature_c_tenths: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          duration_seconds: number
          ended_at?: string | null
          id: string
          kind: string
          position: number
          round_id: string
          session_id: string
          started_at?: string | null
          temperature_c_tenths?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          duration_seconds?: number
          ended_at?: string | null
          id?: string
          kind?: string
          position?: number
          round_id?: string
          session_id?: string
          started_at?: string | null
          temperature_c_tenths?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "round_parts_round_owner_fk"
            columns: ["session_id", "round_id", "user_id"]
            isOneToOne: false
            referencedRelation: "rounds"
            referencedColumns: ["session_id", "id", "user_id"]
          },
        ]
      }
      rounds: {
        Row: {
          created_at: string
          id: string
          position: number
          session_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id: string
          position: number
          session_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          position?: number
          session_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "rounds_session_owner_fk"
            columns: ["session_id", "user_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id", "user_id"]
          },
        ]
      }
      session_photos: {
        Row: {
          created_at: string
          deleted_at: string | null
          height: number | null
          id: string
          position: number
          session_id: string
          storage_path: string
          thumbnail_path: string | null
          updated_at: string
          uploaded_at: string | null
          user_id: string
          width: number | null
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          height?: number | null
          id: string
          position: number
          session_id: string
          storage_path: string
          thumbnail_path?: string | null
          updated_at?: string
          uploaded_at?: string | null
          user_id: string
          width?: number | null
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          height?: number | null
          id?: string
          position?: number
          session_id?: string
          storage_path?: string
          thumbnail_path?: string | null
          updated_at?: string
          uploaded_at?: string | null
          user_id?: string
          width?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "session_photos_session_owner_fk"
            columns: ["session_id", "user_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id", "user_id"]
          },
        ]
      }
      sessions: {
        Row: {
          cold_seconds: number
          created_at: string
          deleted_at: string | null
          elapsed_seconds: number
          ended_at: string | null
          entry_method: string
          heat_seconds: number
          id: string
          note: string | null
          rating: number | null
          revision: number
          round_count: number
          started_at: string
          timezone_name: string
          updated_at: string
          user_id: string
          venue_id: string | null
          venue_name_snapshot: string | null
        }
        Insert: {
          cold_seconds?: number
          created_at?: string
          deleted_at?: string | null
          elapsed_seconds: number
          ended_at?: string | null
          entry_method?: string
          heat_seconds?: number
          id: string
          note?: string | null
          rating?: number | null
          revision?: number
          round_count: number
          started_at: string
          timezone_name: string
          updated_at?: string
          user_id: string
          venue_id?: string | null
          venue_name_snapshot?: string | null
        }
        Update: {
          cold_seconds?: number
          created_at?: string
          deleted_at?: string | null
          elapsed_seconds?: number
          ended_at?: string | null
          entry_method?: string
          heat_seconds?: number
          id?: string
          note?: string | null
          rating?: number | null
          revision?: number
          round_count?: number
          started_at?: string
          timezone_name?: string
          updated_at?: string
          user_id?: string
          venue_id?: string | null
          venue_name_snapshot?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sessions_venue_owner_fk"
            columns: ["venue_id", "user_id"]
            isOneToOne: false
            referencedRelation: "venues"
            referencedColumns: ["id", "user_id"]
          },
        ]
      }
      strava_exports: {
        Row: {
          attempt_count: number
          created_at: string
          id: string
          last_error_code: string | null
          next_attempt_at: string | null
          payload_snapshot: Json | null
          posted_at: string | null
          requested_action: string
          session_id: string
          status: string
          strava_activity_id: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          attempt_count?: number
          created_at?: string
          id: string
          last_error_code?: string | null
          next_attempt_at?: string | null
          payload_snapshot?: Json | null
          posted_at?: string | null
          requested_action?: string
          session_id: string
          status?: string
          strava_activity_id?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          attempt_count?: number
          created_at?: string
          id?: string
          last_error_code?: string | null
          next_attempt_at?: string | null
          payload_snapshot?: Json | null
          posted_at?: string | null
          requested_action?: string
          session_id?: string
          status?: string
          strava_activity_id?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "strava_exports_session_owner_fk"
            columns: ["session_id", "user_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id", "user_id"]
          },
        ]
      }
      sync_changes: {
        Row: {
          aggregate_id: string
          aggregate_type: string
          changed_at: string
          operation: string
          revision: number
          sequence: number
          user_id: string
        }
        Insert: {
          aggregate_id: string
          aggregate_type: string
          changed_at?: string
          operation: string
          revision: number
          sequence?: never
          user_id: string
        }
        Update: {
          aggregate_id?: string
          aggregate_type?: string
          changed_at?: string
          operation?: string
          revision?: number
          sequence?: never
          user_id?: string
        }
        Relationships: []
      }
      sync_receipts: {
        Row: {
          created_at: string
          idempotency_key: string
          response: Json
          user_id: string
        }
        Insert: {
          created_at?: string
          idempotency_key: string
          response: Json
          user_id: string
        }
        Update: {
          created_at?: string
          idempotency_key?: string
          response?: Json
          user_id?: string
        }
        Relationships: []
      }
      venues: {
        Row: {
          created_at: string
          deleted_at: string | null
          id: string
          last_used_at: string | null
          name: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          id: string
          last_used_at?: string | null
          name: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          id?: string
          last_used_at?: string | null
          name?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      pull_session_changes: {
        Args: { p_after_sequence?: number; p_limit?: number }
        Returns: Json
      }
      push_session_aggregate: {
        Args: {
          p_base_revision?: number
          p_idempotency_key: string
          p_operation: string
          p_payload: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
