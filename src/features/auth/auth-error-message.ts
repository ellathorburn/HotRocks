import { isAuthApiError } from '@supabase/supabase-js';

export type AuthAction = 'signIn' | 'signUp' | 'social' | 'passwordReset';

const ERROR_MESSAGES: Record<string, string> = {
  email_address_invalid: 'Enter a valid email address.',
  email_not_confirmed: 'Confirm your email before signing in.',
  invalid_credentials: 'Email or password is incorrect.',
  over_email_send_rate_limit: 'Too many emails were requested. Wait a moment and try again.',
  over_request_rate_limit: 'Too many attempts. Wait a moment and try again.',
  provider_disabled: 'This sign-in method is currently unavailable.',
  signup_disabled: 'Account creation is temporarily unavailable.',
  user_already_exists: 'Unable to create this account. Try signing in or use a different email.',
  validation_failed: 'Check your email and password, then try again.',
  weak_password: 'Choose a stronger password and try again.',
};

function isNetworkError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  return /failed to fetch|network request failed|network error/i.test(error.message);
}

export function getAuthErrorMessage(error: unknown, action: AuthAction): string {
  if (isNetworkError(error)) {
    return 'Check your internet connection and try again.';
  }

  if (isAuthApiError(error) && error.code) {
    const knownMessage = ERROR_MESSAGES[error.code];
    if (knownMessage) return knownMessage;
  }

  if (action === 'signUp') {
    return 'Account creation could not be completed. Try again.';
  }
  if (action === 'passwordReset') {
    return 'The password could not be reset. Try again.';
  }
  if (action === 'social') {
    return 'This sign-in method could not be completed. Try again.';
  }
  return 'Sign in could not be completed. Try again.';
}
