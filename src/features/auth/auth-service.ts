import type { Provider } from '@supabase/supabase-js';
import * as AppleAuthentication from 'expo-apple-authentication';
import { makeRedirectUri } from 'expo-auth-session';
import * as Crypto from 'expo-crypto';
import * as WebBrowser from 'expo-web-browser';
import { Platform } from 'react-native';

import { getSupabaseClient } from '@/services/supabase/client';

WebBrowser.maybeCompleteAuthSession();

export type AuthAttempt = 'authenticated' | 'cancelled';

export const authRedirectUri = makeRedirectUri({
  scheme: 'hotrocks',
  path: 'auth/callback',
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

  const displayName = credential.fullName
    ? AppleAuthentication.formatFullName(credential.fullName, 'default').trim()
    : '';

  if (displayName && data.user) {
    const { error: metadataError } = await supabase.auth.updateUser({
      data: { full_name: displayName },
    });
    if (metadataError) throw metadataError;
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

export async function signOut(): Promise<void> {
  const { error } = await getSupabaseClient().auth.signOut();
  if (error) {
    throw error;
  }
}

export async function deleteAccount(): Promise<void> {
  const supabase = getSupabaseClient();
  const { error } = await supabase.functions.invoke('delete-account', {
    body: { confirmation: 'DELETE' },
  });
  if (error) {
    throw error;
  }

  await supabase.auth.signOut({ scope: 'local' });
}
