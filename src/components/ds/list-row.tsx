import { type ReactNode } from 'react';
import { Pressable, Text, View, type ViewStyle } from 'react-native';

import { Radius, Rubik, TapMin, Type } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

import { Icon } from './icon';

type ListRowProps = {
  title: string;
  meta?: string;
  leading?: ReactNode;
  trailing?: ReactNode;
  chevron?: boolean;
  selected?: boolean;
  onPress?: () => void;
  style?: ViewStyle;
};

/** Tappable row: venue lists, settings, rounds in a session. 10px radius. */
export function ListRow({ title, meta, leading, trailing, chevron = false, selected = false, onPress, style }: ListRowProps) {
  const theme = useTheme();
  const content = (
    <>
      {leading}
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text
          numberOfLines={1}
          style={{ fontFamily: Rubik.medium, fontSize: Type.subheading, color: theme.text, lineHeight: Type.subheading * 1.3 }}>
          {title}
        </Text>
        {meta ? (
          <Text style={{ fontFamily: Rubik.regular, fontSize: Type.small, color: theme.textSecondary, marginTop: 2 }}>
            {meta}
          </Text>
        ) : null}
      </View>
      {trailing}
      {chevron ? <Icon name="chevron-right" size={20} color={theme.textSecondary} /> : null}
    </>
  );

  const rowStyle: ViewStyle = {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: TapMin,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: Radius.md,
    backgroundColor: selected ? theme.accentTint : 'transparent',
  };

  if (onPress) {
    return (
      <Pressable onPress={onPress} style={[rowStyle, style]}>
        {content}
      </Pressable>
    );
  }

  return <View style={[rowStyle, style]}>{content}</View>;
}
