import { AuthApiError } from '@supabase/supabase-js';
import { describe, expect, test } from '@jest/globals';

import { getAuthErrorMessage } from '../src/features/auth/auth-error-message';

describe('authentication error messages', () => {
  test('translates stable Supabase error codes instead of exposing backend text', () => {
    const error = new AuthApiError('Backend implementation detail', 400, 'invalid_credentials');

    expect(getAuthErrorMessage(error, 'signIn')).toBe('Email or password is incorrect.');
  });

  test('gives actionable feedback for rate limiting and connectivity', () => {
    const rateLimit = new AuthApiError('Rate limit', 429, 'over_request_rate_limit');

    expect(getAuthErrorMessage(rateLimit, 'signIn')).toBe('Too many attempts. Wait a moment and try again.');
    expect(getAuthErrorMessage(new TypeError('Network request failed'), 'signUp'))
      .toBe('Check your internet connection and try again.');
  });

  test('uses action-specific safe fallbacks for unknown failures', () => {
    expect(getAuthErrorMessage(new Error('secret server detail'), 'signUp'))
      .toBe('Account creation could not be completed. Try again.');
    expect(getAuthErrorMessage('unexpected', 'social'))
      .toBe('This sign-in method could not be completed. Try again.');
  });
});
