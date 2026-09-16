import { type PropsWithChildren, useEffect } from 'react';
import { AppState } from 'react-native';

import { useAuth } from '@/features/auth/auth-context';
import { requestSync } from '@/services/sync/sync-engine';

const ACTIVE_RETRY_INTERVAL_MS = 30_000;

export function SyncProvider({ children }: PropsWithChildren) {
  const { user } = useAuth();

  useEffect(() => {
    if (!user) return;

    const sync = () => void requestSync(user.id);
    sync();

    const appState = AppState.addEventListener('change', (state) => {
      if (state === 'active') sync();
    });
    const interval = setInterval(() => {
      if (AppState.currentState === 'active') sync();
    }, ACTIVE_RETRY_INTERVAL_MS);

    return () => {
      appState.remove();
      clearInterval(interval);
    };
  }, [user]);

  return children;
}
