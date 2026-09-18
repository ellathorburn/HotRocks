import { useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, Text, type TextInput, View } from 'react-native';

import { Button } from '@/components/ds';
import { Rubik, ScreenGutter, Type } from '@/constants/theme';
import { useAuth } from '@/features/auth/auth-context';
import { type AuthFieldErrors, validateName, validatePersonName } from '@/features/auth/auth-credentials';
import { AuthField } from '@/features/auth/components/auth-field';
import { useTheme } from '@/hooks/use-theme';

type NameFormProps = {
  submitLabel: string;
  onSaved?: () => void;
};

/** First name and surname, prefilled from the profile and saved through useAuth. */
export function NameForm({ submitLabel, onSaved }: NameFormProps) {
  const theme = useTheme();
  const { profile, updateName } = useAuth();
  const [firstName, setFirstName] = useState(profile?.first_name ?? '');
  const [lastName, setLastName] = useState(profile?.last_name ?? '');
  const [fieldErrors, setFieldErrors] = useState<AuthFieldErrors>({});
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const firstRef = useRef<TextInput>(null);
  const lastRef = useRef<TextInput>(null);

  const save = async () => {
    setSaveError(null);
    const errors = validatePersonName({ firstName, lastName });
    setFieldErrors(errors);
    if (errors.firstName) return firstRef.current?.focus();
    if (errors.lastName) return lastRef.current?.focus();

    setIsSaving(true);
    try {
      await updateName({ firstName, lastName });
      onSaved?.();
    } catch (error) {
      if (__DEV__) console.error('Saving the profile name failed', error);
      setSaveError('Could not save your name. Try again.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingHorizontal: ScreenGutter, paddingBottom: 32, gap: 18 }}>
        <AuthField
          ref={firstRef}
          label="First name"
          accessibilityLabel="First name"
          error={fieldErrors.firstName}
          autoCapitalize="words"
          autoComplete="given-name"
          editable={!isSaving}
          onChangeText={(value) => {
            setFirstName(value);
            if (fieldErrors.firstName) setFieldErrors((current) => ({ ...current, firstName: validateName(value, 'first') }));
          }}
          returnKeyType="next"
          onSubmitEditing={() => lastRef.current?.focus()}
          submitBehavior="submit"
          value={firstName}
        />
        <AuthField
          ref={lastRef}
          label="Surname"
          accessibilityLabel="Surname"
          error={fieldErrors.lastName}
          autoCapitalize="words"
          autoComplete="family-name"
          editable={!isSaving}
          onChangeText={(value) => {
            setLastName(value);
            if (fieldErrors.lastName) setFieldErrors((current) => ({ ...current, lastName: validateName(value, 'last') }));
          }}
          onSubmitEditing={() => void save()}
          returnKeyType="done"
          submitBehavior="submit"
          value={lastName}
        />
        <View style={{ gap: 8, marginTop: 8 }}>
          <Button size="lg" fullWidth loading={isSaving} onPress={() => void save()}>
            {submitLabel}
          </Button>
          {saveError ? (
            <Text accessibilityRole="alert" style={{ fontFamily: Rubik.medium, fontSize: Type.small, color: theme.cedar, textAlign: 'center' }}>
              {saveError}
            </Text>
          ) : null}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
