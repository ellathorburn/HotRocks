import { Pressable, Text, View, type ViewStyle } from 'react-native';

import { Radius, Rubik } from '@/constants/theme';
import type { SessionIntervalKind } from '@/features/sessions/types/session-types';
import { useTheme } from '@/hooks/use-theme';

import { Icon } from './icon';
import { intervalMeta } from './interval-meta';

type ActivityPickerProps = {
  value: SessionIntervalKind | null;
  onChange: (kind: SessionIntervalKind) => void;
  /** Kinds the timeline rules allow right now; supplied by the session services. */
  options: SessionIntervalKind[];
  style?: ViewStyle;
};

/** Sauna, cold plunge or break as three large targets. Never a dropdown. */
export function ActivityPicker({ value, onChange, options, style }: ActivityPickerProps) {
  const theme = useTheme();

  return (
    <View accessibilityRole="radiogroup" style={[{ flexDirection: 'row', gap: 10 }, style]}>
      {options.map((kind) => {
        const meta = intervalMeta(kind, theme);
        const selected = kind === value;
        return (
          <Pressable
            key={kind}
            accessibilityRole="radio"
            accessibilityState={{ selected }}
            accessibilityLabel={meta.label}
            onPress={() => onChange(kind)}
            style={{
              flex: 1,
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              minHeight: 92,
              paddingVertical: 12,
              paddingHorizontal: 8,
              borderRadius: Radius.md,
              backgroundColor: selected ? meta.fill : 'transparent',
              borderWidth: selected ? 0 : 1,
              borderColor: theme.borderStrong,
            }}>
            <Icon name={meta.icon} size={26} color={selected ? meta.ink : theme.textSecondary} />
            <Text
              numberOfLines={1}
              style={{
                fontFamily: selected ? Rubik.bold : Rubik.semibold,
                fontSize: 16,
                color: selected ? meta.ink : theme.textSecondary,
              }}>
              {options.length > 2 ? meta.shortLabel : meta.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
