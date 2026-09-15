import { type ReactNode } from 'react';
import { Text, View, type ViewStyle } from 'react-native';

import { Radius, Rubik, Tracking, Type } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

import { Icon, type IconName } from './icon';

type BadgeProps = {
  children: ReactNode;
  tone?: 'neutral' | 'hot' | 'cold' | 'inverse';
  icon?: IconName;
  style?: ViewStyle;
  textColor?: string;
};

/** Quiet status marker. 6px radius — small control, not a pill. */
export function Badge({ children, tone = 'neutral', icon, style, textColor }: BadgeProps) {
  const theme = useTheme();
  const tones = {
    neutral: { background: theme.surfaceSunken, color: theme.textSecondary },
    hot: { background: theme.accentTint, color: theme.cedar },
    cold: { background: theme.iceTint, color: theme.coldInk },
    inverse: { background: theme.backgroundElement, color: theme.textSecondary },
  };
  const t = tones[tone];

  return (
    <View
      style={[
        {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 5,
          paddingVertical: 4,
          paddingHorizontal: 8,
          borderRadius: Radius.sm,
          backgroundColor: t.background,
        },
        style,
      ]}>
      {icon ? <Icon name={icon} size={12} color={textColor ?? t.color} /> : null}
      <Text
        style={{
          fontFamily: Rubik.medium,
          fontSize: Type.label,
          letterSpacing: Tracking.label,
          textTransform: 'uppercase',
          color: textColor ?? t.color,
        }}>
        {children}
      </Text>
    </View>
  );
}
