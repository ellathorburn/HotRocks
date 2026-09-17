import { router } from 'expo-router';
import { type ReactNode } from 'react';
import { Text, View } from 'react-native';

import { IconButton, type IconName } from '@/components/ds';
import { Rubik, ScreenGutter, Type } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type NavBarProps = {
  title: string;
  showBack?: boolean;
  onBack?: () => void;
  trailing?: ReactNode;
  trailingIcon?: IconName;
  onTrailingPress?: () => void;
};

/** Screen header: optional back chevron, title, optional trailing action. */
export function NavBar({ title, showBack = false, onBack, trailing, trailingIcon, onTrailingPress }: NavBarProps) {
  const theme = useTheme();

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        paddingHorizontal: ScreenGutter,
        paddingTop: 6,
        paddingBottom: 10,
        minHeight: 48,
      }}>
      {showBack ? (
        <IconButton icon="chevron-left" label="Back" size={36} onPress={onBack ?? (() => router.back())} style={{ marginLeft: -8 }} />
      ) : null}
      <Text numberOfLines={1} style={{ flex: 1, fontFamily: Rubik.semibold, fontSize: Type.heading, lineHeight: 29, letterSpacing: -0.24, color: theme.text }}>{title}</Text>
      {trailing}
      {trailingIcon ? <IconButton icon={trailingIcon} label={title} size={38} onPress={onTrailingPress} /> : null}
    </View>
  );
}
