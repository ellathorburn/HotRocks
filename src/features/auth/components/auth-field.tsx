import { forwardRef, type ComponentProps } from 'react';
import { Text, type TextInput, View } from 'react-native';

import { Input, Label } from '@/components/ds';
import { Rubik, Type } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type AuthFieldProps = {
  label: string;
  error?: string;
} & ComponentProps<typeof Input>;

/** A labelled form input with its validation message announced to screen readers. */
export const AuthField = forwardRef<TextInput, AuthFieldProps>(function AuthField(
  { label, error, ...inputProps },
  ref,
) {
  const theme = useTheme();

  return (
    <View style={{ flex: 1 }}>
      <Label style={{ marginBottom: 8 }}>{label}</Label>
      <Input ref={ref} accessibilityHint={error} {...inputProps} />
      {error ? (
        <Text
          accessibilityLiveRegion="polite"
          accessibilityRole="alert"
          style={{ fontFamily: Rubik.medium, fontSize: Type.small, lineHeight: 21, color: theme.cedar, marginTop: 6 }}>
          {error}
        </Text>
      ) : null}
    </View>
  );
});
