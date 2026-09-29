import { useCallback, useEffect, useState } from 'react';

import {
  stravaConnectionService,
  type StravaConnection,
} from '../services/strava-connection-service';

/**
 * Screen-ready Strava connection state.
 *
 * The status lives on the server, not in SQLite, because the app is not allowed
 * to hold Strava credentials. It is therefore fetched rather than read from a
 * live query, and refreshed after connecting or disconnecting.
 */
export function useStravaConnection() {
  const [connection, setConnection] = useState<StravaConnection | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [isBusy, setIsBusy] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setConnection(await stravaConnectionService.status());
      setErrorMessage(null);
    } catch {
      // A status that cannot be read is not worth an error banner; the connect
      // button still works and reports its own failures.
      setConnection(null);
    } finally {
      setIsLoaded(true);
    }
  }, []);

  useEffect(() => {
    let active = true;
    void (async () => {
      const next = await stravaConnectionService.status().catch(() => null);
      if (active) {
        setConnection(next);
        setIsLoaded(true);
      }
    })();
    return () => { active = false; };
  }, []);

  /**
   * Runs the browser flow. Returns whether it ended connected, because state
   * set here is not readable by the caller until the next render, and callers
   * need to know now — onboarding must not move on from a failed attempt.
   */
  const connect = useCallback(async (): Promise<boolean> => {
    setIsBusy(true);
    setErrorMessage(null);
    try {
      const outcome = await stravaConnectionService.connect();
      await refresh();
      if (outcome === 'dismissed') {
        setErrorMessage('Strava was not connected. Try again and approve access.');
        return false;
      }
      return true;
    } catch (error) {
      if (__DEV__) console.error('Connecting Strava failed', error);
      setErrorMessage(error instanceof Error ? error.message : 'Could not connect Strava.');
      return false;
    } finally {
      setIsBusy(false);
    }
  }, [refresh]);

  const disconnect = useCallback(async () => {
    setIsBusy(true);
    setErrorMessage(null);
    try {
      await stravaConnectionService.disconnect();
      await refresh();
    } catch (error) {
      if (__DEV__) console.error('Disconnecting Strava failed', error);
      setErrorMessage('Could not disconnect Strava. Try again.');
    } finally {
      setIsBusy(false);
    }
  }, [refresh]);

  return {
    connection,
    isConnected: connection !== null,
    isLoaded,
    isBusy,
    errorMessage,
    connect,
    disconnect,
    refresh,
  };
}
