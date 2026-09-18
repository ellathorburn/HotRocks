import { router } from 'expo-router';
import { useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, Text, type TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button, Logo } from '@/components/ds';
import { NavBar } from '@/components/nav-bar';
import { Rubik, ScreenGutter, Type } from '@/constants/theme';
import {
  type AuthFieldErrors,
  MIN_PASSWORD_LENGTH,
  validateEmail,
  validateName,
  validatePassword,
  validateSignUp,
} from '@/features/auth/auth-credentials';
import { createAccountWithPassword } from '@/features/auth/auth-service';
import { AuthField } from '@/features/auth/components/auth-field';
import { SocialAuthButtons } from '@/features/auth/components/social-auth-buttons';
import { useAuthSubmission } from '@/features/auth/use-auth-submission';
import { useTheme } from '@/hooks/use-theme';

/**
 * Account creation. Deliberately separate from sign in: its own heading,
 * name fields, and a single primary "Create account" action that is always
 * tappable and explains anything missing instead of silently doing nothing.
 */
export default function SignUpScreen() {
  const theme = useTheme();
  const { submit, isSubmitting, errorMessage, notice, setNotice, clearFeedback } = useAuthSubmission();
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fieldErrors, setFieldErrors] = useState<AuthFieldErrors>({});
  const firstNameRef = useRef<TextInput>(null);
  const lastNameRef = useRef<TextInput>(null);
  const emailRef = useRef<TextInput>(null);
  const passwordRef = useRef<TextInput>(null);

  const createAccount = () => {
    clearFeedback();
    const errors = validateSignUp({ firstName, lastName }, email, password);
    setFieldErrors(errors);
    if (errors.firstName) return firstNameRef.current?.focus();
    if (errors.lastName) return lastNameRef.current?.focus();
    if (errors.email) return emailRef.current?.focus();
    if (errors.password) return passwordRef.current?.focus();

    void submit('signUp', async () => {
      const result = await createAccountWithPassword({ firstName, lastName }, email, password);
      if (result === 'confirmationRequired') {
        setNotice(`We sent a confirmation link to ${email.trim()}. Open it, then sign in.`);
      }
    });
  };

  // Revalidates a field only once it has shown an error, so typing is quiet.
  const change = (field: keyof AuthFieldErrors, value: string, setValue: (value: string) => void) => {
    setValue(value);
    clearFeedback();
    if (!fieldErrors[field]) return;
    const message = field === 'firstName' ? validateName(value, 'first')
      : field === 'lastName' ? validateName(value, 'last')
        : field === 'email' ? validateEmail(value)
          : validatePassword(value, 'signUp');
    setFieldErrors((current) => ({ ...current, [field]: message }));
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }}>
      <NavBar title="" showBack />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ flexGrow: 1, paddingHorizontal: ScreenGutter, paddingBottom: 32, gap: 24 }}>
          <View style={{ gap: 14 }}>
            <Logo variant="mark" height={56} />
            <Text accessibilityRole="header" style={{ fontFamily: Rubik.bold, fontSize: 34, lineHeight: 37, letterSpacing: -0.7, color: theme.text }}>
              Create your account
            </Text>
            <Text style={{ fontFamily: Rubik.regular, fontSize: Type.body, lineHeight: Type.body * 1.5, color: theme.textSecondary }}>
              Your sessions follow you to every device. It takes a minute.
            </Text>
          </View>

          <SocialAuthButtons intent="signUp" disabled={isSubmitting} onSubmit={(request) => void submit('social', request)} />

          <View style={{ gap: 18 }}>
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <AuthField
                ref={firstNameRef}
                label="First name"
                accessibilityLabel="First name"
                error={fieldErrors.firstName}
                autoCapitalize="words"
                autoComplete="given-name"
                editable={!isSubmitting}
                onChangeText={(value) => change('firstName', value, setFirstName)}
                returnKeyType="next"
                onSubmitEditing={() => lastNameRef.current?.focus()}
                submitBehavior="submit"
                value={firstName}
              />
              <AuthField
                ref={lastNameRef}
                label="Surname"
                accessibilityLabel="Surname"
                error={fieldErrors.lastName}
                autoCapitalize="words"
                autoComplete="family-name"
                editable={!isSubmitting}
                onChangeText={(value) => change('lastName', value, setLastName)}
                returnKeyType="next"
                onSubmitEditing={() => emailRef.current?.focus()}
                submitBehavior="submit"
                value={lastName}
              />
            </View>
            <AuthField
              ref={emailRef}
              label="Email"
              accessibilityLabel="Email address"
              error={fieldErrors.email}
              autoCapitalize="none"
              autoComplete="email"
              editable={!isSubmitting}
              inputMode="email"
              onChangeText={(value) => change('email', value, setEmail)}
              returnKeyType="next"
              onSubmitEditing={() => passwordRef.current?.focus()}
              submitBehavior="submit"
              value={email}
            />
            <View>
              <AuthField
                ref={passwordRef}
                label="Password"
                accessibilityLabel="Password"
                error={fieldErrors.password}
                autoCapitalize="none"
                autoComplete="new-password"
                editable={!isSubmitting}
                onChangeText={(value) => change('password', value, setPassword)}
                onSubmitEditing={createAccount}
                returnKeyType="go"
                secureTextEntry
                submitBehavior="submit"
                value={password}
              />
              {!fieldErrors.password ? (
                <Text style={{ fontFamily: Rubik.regular, fontSize: Type.small, color: theme.textSecondary, marginTop: 6 }}>
                  At least {MIN_PASSWORD_LENGTH} characters.
                </Text>
              ) : null}
            </View>
          </View>

          <View style={{ gap: 10 }}>
            <Button size="lg" fullWidth loading={isSubmitting} onPress={createAccount}>
              Create account
            </Button>
            {notice ? (
              <Text accessibilityLiveRegion="polite" style={{ fontFamily: Rubik.medium, fontSize: Type.small, lineHeight: 21, color: theme.text, textAlign: 'center' }}>
                {notice}
              </Text>
            ) : null}
            {errorMessage ? (
              <Text accessibilityLiveRegion="polite" accessibilityRole="alert" style={{ fontFamily: Rubik.medium, fontSize: Type.small, lineHeight: 21, color: theme.cedar, textAlign: 'center' }}>
                {errorMessage}
              </Text>
            ) : null}
          </View>

          <View style={{ flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 4 }}>
            <Text style={{ fontFamily: Rubik.regular, fontSize: Type.body, color: theme.textSecondary }}>
              Already have an account?
            </Text>
            <Button variant="secondary" size="sm" disabled={isSubmitting} onPress={() => router.replace('/sign-in')}>
              Sign in
            </Button>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
