import * as Linking from 'expo-linking';
import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet } from 'react-native';

import { Button } from '@/components/ds';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { finishOAuthRedirect } from '@/features/auth/auth-service';

export default function AuthCallbackScreen() {
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  const completeSignIn = useCallback(async () => {
    try {
      const url = await Linking.getInitialURL();
      if (!url) throw new Error('The sign-in callback URL is unavailable.');
      await finishOAuthRedirect(url);
      router.replace('/');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Sign in could not be completed.');
    }
  }, []);

  useEffect(() => {
    const timeout = setTimeout(() => void completeSignIn(), 0);
    return () => clearTimeout(timeout);
  }, [attempt, completeSignIn]);

  return (
    <ThemedView style={styles.container}>
      {error ? (
        <>
          <ThemedText type="subtitle">Sign in was not completed</ThemedText>
          <ThemedText themeColor="textSecondary" style={styles.message}>{error}</ThemedText>
          <Button onPress={() => {
            setError(null);
            setAttempt((value) => value + 1);
          }}>
            Try callback again
          </Button>
          <Button variant="ghost" onPress={() => router.replace('/sign-in')}>Back to sign in</Button>
        </>
      ) : (
        <>
          <ActivityIndicator accessibilityLabel="Completing sign in" />
          <ThemedText themeColor="textSecondary">Completing sign in…</ThemedText>
        </>
      )}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16, paddingHorizontal: 24 },
  message: { textAlign: 'center' },
});
