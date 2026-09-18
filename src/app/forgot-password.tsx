import { router } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/ds';
import { NavBar } from '@/components/nav-bar';
import { Rubik, ScreenGutter, Type } from '@/constants/theme';
import { validateEmail } from '@/features/auth/auth-credentials';
import { requestPasswordReset } from '@/features/auth/auth-service';
import { AuthField } from '@/features/auth/components/auth-field';
import { useAuthSubmission } from '@/features/auth/use-auth-submission';
import { useTheme } from '@/hooks/use-theme';

export default function ForgotPasswordScreen() {
  const theme = useTheme();
  const { submit, isSubmitting, errorMessage, notice, setNotice, clearFeedback } = useAuthSubmission();
  const [email, setEmail] = useState('');
  const [emailError, setEmailError] = useState<string | undefined>();

  const sendLink = () => {
    clearFeedback();
    const error = validateEmail(email);
    setEmailError(error);
    if (error) return;
    void submit('passwordReset', async () => {
      await requestPasswordReset(email);
      // Same message whether or not the address has an account, so the screen
      // cannot be used to discover who uses HotRocks.
      setNotice(`If ${email.trim()} has a HotRocks account, a reset link is on its way. Open it on this phone.`);
    });
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }}>
      <NavBar title="" showBack />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingHorizontal: ScreenGutter, paddingBottom: 32, gap: 24 }}>
          <View style={{ gap: 12 }}>
            <Text accessibilityRole="header" style={{ fontFamily: Rubik.bold, fontSize: 30, lineHeight: 33, letterSpacing: -0.6, color: theme.text }}>
              Reset your password
            </Text>
            <Text style={{ fontFamily: Rubik.regular, fontSize: Type.body, lineHeight: Type.body * 1.5, color: theme.textSecondary }}>
              Enter the email you signed up with and we’ll send you a link to choose a new password.
            </Text>
          </View>

          <AuthField
            label="Email"
            accessibilityLabel="Email address"
            error={emailError}
            autoCapitalize="none"
            autoComplete="email"
            editable={!isSubmitting}
            inputMode="email"
            onChangeText={(value) => {
              setEmail(value);
              clearFeedback();
              if (emailError) setEmailError(validateEmail(value));
            }}
            onSubmitEditing={sendLink}
            returnKeyType="send"
            submitBehavior="submit"
            value={email}
          />

          <View style={{ gap: 10 }}>
            <Button size="lg" fullWidth loading={isSubmitting} onPress={sendLink}>
              Send reset link
            </Button>
            {notice ? (
              <Text accessibilityLiveRegion="polite" style={{ fontFamily: Rubik.medium, fontSize: Type.small, lineHeight: 21, color: theme.text, textAlign: 'center' }}>
                {notice}
              </Text>
            ) : null}
            {errorMessage ? (
              <Text accessibilityRole="alert" style={{ fontFamily: Rubik.medium, fontSize: Type.small, lineHeight: 21, color: theme.cedar, textAlign: 'center' }}>
                {errorMessage}
              </Text>
            ) : null}
            <Button variant="secondary" size="lg" fullWidth onPress={() => router.back()}>
              Back to sign in
            </Button>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
