import type { Session, User } from '@supabase/supabase-js';
import * as Linking from 'expo-linking';
import { router } from 'expo-router';
import {
  createContext,
  type PropsWithChildren,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { Platform } from 'react-native';

import { finishOAuthRedirect } from './auth-service';
import {
  getSupabaseClient,
  hasSupabaseEnvironment,
} from '@/services/supabase/client';

type AuthState = {
  isConfigured: boolean;
  isLoading: boolean;
  session: Session | null;
  user: User | null;
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: PropsWithChildren) {
  const isConfigured = hasSupabaseEnvironment();
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(isConfigured);

  useEffect(() => {
    if (!isConfigured) {
      return;
    }

    const supabase = getSupabaseClient();
    let mounted = true;

    void supabase.auth.getSession().then(({ data, error }) => {
      if (!mounted) return;
      setSession(error ? null : data.session);
      setIsLoading(false);
    });

    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (mounted) {
        setSession(nextSession);
        setIsLoading(false);
      }
    });

    return () => {
      mounted = false;
      data.subscription.unsubscribe();
    };
  }, [isConfigured]);

  useEffect(() => {
    if (!isConfigured || Platform.OS !== 'web') return;

    void Linking.getInitialURL().then(async (url) => {
      if (!url || !new URL(url).searchParams.has('code')) return;
      try {
        await finishOAuthRedirect(url);
        router.replace('/');
      } catch {
        setSession(null);
        setIsLoading(false);
      }
    });
  }, [isConfigured]);

  const value = useMemo<AuthState>(
    () => ({
      isConfigured,
      isLoading,
      session,
      user: session?.user ?? null,
    }),
    [isConfigured, isLoading, session],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const value = useContext(AuthContext);
  if (!value) {
    throw new Error('useAuth must be used inside AuthProvider.');
  }
  return value;
}
