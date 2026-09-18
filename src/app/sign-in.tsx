import { router } from 'expo-router';
import { useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, Text, type TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button, Card, Logo } from '@/components/ds';
import { Rubik, ScreenGutter, Type } from '@/constants/theme';
import { useAuth } from '@/features/auth/auth-context';
import {
  type AuthFieldErrors,
  validateEmail,
  validatePassword,
  validatePasswordCredentials,
} from '@/features/auth/auth-credentials';
import { signInWithPassword } from '@/features/auth/auth-service';
import { AuthField } from '@/features/auth/components/auth-field';
import { SocialAuthButtons } from '@/features/auth/components/social-auth-buttons';
import { useAuthSubmission } from '@/features/auth/use-auth-submission';
import { useTheme } from '@/hooks/use-theme';

/** For people who already have an account. New accounts start on /sign-up. */
export default function SignInScreen() {
  const theme = useTheme();
  const { isConfigured } = useAuth();
  const { submit, isSubmitting, errorMessage, clearFeedback } = useAuthSubmission();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fieldErrors, setFieldErrors] = useState<AuthFieldErrors>({});
  const emailInputRef = useRef<TextInput>(null);
  const passwordInputRef = useRef<TextInput>(null);

  const headingStyle = { fontFamily: Rubik.bold, fontSize: 30, lineHeight: 33, letterSpacing: -0.6, color: theme.text };
  const bodyStyle = { fontFamily: Rubik.regular, fontSize: Type.body, lineHeight: Type.body * 1.5, color: theme.textSecondary };

  if (!isConfigured) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }}>
        <View style={{ flex: 1, justifyContent: 'center', paddingHorizontal: ScreenGutter, gap: 20 }}>
          <Logo height={30} />
          <Text style={headingStyle}>HotRocks authentication</Text>
          <Text style={bodyStyle}>
            Add the Supabase project URL and publishable key to the local environment to enable sign in.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  const signIn = () => {
    clearFeedback();
    const errors = validatePasswordCredentials(email, password, 'signIn');
    setFieldErrors(errors);
    if (errors.email) return emailInputRef.current?.focus();
    if (errors.password) return passwordInputRef.current?.focus();
    void submit('signIn', () => signInWithPassword(email, password));
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', paddingHorizontal: ScreenGutter, paddingVertical: 24, gap: 24 }}>
          <View style={{ gap: 20 }}>
            <Logo height={30} />
            <Text accessibilityRole="header" style={headingStyle}>Welcome back</Text>
            <Text style={bodyStyle}>
              HotRocks needs an account. It keeps your sessions backed up and on every device you sign in to.
            </Text>
          </View>

          <SocialAuthButtons intent="signIn" disabled={isSubmitting} onSubmit={(request) => void submit('social', request)} />

          <View style={{ gap: 18 }}>
            <AuthField
              ref={emailInputRef}
              label="Email"
              accessibilityLabel="Email address"
              error={fieldErrors.email}
              autoCapitalize="none"
              autoComplete="email"
              editable={!isSubmitting}
              inputMode="email"
              onChangeText={(value) => {
                setEmail(value);
                clearFeedback();
                if (fieldErrors.email) setFieldErrors((current) => ({ ...current, email: validateEmail(value) }));
              }}
              returnKeyType="next"
              onSubmitEditing={() => passwordInputRef.current?.focus()}
              submitBehavior="submit"
              value={email}
            />
            <AuthField
              ref={passwordInputRef}
              label="Password"
              accessibilityLabel="Password"
              error={fieldErrors.password}
              autoCapitalize="none"
              autoComplete="current-password"
              editable={!isSubmitting}
              onChangeText={(value) => {
                setPassword(value);
                clearFeedback();
                if (fieldErrors.password) setFieldErrors((current) => ({ ...current, password: validatePassword(value, 'signIn') }));
              }}
              onSubmitEditing={signIn}
              returnKeyType="go"
              secureTextEntry
              submitBehavior="submit"
              value={password}
            />
            <Button
              variant="secondary"
              size="sm"
              style={{ alignSelf: 'flex-end', marginTop: -6 }}
              disabled={isSubmitting}
              onPress={() => router.push('/forgot-password')}>
              Forgot password?
            </Button>
          </View>

          <View style={{ gap: 8 }}>
            <Button size="lg" fullWidth loading={isSubmitting} onPress={signIn}>
              Sign in
            </Button>
            {errorMessage ? (
              <Text accessibilityLiveRegion="polite" accessibilityRole="alert" style={{ fontFamily: Rubik.medium, fontSize: Type.small, lineHeight: 21, color: theme.cedar, textAlign: 'center' }}>
                {errorMessage}
              </Text>
            ) : null}
          </View>

          <Card style={{ gap: 12 }}>
            <Text style={{ fontFamily: Rubik.semibold, fontSize: Type.subheading, color: theme.text }}>New to HotRocks?</Text>
            <Button variant="secondary" size="lg" fullWidth disabled={isSubmitting} onPress={() => router.push('/sign-up')}>
              Create an account
            </Button>
          </Card>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
