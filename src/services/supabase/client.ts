import 'react-native-url-polyfill/auto';

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { AppState, Platform } from 'react-native';
import { z } from 'zod';

import { authStorage } from './auth-storage';
import type { Database } from './database.types';

const clientEnvironmentSchema = z.object({
  url: z.url(),
  publishableKey: z.string().min(1),
});

let client: SupabaseClient<Database> | undefined;
let appStateSubscription: ReturnType<typeof AppState.addEventListener> | undefined;

export function getSupabaseClient(): SupabaseClient<Database> {
  if (client) {
    return client;
  }

  const environment = clientEnvironmentSchema.parse({
    url: process.env.EXPO_PUBLIC_SUPABASE_URL,
    publishableKey: process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  });

  client = createClient<Database>(environment.url, environment.publishableKey, {
    auth: {
      storage: authStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
      flowType: 'pkce',
    },
  });

  if (Platform.OS !== 'web' && !appStateSubscription) {
    appStateSubscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        client?.auth.startAutoRefresh();
      } else {
        client?.auth.stopAutoRefresh();
      }
    });
  }

  return client;
}

export function hasSupabaseEnvironment(): boolean {
  return clientEnvironmentSchema.safeParse({
    url: process.env.EXPO_PUBLIC_SUPABASE_URL,
    publishableKey: process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  }).success;
}
