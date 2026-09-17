import type { Session, User } from '@supabase/supabase-js';
import {
  useCallback,
  createContext,
  type PropsWithChildren,
  useContext,
  useEffect,
  useState,
} from 'react';

import {
  getSupabaseClient,
  hasSupabaseEnvironment,
} from '@/services/supabase/client';
import type { Tables, TablesUpdate } from '@/services/supabase/database.types';
import { invalidateSyncRuns } from '@/services/sync/sync-engine';

type AuthState = {
  isConfigured: boolean;
  isLoading: boolean;
  session: Session | null;
  user: User | null;
  profile: Tables<'profiles'> | null;
  error: string | null;
  retry: () => void;
  completeOnboarding: () => Promise<void>;
  updateProfile: (patch: TablesUpdate<'profiles'>) => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: PropsWithChildren) {
  const isConfigured = hasSupabaseEnvironment();
  const [session, setSession] = useState<Session | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(isConfigured);
  const [isProfileLoading, setIsProfileLoading] = useState(false);
  const [profile, setProfile] = useState<Tables<'profiles'> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [retryToken, setRetryToken] = useState(0);
  const retry = useCallback(() => {
    setError(null);
    setIsAuthLoading(isConfigured);
    setRetryToken((value) => value + 1);
  }, [isConfigured]);

  useEffect(() => {
    if (!isConfigured) {
      return;
    }

    const supabase = getSupabaseClient();
    let mounted = true;

    void (async () => {
      try {
        const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
        if (sessionError) throw sessionError;
        const storedSession = sessionData.session;
        let verifiedSession: Session | null = null;

        if (storedSession) {
          const { data: userData, error: userError } = await supabase.auth.getUser(
            storedSession.access_token,
          );
          if (!userError && userData.user?.id === storedSession.user.id) {
            verifiedSession = { ...storedSession, user: userData.user };
          } else {
            await supabase.auth.signOut({ scope: 'local' });
          }
        }

        if (!mounted) return;
        setError(null);
        setSession(verifiedSession);
        setProfile(null);
        setIsProfileLoading(Boolean(verifiedSession));
      } catch (caught) {
        if (!mounted) return;
        setSession(null);
        setProfile(null);
        setIsProfileLoading(false);
        setError(caught instanceof Error ? caught.message : 'Authentication could not be initialized.');
      } finally {
        if (mounted) setIsAuthLoading(false);
      }
    })();

    const { data } = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (event === 'INITIAL_SESSION') return;
      if (mounted) {
        setError(null);
        setSession(nextSession);
        if (event === 'SIGNED_OUT') {
          invalidateSyncRuns();
          setProfile(null);
          setIsProfileLoading(false);
        } else if (event === 'SIGNED_IN' || event === 'USER_UPDATED') {
          setProfile(null);
          setIsProfileLoading(Boolean(nextSession));
        }
        setIsAuthLoading(false);
      }
    });

    return () => {
      mounted = false;
      data.subscription.unsubscribe();
    };
  }, [isConfigured, retryToken]);

  useEffect(() => {
    if (!isConfigured || !session?.user.id) {
      return;
    }

    const supabase = getSupabaseClient();
    let mounted = true;

    void (async () => {
      try {
        const { data, error: profileError } = await supabase
          .from('profiles')
          .select('*')
          .eq('user_id', session.user.id)
          .maybeSingle();
        if (!mounted) return;
        if (profileError) {
          setError(profileError.message);
          setProfile(null);
          setIsProfileLoading(false);
          return;
        }
        if (!data) {
          const { data: repairedProfile, error: repairError } = await supabase
            .from('profiles')
            .insert({ user_id: session.user.id })
            .select('*')
            .single();
          if (!mounted) return;
          if (repairError) {
            setError(`Your account profile could not be repaired: ${repairError.message}`);
            setProfile(null);
            setIsProfileLoading(false);
            return;
          }
          setError(null);
          setProfile(repairedProfile);
          setIsProfileLoading(false);
          return;
        }
        setError(null);
        setProfile(data);
        setIsProfileLoading(false);
      } catch (caught) {
        if (!mounted) return;
        setError(caught instanceof Error ? caught.message : 'Your profile could not be loaded.');
        setProfile(null);
        setIsProfileLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [isConfigured, retryToken, session?.user.id]);

  const completeOnboarding = async () => {
    if (!session?.user.id) {
      throw new Error('You must be signed in to complete onboarding.');
    }

    const { data, error } = await getSupabaseClient()
      .from('profiles')
      .update({ onboarding_completed_at: new Date().toISOString() })
      .eq('user_id', session.user.id)
      .select('*')
      .single();

    if (error) throw error;
    setProfile(data);
  };

  const updateProfile = async (patch: TablesUpdate<'profiles'>) => {
    if (!session?.user.id) throw new Error('You must be signed in to update your profile.');
    const { data, error: updateError } = await getSupabaseClient()
      .from('profiles')
      .update(patch)
      .eq('user_id', session.user.id)
      .select('*')
      .single();
    if (updateError) throw updateError;
    setProfile(data);
  };

  const value: AuthState = {
    isConfigured,
    isLoading: isAuthLoading || isProfileLoading,
    session,
    user: session?.user ?? null,
    profile,
    error,
    retry,
    completeOnboarding,
    updateProfile,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const value = useContext(AuthContext);
  if (!value) {
    throw new Error('useAuth must be used inside AuthProvider.');
  }
  return value;
}
