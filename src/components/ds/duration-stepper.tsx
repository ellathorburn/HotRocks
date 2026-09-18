import { Pressable, Text, View, type ViewStyle } from 'react-native';

import { displayText, Radius, Rubik, Type } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { MIN_INTERVAL_SECONDS } from '@/features/sessions/validation/session-validation';
import { formatStepDuration } from '@/lib/format';

import { Chip } from './chip';
import { Icon } from './icon';

type DurationStepperProps = {
  /** Seconds. */
  value?: number;
  onChange?: (value: number) => void;
  /** Seconds. */
  presets?: number[];
  style?: ViewStyle;
};

/**
 * Steps are 30 seconds, then whole minutes: 30 s, 1 min, 2 min, … Stepping
 * moves from the step on screen, so a timed 95 s entry (shown as 2 min) goes
 * to 1 min or 3 min rather than to an exact minute that reads the same.
 */
function shownMinutes(seconds: number): number {
  return seconds < 45 ? 0 : Math.round(seconds / 60);
}

function stepDown(seconds: number): number {
  const minutes = shownMinutes(seconds);
  return minutes <= 1 ? MIN_INTERVAL_SECONDS : (minutes - 1) * 60;
}

function stepUp(seconds: number): number {
  return (shownMinutes(seconds) + 1) * 60;
}

/** Duration stepper with presets. The dominant element on the log screen. */
export function DurationStepper({ value = 900, onChange, presets = [600, 900, 1200, 1800], style }: DurationStepperProps) {
  const theme = useTheme();
  const set = (v: number) => onChange?.(Math.max(MIN_INTERVAL_SECONDS, v));
  const [amount, unit] = formatStepDuration(value).split(' ');

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
        {roundButton(() => set(stepDown(value)), 'minus')}
        <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8, justifyContent: 'center', flex: 1 }}>
          <Text style={{ fontFamily: Rubik.bold, ...displayText(Type.display), color: theme.text, fontVariant: ['tabular-nums'] }}>
            {amount}
          </Text>
          <Text style={{ fontFamily: Rubik.medium, fontSize: Type.subheading, color: theme.textSecondary }}>{unit}</Text>
        </View>
        {roundButton(() => set(stepUp(value)), 'plus')}
      </View>
      <View style={{ flexDirection: 'row', gap: 8, marginTop: 16, justifyContent: 'center', flexWrap: 'wrap' }}>
        {presets.map((p) => (
          <Chip key={p} size="sm" selected={p === value} onPress={() => set(p)}>
            {formatStepDuration(p)}
          </Chip>
        ))}
      </View>
    </View>
  );
}
