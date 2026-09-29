import { describe, expect, test } from '@jest/globals';
import {
  AuthApiError,
  AuthRetryableFetchError,
  AuthSessionMissingError,
  type User,
} from '@supabase/supabase-js';

import { decideStoredSession } from '@/features/auth/session-verification';

const STORED_USER_ID = 'user-1';

const userFixture = (id: string): User => ({
  id,
  app_metadata: {},
  user_metadata: {},
  aud: 'authenticated',
  created_at: '2026-09-01T00:00:00.000Z',
}) as User;

describe('deciding what to do with a stored session', () => {
  test('a confirmed account is verified, using the server copy of the user', () => {
    const user = userFixture(STORED_USER_ID);

    const decision = decideStoredSession({ storedUserId: STORED_USER_ID, user, error: null });

    expect(decision).toEqual({ outcome: 'verified', user });
  });

  test('an unreachable server keeps the session so the app opens offline', () => {
    // HotRocks reads every session screen from SQLite. Being signed out by a
    // flaky network would hide data that is already on the device.
    const decision = decideStoredSession({
      storedUserId: STORED_USER_ID,
      user: null,
      error: new AuthRetryableFetchError('Network request failed', 0),
    });

    expect(decision).toEqual({ outcome: 'unverified' });
  });

  test('a deleted account is rejected', () => {
    const decision = decideStoredSession({
      storedUserId: STORED_USER_ID,
      user: null,
      error: new AuthApiError('User from sub claim in JWT does not exist', 403, 'user_not_found'),
    });

    expect(decision).toEqual({ outcome: 'rejected' });
  });

  test('an invalid token is rejected', () => {
    const decision = decideStoredSession({
      storedUserId: STORED_USER_ID,
      user: null,
      error: new AuthApiError('invalid claim', 401, 'bad_jwt'),
    });

    expect(decision).toEqual({ outcome: 'rejected' });
  });

  test('a missing session is rejected', () => {
    const decision = decideStoredSession({
      storedUserId: STORED_USER_ID,
      user: null,
      error: new AuthSessionMissingError(),
    });

    expect(decision).toEqual({ outcome: 'rejected' });
  });

  test('a session for a different user is rejected even without an error', () => {
    // Guards against applying one account's session to another's stored data.
    const decision = decideStoredSession({
      storedUserId: STORED_USER_ID,
      user: userFixture('somebody-else'),
      error: null,
    });

    expect(decision).toEqual({ outcome: 'rejected' });
  });

  test('no user and no error is rejected rather than trusted', () => {
    const decision = decideStoredSession({
      storedUserId: STORED_USER_ID,
      user: null,
      error: null,
    });

    expect(decision).toEqual({ outcome: 'rejected' });
  });

  test('a server error takes precedence over a matching user id', () => {
    const decision = decideStoredSession({
      storedUserId: STORED_USER_ID,
      user: userFixture(STORED_USER_ID),
      error: new AuthApiError('revoked', 401, 'session_not_found'),
    });

    expect(decision).toEqual({ outcome: 'rejected' });
  });
});
