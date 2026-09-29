import type { Provider } from '@supabase/supabase-js';
import * as AppleAuthentication from 'expo-apple-authentication';
import { makeRedirectUri } from 'expo-auth-session';
import * as Crypto from 'expo-crypto';
import * as WebBrowser from 'expo-web-browser';
import { Platform } from 'react-native';

import { APP_SCHEME, AUTH_CALLBACK_PATH } from '@/config/app';
import {
  normalizePersonName,
  type PersonName,
  validateEmail,
  validateNewAccountCredentials,
  validatePassword,
} from '@/features/auth/auth-credentials';
import { profileService } from '@/features/profiles/services/profile-service';
import { purgeLocalAccountData } from '@/services/database/account-data';
import { getSupabaseClient } from '@/services/supabase/client';
import { invalidateSyncRuns } from '@/services/sync/sync-engine';

WebBrowser.maybeCompleteAuthSession();

export type AuthAttempt = 'authenticated' | 'cancelled';

export const authRedirectUri = makeRedirectUri({
  scheme: APP_SCHEME,
  path: AUTH_CALLBACK_PATH,
});

export async function finishOAuthRedirect(url: string): Promise<void> {
  const redirect = new URL(url);
  const errorDescription = redirect.searchParams.get('error_description');
  if (errorDescription) {
    throw new Error(errorDescription);
  }

  const code = redirect.searchParams.get('code');
  if (!code) {
    throw new Error('The identity provider returned no authorization code.');
  }

  const { error } = await getSupabaseClient().auth.exchangeCodeForSession(code);
  if (error) {
    throw error;
  }
}

async function signInWithBrowserProvider(
  provider: Provider,
): Promise<AuthAttempt> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider,
    options: {
      redirectTo: authRedirectUri,
      skipBrowserRedirect: true,
    },
  });

  if (error) {
    throw error;
  }
  if (!data.url) {
    throw new Error('The identity provider returned no sign-in URL.');
  }

  if (Platform.OS === 'web') {
    window.location.assign(data.url);
    return 'authenticated';
  }

  const response = await WebBrowser.openAuthSessionAsync(
    data.url,
    authRedirectUri,
  );
  if (response.type !== 'success') {
    return 'cancelled';
  }

  await finishOAuthRedirect(response.url);
  return 'authenticated';
}

export function signInWithGoogle(): Promise<AuthAttempt> {
  return signInWithBrowserProvider('google');
}

export async function signInWithApple(): Promise<AuthAttempt> {
  if (Platform.OS !== 'ios') {
    return signInWithBrowserProvider('apple');
  }

  if (!(await AppleAuthentication.isAvailableAsync())) {
    throw new Error('Sign in with Apple is unavailable on this device.');
  }

  const rawNonce = Crypto.randomUUID();
  const hashedNonce = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    rawNonce,
  );

  let credential: AppleAuthentication.AppleAuthenticationCredential;
  try {
    credential = await AppleAuthentication.signInAsync({
      nonce: hashedNonce,
      requestedScopes: [
        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
        AppleAuthentication.AppleAuthenticationScope.EMAIL,
      ],
    });
  } catch (error) {
    if (
      error instanceof Error &&
      'code' in error &&
      error.code === 'ERR_REQUEST_CANCELED'
    ) {
      return 'cancelled';
    }
    throw error;
  }

  if (!credential.identityToken) {
    throw new Error('Apple returned no identity token.');
  }

  const supabase = getSupabaseClient();
  const { data, error } = await supabase.auth.signInWithIdToken({
    provider: 'apple',
    token: credential.identityToken,
    nonce: rawNonce,
    access_token: credential.authorizationCode ?? undefined,
  });
  if (error) {
    throw error;
  }

  // Apple shares the name only on the first authorization, after the account
  // (and its profile) already exists, so fill in any name the profile lacks.
  const firstName = credential.fullName?.givenName?.trim() ?? '';
  const lastName = credential.fullName?.familyName?.trim() ?? '';
  if (firstName && lastName && data.user) {
    await profileService.fillMissingName(data.user.id, { firstName, lastName });
  }

  return 'authenticated';
}

export async function requestEmailOtp(email: string): Promise<void> {
  const { error } = await getSupabaseClient().auth.signInWithOtp({
    email: email.trim().toLowerCase(),
    options: { shouldCreateUser: true },
  });
  if (error) {
    throw error;
  }
}

export async function verifyEmailOtp(
  email: string,
  token: string,
): Promise<void> {
  const { error } = await getSupabaseClient().auth.verifyOtp({
    email: email.trim().toLowerCase(),
    token: token.trim(),
    type: 'email',
  });
  if (error) {
    throw error;
  }
}

export async function signInWithPassword(
  email: string,
  password: string,
): Promise<void> {
  const { error } = await getSupabaseClient().auth.signInWithPassword({
    email: email.trim().toLowerCase(),
    password,
  });
  if (error) throw error;
}

/**
 * Creates an email account. The name travels as sign-up metadata so the
 * database trigger can seed the profile even before the email is confirmed.
 */
export async function createAccountWithPassword(
  name: PersonName,
  email: string,
  password: string,
): Promise<'authenticated' | 'confirmationRequired'> {
  const { firstName, lastName } = normalizePersonName(name);
  validateNewAccountCredentials(email, password);
  const { data, error } = await getSupabaseClient().auth.signUp({
    email: email.trim().toLowerCase(),
    password,
    options: { data: { first_name: firstName, last_name: lastName } },
  });
  if (error) throw error;
  return data.session ? 'authenticated' : 'confirmationRequired';
}

/**
 * Emails a password-reset link. The link returns to the auth callback, where
 * the code exchange signs the person in and emits PASSWORD_RECOVERY; the
 * navigator then shows only the new-password screen. The PKCE verifier lives
 * on this device, so the link must be opened here.
 */
export async function requestPasswordReset(email: string): Promise<void> {
  const emailError = validateEmail(email);
  if (emailError) throw new Error(emailError);
  const { error } = await getSupabaseClient().auth.resetPasswordForEmail(
    email.trim().toLowerCase(),
    { redirectTo: authRedirectUri },
  );
  if (error) throw error;
}

export async function updatePassword(password: string): Promise<void> {
  const passwordError = validatePassword(password, 'signUp');
  if (passwordError) throw new Error(passwordError);
  const { error } = await getSupabaseClient().auth.updateUser({ password });
  if (error) throw error;
}

/**
 * Signs this device out and purges the account's local data.
 *
 * Revoking the session on the server needs both a valid session and a reachable
 * network, and neither is guaranteed: the account may already have been deleted
 * elsewhere, or the device may be offline. Signing out is a local intent, so a
 * failed revoke must still clear this device. Failing early would leave the
 * person signed in to an account they cannot use, with their data unpurged.
 */
export async function signOut(userId?: string): Promise<void> {
  invalidateSyncRuns();
  const supabase = getSupabaseClient();

  const { error } = await supabase.auth.signOut();
  if (error) {
    if (__DEV__) console.warn('Server sign-out failed; clearing this device anyway', error);
    // A local-scope sign-out touches no network and cannot be refused.
    await supabase.auth.signOut({ scope: 'local' }).catch(() => undefined);
  }

  if (userId) purgeLocalAccountData(userId);
}

export async function deleteAccount(userId: string): Promise<void> {
  invalidateSyncRuns();
  const supabase = getSupabaseClient();
  const { error } = await supabase.functions.invoke('delete-account', {
    body: { confirmation: 'DELETE' },
  });
  if (error) {
    throw error;
  }

  await supabase.auth.signOut({ scope: 'local' });
  purgeLocalAccountData(userId);
}
