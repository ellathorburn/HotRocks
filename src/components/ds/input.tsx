import { forwardRef, type ReactNode } from 'react';
import { TextInput, View, type TextInputProps, type ViewStyle } from 'react-native';

import { Radius, Rubik, Type } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type InputProps = {
  value?: string;
  placeholder?: string;
  onChangeText?: (text: string) => void;
  leading?: ReactNode;
  multiline?: boolean;
  style?: ViewStyle;
} & Pick<
  TextInputProps,
  | 'accessibilityHint'
  | 'accessibilityLabel'
  | 'autoCapitalize'
  | 'autoComplete'
  | 'editable'
  | 'inputMode'
  | 'onBlur'
  | 'onSubmitEditing'
  | 'returnKeyType'
  | 'secureTextEntry'
  | 'submitBehavior'
>;

/** Text or search input. 10px radius, 48px tall, hairline border. */
export const Input = forwardRef<TextInput, InputProps>(function Input(
  { value, placeholder, onChangeText, leading, multiline = false, style, ...inputProps },
  ref,
) {
  const theme = useTheme();

  return (
    <View
      style={[
        {
          flexDirection: 'row',
          alignItems: multiline ? 'flex-start' : 'center',
          gap: 10,
          minHeight: 48,
          paddingHorizontal: 14,
          paddingVertical: multiline ? 14 : 0,
          backgroundColor: theme.card,
          borderWidth: 1,
          borderColor: theme.border,
          borderRadius: Radius.md,
        },
        style,
      ]}>
      {leading}
      <TextInput
        ref={ref}
        {...inputProps}
        value={value}
        placeholder={placeholder}
        placeholderTextColor={theme.textSecondary}
        onChangeText={onChangeText}
        multiline={multiline}
        numberOfLines={multiline ? 3 : 1}
        style={{
          flex: 1,
          minWidth: 0,
          fontFamily: Rubik.regular,
          fontSize: Type.body,
          color: theme.text,
          paddingVertical: 0,
        }}
      />
    </View>
  );
});
