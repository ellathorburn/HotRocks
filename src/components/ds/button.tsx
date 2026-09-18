import { type ReactNode } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, type ViewStyle } from 'react-native';

import { Radius, Rubik } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type Variant = 'primary' | 'secondary' | 'ghost' | 'wood';
type Size = 'lg' | 'md' | 'sm';

const SIZES: Record<Size, { height: number; paddingHorizontal: number; fontSize: number; weight: keyof typeof Rubik }> = {
  lg: { height: 56, paddingHorizontal: 24, fontSize: 18, weight: 'semibold' },
  md: { height: 48, paddingHorizontal: 20, fontSize: 16, weight: 'medium' },
  sm: { height: 36, paddingHorizontal: 14, fontSize: 14, weight: 'medium' },
};

type ButtonProps = {
  children: ReactNode;
  variant?: Variant;
  size?: Size;
  fullWidth?: boolean;
  disabled?: boolean;
  loading?: boolean;
  iconLeft?: ReactNode;
  iconRight?: ReactNode;
  onPress?: () => void;
  style?: ViewStyle;
};

/** The one ember action per screen. 10px rectangle, never a pill. */
export function Button({
  children,
  variant = 'primary',
  size = 'md',
  fullWidth = false,
  disabled = false,
  loading = false,
  iconLeft,
  iconRight,
  onPress,
  style,
}: ButtonProps) {
  const theme = useTheme();
  const s = SIZES[size];

  const variantStyle = (pressed: boolean): { backgroundColor: string; borderColor: string; textColor: string } => {
    switch (variant) {
      case 'primary':
        return {
          backgroundColor: pressed ? theme.accentPressed : theme.accent,
          borderColor: 'transparent',
          textColor: theme.textOnAccent,
        };
      case 'secondary':
        return { backgroundColor: 'transparent', borderColor: theme.borderStrong, textColor: theme.text };
      case 'wood':
        return {
          backgroundColor: pressed ? theme.sand : theme.sand,
          borderColor: 'transparent',
          textColor: theme.textOnAccent,
        };
      case 'ghost':
      default:
        return { backgroundColor: 'transparent', borderColor: 'transparent', textColor: theme.textSecondary };
    }
  };

  return (
    <Pressable
      disabled={disabled || loading}
      onPress={onPress}
      style={({ pressed }) => {
        const v = variantStyle(pressed);
        return [
          styles.base,
          {
            height: s.height,
            paddingHorizontal: s.paddingHorizontal,
            borderRadius: Radius.md,
            backgroundColor: v.backgroundColor,
            borderWidth: variant === 'secondary' ? 1 : 0,
            borderColor: v.borderColor,
            width: fullWidth ? '100%' : undefined,
            opacity: disabled ? 0.5 : 1,
            transform: [{ scale: pressed && !disabled ? 0.98 : 1 }],
          },
          style,
        ];
      }}>
      {({ pressed }) => {
        const v = variantStyle(pressed);
        return loading ? (
          <ActivityIndicator color={v.textColor} />
        ) : (
          <>
            {iconLeft}
            <Text numberOfLines={1} style={[styles.label, { fontSize: s.fontSize, fontFamily: Rubik[s.weight], color: v.textColor }]}>
              {children}
            </Text>
            {iconRight}
          </>
        );
      }}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  label: {
    lineHeight: undefined,
    flexShrink: 1,
  },
});
