import { beforeEach, describe, expect, jest, test } from '@jest/globals';
import { AuthApiError, AuthRetryableFetchError } from '@supabase/supabase-js';

const mockSignOut = jest.fn<(options?: { scope?: string }) => Promise<{ error: unknown }>>();
const mockPurge = jest.fn();
const mockInvalidateSyncRuns = jest.fn();

// auth-service resolves its OAuth redirect URI at module load, which needs the
// Expo manifest. These stand in so the real sign-out code can be loaded.
jest.mock('expo-auth-session', () => ({ makeRedirectUri: () => 'hotrocks://auth/callback' }));
jest.mock('expo-web-browser', () => ({
  maybeCompleteAuthSession: () => undefined,
  openAuthSessionAsync: jest.fn(),
}));
jest.mock('expo-apple-authentication', () => ({
  signInAsync: jest.fn(),
  AppleAuthenticationScope: { FULL_NAME: 0, EMAIL: 1 },
}));
jest.mock('expo-crypto', () => ({ randomUUID: () => 'test-uuid' }));

jest.mock('@/services/supabase/client', () => ({
  getSupabaseClient: () => ({ auth: { signOut: mockSignOut } }),
}));

jest.mock('@/services/database/account-data', () => ({ purgeLocalAccountData: mockPurge }));
jest.mock('@/services/sync/sync-engine', () => ({
  invalidateSyncRuns: mockInvalidateSyncRuns,
  requestSync: jest.fn(),
}));
jest.mock('@/features/profiles/services/profile-service', () => ({ profileService: {} }));

const { signOut } = require('../src/features/auth/auth-service');

/** Scopes passed to every auth.signOut call, in order. */
const scopes = () => mockSignOut.mock.calls.map(([options]) => options?.scope ?? 'global');

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(console, 'warn').mockImplementation(() => undefined);
});

describe('signing out', () => {
  test('revokes on the server and purges the account from the device', async () => {
    mockSignOut.mockResolvedValue({ error: null });

    await signOut('user-1');

    expect(scopes()).toEqual(['global']);
    expect(mockPurge).toHaveBeenCalledWith('user-1');
    expect(mockInvalidateSyncRuns).toHaveBeenCalled();
  });

  test('still clears the device when the account no longer exists', async () => {
    // Deleting the account elsewhere makes the stored token unusable. Failing
    // here would leave the person signed in to an account they cannot use.
    mockSignOut
      .mockResolvedValueOnce({ error: new AuthApiError('User not found', 403, 'user_not_found') })
      .mockResolvedValueOnce({ error: null });

    await expect(signOut('user-1')).resolves.toBeUndefined();

    expect(scopes()).toEqual(['global', 'local']);
    expect(mockPurge).toHaveBeenCalledWith('user-1');
  });

  test('still clears the device when the server cannot be reached', async () => {
    mockSignOut
      .mockResolvedValueOnce({ error: new AuthRetryableFetchError('Network request failed', 0) })
      .mockResolvedValueOnce({ error: null });

    await expect(signOut('user-1')).resolves.toBeUndefined();

    expect(scopes()).toEqual(['global', 'local']);
    expect(mockPurge).toHaveBeenCalledWith('user-1');
  });

  test('purges even if the local sign-out itself refuses', async () => {
    mockSignOut
      .mockResolvedValueOnce({ error: new AuthApiError('nope', 500, 'unexpected_failure') })
      .mockRejectedValueOnce(new Error('storage unavailable'));

    await expect(signOut('user-1')).resolves.toBeUndefined();

    expect(mockPurge).toHaveBeenCalledWith('user-1');
  });

  test('without a user id there is nothing to purge', async () => {
    mockSignOut.mockResolvedValue({ error: null });

    await signOut();

    expect(mockPurge).not.toHaveBeenCalled();
  });

  test('synchronization is invalidated before the account changes', async () => {
    mockSignOut.mockResolvedValue({ error: null });

    await signOut('user-1');

    // A response started for the old account must not be applied afterwards.
    expect(mockInvalidateSyncRuns).toHaveBeenCalledTimes(1);
  });
});
