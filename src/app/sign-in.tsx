import { useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button, Input, Label, Logo } from '@/components/ds';
import { Rubik, ScreenGutter, Type } from '@/constants/theme';
import { useAuth } from '@/features/auth/auth-context';
import {
  type AuthFieldErrors,
  hasPasswordCredentials,
  validateEmail,
  validatePassword,
  validatePasswordCredentials,
  type PasswordAuthMode,
} from '@/features/auth/auth-credentials';
import { type AuthAction, getAuthErrorMessage } from '@/features/auth/auth-error-message';
import {
  createAccountWithPassword,
  signInWithApple,
  signInWithGoogle,
  signInWithPassword,
} from '@/features/auth/auth-service';
import { useTheme } from '@/hooks/use-theme';

export default function SignInScreen() {
  const theme = useTheme();
  const { isConfigured } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<AuthFieldErrors>({});
  const [touched, setTouched] = useState({ email: false, password: false });
  const [passwordValidationMode, setPasswordValidationMode] = useState<PasswordAuthMode>('signIn');
  const emailInputRef = useRef<TextInput>(null);
  const passwordInputRef = useRef<TextInput>(null);
  const submissionInProgress = useRef(false);

  async function submit(actionType: AuthAction, action: () => Promise<unknown>) {
    if (submissionInProgress.current) return;
    submissionInProgress.current = true;
    setErrorMessage(null);
    setNotice(null);
    setIsSubmitting(true);
    try {
      await action();
    } catch (error) {
      if (__DEV__) console.error('Authentication request failed', error);
      setErrorMessage(getAuthErrorMessage(error, actionType));
    } finally {
      submissionInProgress.current = false;
      setIsSubmitting(false);
    }
  }

  function clearRequestFeedback() {
    setErrorMessage(null);
    setNotice(null);
  }

  function handleEmailChange(value: string) {
    setEmail(value);
    clearRequestFeedback();
    if (touched.email) {
      setFieldErrors((current) => ({ ...current, email: validateEmail(value) }));
    }
  }

  function handlePasswordChange(value: string) {
    setPassword(value);
    clearRequestFeedback();
    if (touched.password) {
      setFieldErrors((current) => ({
        ...current,
        password: validatePassword(value, passwordValidationMode),
      }));
    }
  }

  function validateForm(mode: PasswordAuthMode): boolean {
    const errors = validatePasswordCredentials(email, password, mode);
    setPasswordValidationMode(mode);
    setTouched({ email: true, password: true });
    setFieldErrors(errors);

    if (errors.email) {
      emailInputRef.current?.focus();
    } else if (errors.password) {
      passwordInputRef.current?.focus();
    }
    return !errors.email && !errors.password;
  }

  function submitPasswordAction(mode: PasswordAuthMode) {
    clearRequestFeedback();
    if (!validateForm(mode)) return;

    if (mode === 'signIn') {
      void submit('signIn', () => signInWithPassword(email, password));
      return;
    }

    void submit('signUp', async () => {
      const result = await createAccountWithPassword(email, password);
      if (result === 'confirmationRequired') {
        setNotice('Account created. Check your email to confirm it, then return here to sign in.');
      }
    });
  }

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

  const passwordReady = !isSubmitting && hasPasswordCredentials(email, password);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', paddingHorizontal: ScreenGutter, paddingVertical: 24, gap: 24 }}>
          <View style={{ gap: 20 }}>
            <Logo height={30} />
            <Text style={headingStyle}>Sign in to HotRocks</Text>
            <Text style={bodyStyle}>Your sessions stay attached to your account across devices.</Text>
          </View>

          <View style={{ gap: 10 }}>
            {Platform.OS !== 'android' && (
              <Button variant="secondary" size="lg" fullWidth disabled={isSubmitting} onPress={() => void submit('social', signInWithApple)}>
                Continue with Apple
              </Button>
            )}
            <Button variant="secondary" size="lg" fullWidth disabled={isSubmitting} onPress={() => void submit('social', signInWithGoogle)}>
              Continue with Google
            </Button>
          </View>

          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <View style={{ flex: 1, height: 1, backgroundColor: theme.border }} />
            <Label>Or with email</Label>
            <View style={{ flex: 1, height: 1, backgroundColor: theme.border }} />
          </View>

          <View style={{ gap: 18 }}>
            <View>
              <Label style={{ marginBottom: 8 }}>Email</Label>
              <Input
                ref={emailInputRef}
                accessibilityLabel="Email address"
                accessibilityHint={fieldErrors.email}
                autoCapitalize="none"
                autoComplete="email"
                editable={!isSubmitting}
                inputMode="email"
                onBlur={() => {
                  setTouched((current) => ({ ...current, email: true }));
                  setFieldErrors((current) => ({ ...current, email: validateEmail(email) }));
                }}
                onChangeText={handleEmailChange}
                returnKeyType="next"
                onSubmitEditing={() => passwordInputRef.current?.focus()}
                submitBehavior="submit"
                value={email}
              />
              {fieldErrors.email ? (
                <Text
                  accessibilityLiveRegion="polite"
                  accessibilityRole="alert"
                  style={{ fontFamily: Rubik.medium, fontSize: Type.small, lineHeight: 21, color: theme.cedar, marginTop: 6 }}>
                  {fieldErrors.email}
                </Text>
              ) : null}
            </View>
            <View>
              <Label style={{ marginBottom: 8 }}>Password</Label>
              <Input
                ref={passwordInputRef}
                accessibilityLabel="Password"
                accessibilityHint={fieldErrors.password}
                autoCapitalize="none"
                autoComplete="password"
                editable={!isSubmitting}
                onBlur={() => {
                  setTouched((current) => ({ ...current, password: true }));
                  setFieldErrors((current) => ({
                    ...current,
                    password: validatePassword(password, passwordValidationMode),
                  }));
                }}
                onChangeText={handlePasswordChange}
                onSubmitEditing={() => submitPasswordAction('signIn')}
                returnKeyType="go"
                secureTextEntry
                submitBehavior="submit"
                value={password}
              />
              {fieldErrors.password ? (
                <Text
                  accessibilityLiveRegion="polite"
                  accessibilityRole="alert"
                  style={{ fontFamily: Rubik.medium, fontSize: Type.small, lineHeight: 21, color: theme.cedar, marginTop: 6 }}>
                  {fieldErrors.password}
                </Text>
              ) : null}
            </View>
          </View>

          <View style={{ gap: 8 }}>
            <Button
              size="lg"
              fullWidth
              loading={isSubmitting}
              disabled={!passwordReady}
              onPress={() => submitPasswordAction('signIn')}>
              Sign in
            </Button>
            <Button
              variant="ghost"
              fullWidth
              disabled={!passwordReady}
              onPress={() => submitPasswordAction('signUp')}>
              Create account
            </Button>
            {notice ? <Text accessibilityLiveRegion="polite" style={[bodyStyle, { fontSize: Type.small, lineHeight: 21, textAlign: 'center' }]}>{notice}</Text> : null}
            {errorMessage ? (
              <Text accessibilityLiveRegion="polite" accessibilityRole="alert" style={{ fontFamily: Rubik.medium, fontSize: Type.small, lineHeight: 21, color: theme.cedar, textAlign: 'center' }}>
                {errorMessage}
              </Text>
            ) : null}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
