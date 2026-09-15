import { Text, type TextStyle } from 'react-native';

import { Rubik, Tracking, Type } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type LabelProps = {
  children: React.ReactNode;
  tone?: 'secondary' | 'primary' | 'hot' | 'cold';
  style?: TextStyle;
};

/** 12px uppercase caption with +4% tracking. Field labels and stat captions. */
export function Label({ children, tone = 'secondary', style }: LabelProps) {
  const theme = useTheme();
  const colors = {
    secondary: theme.textSecondary,
    primary: theme.text,
    hot: theme.cedar,
    cold: theme.coldInk,
  };

  return (
    <Text
      style={[
        {
          fontFamily: Rubik.medium,
          fontSize: Type.label,
          letterSpacing: Tracking.label,
          textTransform: 'uppercase',
          lineHeight: Type.label * 1.3,
          color: colors[tone],
        },
        style,
      ]}>
      {children}
    </Text>
  );
}
