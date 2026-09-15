import { useState } from 'react';
import { ActivityIndicator, Button, Platform, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useAuth } from '@/features/auth/auth-context';
import {
  requestEmailOtp,
  signInWithApple,
  signInWithGoogle,
  verifyEmailOtp,
} from '@/features/auth/auth-service';

export default function SignInScreen() {
  const { isConfigured } = useAuth();
  const [step, setStep] = useState<'email' | 'otp'>('email');
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
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

          {step === 'email' ? (
            <>
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
              <Button
                title="Email me a code"
                disabled={isSubmitting || email.trim().length === 0}
                onPress={() => void submit(async () => {
                  await requestEmailOtp(email);
                  setStep('otp');
                })}
              />
            </>
          ) : (
            <>
              <ThemedText>Code sent to {email.trim().toLowerCase()}</ThemedText>
              <TextInput
                accessibilityLabel="Six-digit sign-in code"
                autoComplete="one-time-code"
                editable={!isSubmitting}
                inputMode="numeric"
                maxLength={6}
                onChangeText={setOtp}
                style={styles.input}
                value={otp}
              />
              <Button
                title="Verify code"
                disabled={isSubmitting || otp.trim().length !== 6}
                onPress={() => void submit(() => verifyEmailOtp(email, otp))}
              />
              <Button title="Use a different email" disabled={isSubmitting} onPress={() => {
                setOtp('');
                setStep('email');
              }} />
            </>
          )}

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
