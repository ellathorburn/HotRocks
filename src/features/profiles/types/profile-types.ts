import type { Tables, TablesUpdate } from '@/services/supabase/database.types';

export type Profile = Tables<'profiles'>;
export type ProfileUpdate = TablesUpdate<'profiles'>;

/** A profile has a usable name once both parts are present. */
export function hasProfileName(profile: Profile | null): boolean {
  return Boolean(profile?.first_name?.trim() && profile?.last_name?.trim());
}
