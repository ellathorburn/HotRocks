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
import { profileService } from '@/features/profiles/services/profile-service';
import type { Profile, ProfileUpdate } from '@/features/profiles/types/profile-types';
import type { PersonName } from '@/features/auth/auth-credentials';
import { invalidateSyncRuns } from '@/services/sync/sync-engine';

/**
 * UI-facing auth state. Profile persistence is delegated to profileService.
 */
type AuthState = {
  isConfigured: boolean;
  isLoading: boolean;
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  error: string | null;
  retry: () => void;
  completeOnboarding: () => Promise<void>;
  updateProfile: (patch: ProfileUpdate) => Promise<void>;
  updateName: (name: PersonName) => Promise<void>;
  /** True after a password-reset link signs the person in, until they set a new password. */
  isPasswordRecovery: boolean;
  finishPasswordRecovery: () => void;
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: PropsWithChildren) {
  const isConfigured = hasSupabaseEnvironment();
  const [session, setSession] = useState<Session | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(isConfigured);
  const [isProfileLoading, setIsProfileLoading] = useState(false);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [retryToken, setRetryToken] = useState(0);
  const [isPasswordRecovery, setIsPasswordRecovery] = useState(false);
  const finishPasswordRecovery = useCallback(() => setIsPasswordRecovery(false), []);
  const retry = useCallback(() => {
    setError(null);
    setIsAuthLoading(isConfigured);
    setRetryToken((value) => value + 1);
  }, [isConfigured]);

  /** Initializes the verified Supabase auth session and auth event listener. */
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
        if (event === 'PASSWORD_RECOVERY') setIsPasswordRecovery(true);
        if (event === 'SIGNED_OUT') {
          setIsPasswordRecovery(false);
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

  /**
   * Profile [READ], with a [CREATE] repair fallback for older/incomplete
   * accounts, delegated to profileService.
   */
  useEffect(() => {
    if (!isConfigured || !session?.user.id) {
      return;
    }

    let mounted = true;

    void (async () => {
      try {
        const data = await profileService.getOrCreate(session.user.id);
        if (!mounted) return;
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

  /** Profile [UPDATE]: records that the signed-in user finished onboarding. */
  const completeOnboarding = async () => {
    if (!session?.user.id) {
      throw new Error('You must be signed in to complete onboarding.');
    }

    setProfile(await profileService.completeOnboarding(session.user.id));
  };

  /** Profile [UPDATE]: applies an allowed generated Supabase profile patch. */
  const updateProfile = async (patch: ProfileUpdate) => {
    if (!session?.user.id) throw new Error('You must be signed in to update your profile.');
    setProfile(await profileService.update(session.user.id, patch));
  };

  /** Profile [UPDATE]: validated first name and surname. */
  const updateName = async (name: PersonName) => {
    if (!session?.user.id) throw new Error('You must be signed in to update your name.');
    setProfile(await profileService.updateName(session.user.id, name));
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
    updateName,
    isPasswordRecovery,
    finishPasswordRecovery,
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
