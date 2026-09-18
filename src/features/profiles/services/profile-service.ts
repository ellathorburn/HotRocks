import type { ProfileUpdate } from '../types/profile-types';
import { normalizePersonName, type PersonName } from '@/features/auth/auth-credentials';
import { getSupabaseClient } from '@/services/supabase/client';

async function getOrCreate(userId: string) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw error;
  if (data) return data;

  const { data: created, error: createError } = await supabase
    .from('profiles')
    .insert({ user_id: userId })
    .select('*')
    .single();
  if (createError) throw createError;
  return created;
}

async function update(userId: string, patch: ProfileUpdate) {
  const { data, error } = await getSupabaseClient()
    .from('profiles')
    .update(patch)
    .eq('user_id', userId)
    .select('*')
    .single();
  if (error) throw error;
  return data;
}

/** Account-scoped profile operations; Supabase RLS remains the authorization boundary. */
export const profileService = {
  getOrCreate,
  update,
  completeOnboarding(userId: string) {
    return update(userId, { onboarding_completed_at: new Date().toISOString() });
  },
  updateName(userId: string, name: PersonName) {
    const { firstName, lastName } = normalizePersonName(name);
    return update(userId, { first_name: firstName, last_name: lastName });
  },
  /** Sets a provider-supplied name without overwriting one the user chose. */
  async fillMissingName(userId: string, name: PersonName): Promise<void> {
    const { firstName, lastName } = normalizePersonName(name);
    const { error } = await getSupabaseClient()
      .from('profiles')
      .update({ first_name: firstName, last_name: lastName })
      .eq('user_id', userId)
      .is('first_name', null);
    if (error) throw error;
  },
};
