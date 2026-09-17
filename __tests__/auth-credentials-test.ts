import { describe, expect, test } from '@jest/globals';

import {
  hasPasswordCredentials,
  MIN_PASSWORD_LENGTH,
  validateEmail,
  validateNewAccountCredentials,
  validatePasswordCredentials,
} from '../src/features/auth/auth-credentials';

describe('password authentication input', () => {
  test('allows the form action as soon as both fields contain input', () => {
    expect(hasPasswordCredentials('person@example.com', 'x')).toBe(true);
  });

  test('matches the configured Supabase minimum for new accounts', () => {
    expect(MIN_PASSWORD_LENGTH).toBe(6);
    expect(() => validateNewAccountCredentials('person@example.com', '12345'))
      .toThrow('Password must be at least 6 characters.');
    expect(() => validateNewAccountCredentials('person@example.com', '123456'))
      .not.toThrow();
  });

  test('returns field-specific messages for missing and malformed input', () => {
    expect(validatePasswordCredentials('', '', 'signUp')).toEqual({
      email: 'Enter your email address.',
      password: 'Enter your password.',
    });
    expect(validateEmail('not-an-email')).toBe('Enter a valid email address.');
  });

  test('does not apply the sign-up minimum to an existing account sign-in', () => {
    expect(validatePasswordCredentials('person@example.com', 'x', 'signIn')).toEqual({});
    expect(validatePasswordCredentials('person@example.com', '12345', 'signUp')).toEqual({
      password: 'Password must be at least 6 characters.',
    });
  });
});
