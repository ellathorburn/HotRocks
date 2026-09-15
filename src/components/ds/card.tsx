import { type ReactNode } from 'react';
import { Pressable, View, type ViewStyle } from 'react-native';

import { CardPadding, Radius } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type CardProps = {
  children: ReactNode;
  padded?: boolean;
  onPress?: () => void;
  style?: ViewStyle;
};

/** Surface container. Shadow in light mode, surface colour in dark. Never a border + shadow together. */
export function Card({ children, padded = true, onPress, style }: CardProps) {
  const theme = useTheme();
  const base: ViewStyle = {
    backgroundColor: theme.card,
    borderRadius: Radius.lg,
    padding: padded ? CardPadding : 0,
    overflow: 'hidden',
    shadowColor: theme.shadowCard,
    shadowOpacity: theme.shadowCard === 'transparent' ? 0 : 1,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: theme.shadowCard === 'transparent' ? 0 : 2,
  };

  if (onPress) {
    return (
      <Pressable onPress={onPress} style={[base, style]}>
        {children}
      </Pressable>
    );
  }

  return <View style={[base, style]}>{children}</View>;
}
