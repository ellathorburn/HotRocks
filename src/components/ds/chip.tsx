import { type ReactNode } from 'react';
import { Pressable, Text, type ViewStyle } from 'react-native';

import { Radius, Rubik } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type ChipProps = {
  children: ReactNode;
  selected?: boolean;
  tone?: 'neutral' | 'hot' | 'warm' | 'cold';
  size?: 'sm' | 'md';
  onPress?: () => void;
  style?: ViewStyle;
};

/** Pill control. Reserved for temperature values, filters and status chips. */
export function Chip({ children, selected = false, tone = 'neutral', size = 'md', onPress, style }: ChipProps) {
  const theme = useTheme();
  const tones = {
    neutral: { on: theme.text, onText: theme.background },
    hot: { on: theme.accent, onText: theme.textOnAccent },
    warm: { on: theme.sand, onText: theme.textOnAccent },
    cold: { on: theme.cold, onText: theme.textOnAccent },
  };
  const t = tones[tone];
  const height = size === 'sm' ? 32 : 40;

  return (
    <Pressable
      onPress={onPress}
      style={[
        {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 6,
          height,
          paddingHorizontal: size === 'sm' ? 12 : 16,
          borderRadius: Radius.full,
          backgroundColor: selected ? t.on : 'transparent',
          borderWidth: selected ? 0 : 1,
          borderColor: theme.borderStrong,
        },
        style,
      ]}>
      <Text
        style={{
          fontFamily: Rubik.medium,
          fontSize: size === 'sm' ? 13 : 15,
          color: selected ? t.onText : theme.textSecondary,
          fontVariant: ['tabular-nums'],
        }}>
        {children}
      </Text>
    </Pressable>
  );
}
