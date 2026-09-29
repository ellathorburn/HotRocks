import { isAuthRetryableFetchError, type AuthError, type User } from '@supabase/supabase-js';

/**
 * What to do with a session restored from device storage.
 *
 * The server is asked whether the stored session is still real, because an
 * account can be deleted or revoked from elsewhere. But "the server said no"
 * and "the server could not be reached" are different answers, and only the
 * first is evidence about the account.
 *
 * HotRocks is local-first: every session screen reads SQLite, and a save is
 * complete once its local transaction commits. Treating an unreachable server
 * as a rejection would sign people out whenever they opened the app offline
 * and cut them off from data that is sitting on the device.
 */
export type StoredSessionDecision =
  /** The server confirmed the account; use the user it returned. */
  | { outcome: 'verified'; user: User }
  /** The server was unreachable; keep the stored session and work offline. */
  | { outcome: 'unverified' }
  /** The server rejected the session, or it is for another user; sign out. */
  | { outcome: 'rejected' };

export function decideStoredSession({
  storedUserId,
  user,
  error,
}: {
  storedUserId: string;
  user: User | null;
  error: AuthError | null;
}): StoredSessionDecision {
  if (!error && user?.id === storedUserId) {
    return { outcome: 'verified', user };
  }

  // A retryable fetch failure is a network problem, not a verdict on the
  // account, so the stored session stands until the server actually answers.
  if (error && isAuthRetryableFetchError(error)) {
    return { outcome: 'unverified' };
  }

  // Anything else is authoritative: the account is gone, the token is invalid,
  // or the session belongs to a different user than the one stored.
  return { outcome: 'rejected' };
}
