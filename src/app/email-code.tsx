import { router } from 'expo-router';
import { useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, Text, type TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button, Logo } from '@/components/ds';
import { Rubik, ScreenGutter, Type } from '@/constants/theme';
import { useAuth } from '@/features/auth/auth-context';
import {
  EMAIL_CODE_LENGTH,
  type AuthFieldErrors,
  validateEmail,
  validateEmailCode,
} from '@/features/auth/auth-credentials';
import { requestEmailOtp, verifyEmailOtp } from '@/features/auth/auth-service';
import { AuthField } from '@/features/auth/components/auth-field';
import { useAuthSubmission } from '@/features/auth/use-auth-submission';
import { useTheme } from '@/hooks/use-theme';

/**
 * Signs in with a six-digit code sent by email. This is the fallback for anyone
 * who cannot use Apple or Google and does not want a password. Verifying the
 * code creates the session; the root navigator then decides where to go, so this
 * screen never navigates on success itself.
 */
export default function EmailCodeScreen() {
  const theme = useTheme();
  const { isConfigured } = useAuth();
  const { submit, isSubmitting, errorMessage, notice, setNotice, clearFeedback } = useAuthSubmission();
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [isSent, setIsSent] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<AuthFieldErrors>({});
  const emailInputRef = useRef<TextInput>(null);
  const codeInputRef = useRef<TextInput>(null);

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

  const sendCode = () => {
    clearFeedback();
    const emailError = validateEmail(email);
    setFieldErrors({ ...(emailError ? { email: emailError } : {}) });
    if (emailError) return emailInputRef.current?.focus();

    void submit('emailCodeRequest', async () => {
      await requestEmailOtp(email);
      setIsSent(true);
      setCode('');
      setNotice(`Check ${email.trim()} for a ${EMAIL_CODE_LENGTH}-digit code. It expires in an hour.`);
      codeInputRef.current?.focus();
    });
  };

  const verifyCode = () => {
    clearFeedback();
    const codeError = validateEmailCode(code);
    setFieldErrors({ ...(codeError ? { code: codeError } : {}) });
    if (codeError) return codeInputRef.current?.focus();
    void submit('emailCodeVerify', () => verifyEmailOtp(email, code));
  };

  const useAnotherAddress = () => {
    clearFeedback();
    setIsSent(false);
    setCode('');
    setFieldErrors({});
    emailInputRef.current?.focus();
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', paddingHorizontal: ScreenGutter, paddingVertical: 24, gap: 24 }}>
          <View style={{ gap: 20 }}>
            <Logo height={30} />
            <Text accessibilityRole="header" style={headingStyle}>
              {isSent ? 'Enter your code' : 'Sign in with a code'}
            </Text>
            <Text style={bodyStyle}>
              {isSent
                ? 'The code is only valid for this sign-in. Request another if it expires.'
                : `We email you a ${EMAIL_CODE_LENGTH}-digit code. No password to remember, and it works on a new device.`}
            </Text>
          </View>

          <View style={{ gap: 18 }}>
            <AuthField
              ref={emailInputRef}
              label="Email"
              accessibilityLabel="Email address"
              error={fieldErrors.email}
              autoCapitalize="none"
              autoComplete="email"
              // Locked once a code is out, so the code is always verified
              // against the address it was sent to.
              editable={!isSubmitting && !isSent}
              inputMode="email"
              onChangeText={(value) => {
                setEmail(value);
                clearFeedback();
                if (fieldErrors.email) setFieldErrors((current) => ({ ...current, email: validateEmail(value) }));
              }}
              onSubmitEditing={sendCode}
              returnKeyType="send"
              submitBehavior="submit"
              value={email}
            />

            {isSent ? (
              <AuthField
                ref={codeInputRef}
                label="Code"
                accessibilityLabel={`${EMAIL_CODE_LENGTH}-digit sign-in code`}
                error={fieldErrors.code}
                autoCapitalize="none"
                autoComplete="one-time-code"
                editable={!isSubmitting}
                inputMode="numeric"
                maxLength={EMAIL_CODE_LENGTH}
                onChangeText={(value) => {
                  const digits = value.replace(/[^0-9]/g, '');
                  setCode(digits);
                  clearFeedback();
                  if (fieldErrors.code) setFieldErrors((current) => ({ ...current, code: validateEmailCode(digits) }));
                }}
                onSubmitEditing={verifyCode}
                returnKeyType="go"
                submitBehavior="submit"
                value={code}
              />
            ) : null}
          </View>

          <View style={{ gap: 8 }}>
            {isSent ? (
              <>
                <Button size="lg" fullWidth loading={isSubmitting} onPress={verifyCode}>
                  Sign in
                </Button>
                <Button variant="secondary" size="sm" fullWidth disabled={isSubmitting} onPress={sendCode}>
                  Send a new code
                </Button>
                <Button variant="ghost" size="sm" fullWidth disabled={isSubmitting} onPress={useAnotherAddress}>
                  Use a different email
                </Button>
              </>
            ) : (
              <>
                <Button size="lg" fullWidth loading={isSubmitting} onPress={sendCode}>
                  Email me a code
                </Button>
                <Button variant="ghost" size="sm" fullWidth disabled={isSubmitting} onPress={() => router.back()}>
                  Back to sign in
                </Button>
              </>
            )}

            {notice ? (
              <Text
                accessibilityLiveRegion="polite"
                style={{ fontFamily: Rubik.medium, fontSize: Type.small, lineHeight: 21, color: theme.textSecondary, textAlign: 'center' }}>
                {notice}
              </Text>
            ) : null}
            {errorMessage ? (
              <Text
                accessibilityLiveRegion="polite"
                accessibilityRole="alert"
                style={{ fontFamily: Rubik.medium, fontSize: Type.small, lineHeight: 21, color: theme.cedar, textAlign: 'center' }}>
                {errorMessage}
              </Text>
            ) : null}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
