import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/ds';
import { Rubik, ScreenGutter, Type } from '@/constants/theme';
import { useAuth } from '@/features/auth/auth-context';
import { MIN_PASSWORD_LENGTH, validatePassword } from '@/features/auth/auth-credentials';
import { updatePassword } from '@/features/auth/auth-service';
import { AuthField } from '@/features/auth/components/auth-field';
import { useAuthSubmission } from '@/features/auth/use-auth-submission';
import { useTheme } from '@/hooks/use-theme';

/**
 * Reached only from a password-reset link. The navigator shows nothing else
 * until a new password is saved, then continues to the app.
 */
export default function ResetPasswordScreen() {
  const theme = useTheme();
  const { finishPasswordRecovery } = useAuth();
  const { submit, isSubmitting, errorMessage, clearFeedback } = useAuthSubmission();
  const [password, setPassword] = useState('');
  const [passwordError, setPasswordError] = useState<string | undefined>();

  const save = () => {
    clearFeedback();
    const error = validatePassword(password, 'signUp');
    setPasswordError(error);
    if (error) return;
    void submit('passwordReset', async () => {
      await updatePassword(password);
      finishPasswordRecovery();
    });
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingHorizontal: ScreenGutter, paddingTop: 32, paddingBottom: 32, gap: 24 }}>
          <View style={{ gap: 12 }}>
            <Text accessibilityRole="header" style={{ fontFamily: Rubik.bold, fontSize: 30, lineHeight: 33, letterSpacing: -0.6, color: theme.text }}>
              Choose a new password
            </Text>
            <Text style={{ fontFamily: Rubik.regular, fontSize: Type.body, lineHeight: Type.body * 1.5, color: theme.textSecondary }}>
              At least {MIN_PASSWORD_LENGTH} characters. You’ll use it the next time you sign in.
            </Text>
          </View>

          <AuthField
            label="New password"
            accessibilityLabel="New password"
            error={passwordError}
            autoCapitalize="none"
            autoComplete="new-password"
            editable={!isSubmitting}
            onChangeText={(value) => {
              setPassword(value);
              clearFeedback();
              if (passwordError) setPasswordError(validatePassword(value, 'signUp'));
            }}
            onSubmitEditing={save}
            returnKeyType="done"
            secureTextEntry
            submitBehavior="submit"
            value={password}
          />

          <View style={{ gap: 10 }}>
            <Button size="lg" fullWidth loading={isSubmitting} onPress={save}>
              Save password
            </Button>
            {errorMessage ? (
              <Text accessibilityRole="alert" style={{ fontFamily: Rubik.medium, fontSize: Type.small, lineHeight: 21, color: theme.cedar, textAlign: 'center' }}>
                {errorMessage}
              </Text>
            ) : null}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
