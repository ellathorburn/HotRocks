import { Pressable, Text, View, type ViewStyle } from 'react-native';

import { Radius, Rubik, Type } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

import { Chip } from './chip';
import { Icon } from './icon';

type DurationStepperProps = {
  value?: number;
  onChange?: (value: number) => void;
  step?: number;
  presets?: number[];
  unit?: string;
  style?: ViewStyle;
};

/** Duration stepper with presets. The dominant element on the log screen. */
export function DurationStepper({ value = 15, onChange, step = 1, presets = [10, 15, 20, 30], unit = 'min', style }: DurationStepperProps) {
  const theme = useTheme();
  const set = (v: number) => onChange?.(Math.max(1, v));

  const roundButton = (onPress: () => void, iconName: 'minus' | 'plus') => (
    <Pressable
      onPress={onPress}
      style={{
        width: 56,
        height: 56,
        borderRadius: Radius.md,
        borderWidth: 1,
        borderColor: theme.borderStrong,
        alignItems: 'center',
        justifyContent: 'center',
      }}>
      <Icon name={iconName} size={24} color={theme.text} />
    </Pressable>
  );

  return (
    <View style={style}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
        {roundButton(() => set(value - step), 'minus')}
        <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8, justifyContent: 'center', flex: 1 }}>
          <Text style={{ fontFamily: Rubik.bold, fontSize: Type.display, color: theme.text, fontVariant: ['tabular-nums'] }}>
            {value}
          </Text>
          <Text style={{ fontFamily: Rubik.medium, fontSize: Type.subheading, color: theme.textSecondary }}>{unit}</Text>
        </View>
        {roundButton(() => set(value + step), 'plus')}
      </View>
      <View style={{ flexDirection: 'row', gap: 8, marginTop: 16, justifyContent: 'center', flexWrap: 'wrap' }}>
        {presets.map((p) => (
          <Chip key={p} size="sm" selected={p === value} onPress={() => set(p)}>
            {p} {unit}
          </Chip>
        ))}
      </View>
    </View>
  );
}
