import type { Session, User } from '@supabase/supabase-js';
import * as Linking from 'expo-linking';
import { router } from 'expo-router';
import {
  createContext,
  type PropsWithChildren,
  useContext,
  useEffect,
  useState,
} from 'react';
import { Platform } from 'react-native';

import { finishOAuthRedirect } from './auth-service';
import {
  getSupabaseClient,
  hasSupabaseEnvironment,
} from '@/services/supabase/client';
import type { Tables } from '@/services/supabase/database.types';

type AuthState = {
  isConfigured: boolean;
  isLoading: boolean;
  session: Session | null;
  user: User | null;
  profile: Tables<'profiles'> | null;
  completeOnboarding: () => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: PropsWithChildren) {
  const isConfigured = hasSupabaseEnvironment();
  const [session, setSession] = useState<Session | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(isConfigured);
  const [isProfileLoading, setIsProfileLoading] = useState(false);
  const [profile, setProfile] = useState<Tables<'profiles'> | null>(null);

  useEffect(() => {
    if (!isConfigured) {
      return;
    }

    const supabase = getSupabaseClient();
    let mounted = true;

    void supabase.auth.getSession().then(({ data, error }) => {
      if (!mounted) return;
      const nextSession = error ? null : data.session;
      setSession(nextSession);
      setProfile(null);
      setIsProfileLoading(Boolean(nextSession));
      setIsAuthLoading(false);
    });

    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (mounted) {
        setSession(nextSession);
        setProfile(null);
        setIsProfileLoading(Boolean(nextSession));
        setIsAuthLoading(false);
      }
    });

    return () => {
      mounted = false;
      data.subscription.unsubscribe();
    };
  }, [isConfigured]);

  useEffect(() => {
    if (!isConfigured || !session?.user.id) {
      return;
    }

    const supabase = getSupabaseClient();
    let mounted = true;

    void supabase
      .from('profiles')
      .select('*')
      .eq('user_id', session.user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (!mounted) return;
        setProfile(data);
        setIsProfileLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, [isConfigured, session?.user.id]);

  useEffect(() => {
    if (!isConfigured || Platform.OS !== 'web') return;

    void Linking.getInitialURL().then(async (url) => {
      if (!url || !new URL(url).searchParams.has('code')) return;
      try {
        await finishOAuthRedirect(url);
        router.replace('/');
      } catch {
        setSession(null);
        setIsAuthLoading(false);
      }
    });
  }, [isConfigured]);

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

  const value: AuthState = {
    isConfigured,
    isLoading: isAuthLoading || isProfileLoading,
    session,
    user: session?.user ?? null,
    profile,
    completeOnboarding,
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
