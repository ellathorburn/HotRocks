import { describe, expect, test } from '@jest/globals';

import {
  hasPasswordCredentials,
  MIN_PASSWORD_LENGTH,
  normalizePersonName,
  validatePersonName,
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

describe('person name input', () => {
  test('requires a first name and surname and trims them for storage', () => {
    expect(validatePersonName({ firstName: ' ', lastName: '' })).toEqual({
      firstName: 'Enter your first name.',
      lastName: 'Enter your surname.',
    });
    expect(normalizePersonName({ firstName: '  Ella ', lastName: 'Thorburn ' }))
      .toEqual({ firstName: 'Ella', lastName: 'Thorburn' });
  });

  test('matches the database length limit', () => {
    expect(validatePersonName({ firstName: 'a'.repeat(81), lastName: 'Lee' }).firstName)
      .toBe('Keep it under 80 characters.');
  });
});
