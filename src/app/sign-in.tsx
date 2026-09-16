import { useState } from 'react';
import { ActivityIndicator, Button, Platform, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useAuth } from '@/features/auth/auth-context';
import {
  createAccountWithPassword,
  signInWithApple,
  signInWithGoogle,
  signInWithPassword,
} from '@/features/auth/auth-service';

export default function SignInScreen() {
  const { isConfigured } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function submit(action: () => Promise<unknown>) {
    setErrorMessage(null);
    setIsSubmitting(true);
    try {
      await action();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Sign in could not be completed.');
    } finally {
      setIsSubmitting(false);
    }
  }

  if (!isConfigured) {
    return (
      <ThemedView style={styles.fill}>
        <SafeAreaView style={styles.container}>
          <ThemedText type="title">HotRocks authentication</ThemedText>
          <ThemedText themeColor="textSecondary">
            Add the Supabase project URL and publishable key to the local environment to enable sign in.
          </ThemedText>
        </SafeAreaView>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.fill}>
      <SafeAreaView style={styles.container}>
        <View style={styles.heading}>
          <ThemedText type="title">Sign in to HotRocks</ThemedText>
          <ThemedText themeColor="textSecondary">
            Your sessions stay attached to your account across devices.
          </ThemedText>
        </View>

        <View style={styles.actions}>
          {Platform.OS !== 'android' && (
            <Button title="Continue with Apple" disabled={isSubmitting} onPress={() => void submit(signInWithApple)} />
          )}
          <Button title="Continue with Google" disabled={isSubmitting} onPress={() => void submit(signInWithGoogle)} />

          <ThemedText>Email</ThemedText>
          <TextInput
            accessibilityLabel="Email address"
            autoCapitalize="none"
            autoComplete="email"
            editable={!isSubmitting}
            inputMode="email"
            onChangeText={setEmail}
            style={styles.input}
            value={email}
          />
          <ThemedText>Password</ThemedText>
          <TextInput
            accessibilityLabel="Password"
            autoCapitalize="none"
            autoComplete="password"
            editable={!isSubmitting}
            onChangeText={setPassword}
            secureTextEntry
            style={styles.input}
            value={password}
          />
          <Button
            title="Sign in"
            disabled={isSubmitting || email.trim().length === 0 || password.length < 8}
            onPress={() => void submit(() => signInWithPassword(email, password))}
          />
          <Button
            title="Create account"
            disabled={isSubmitting || email.trim().length === 0 || password.length < 8}
            onPress={() => void submit(() => createAccountWithPassword(email, password))}
          />

          {isSubmitting && <ActivityIndicator />}
          {errorMessage && <ThemedText>{errorMessage}</ThemedText>}
        </View>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  container: { flex: 1, justifyContent: 'center', paddingHorizontal: 24, gap: 32 },
  heading: { gap: 8 },
  actions: { gap: 16 },
  input: { minHeight: 48, borderWidth: StyleSheet.hairlineWidth, paddingHorizontal: 16 },
});
