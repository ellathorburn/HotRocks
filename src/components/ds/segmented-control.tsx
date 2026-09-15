import { Pressable, Text, View, type ViewStyle } from 'react-native';

import { Radius, Rubik } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

import { Icon, type IconName } from './icon';

type Option = { value: string; label: string; icon?: IconName; tone?: 'hot' | 'cold' | 'neutral' };

type SegmentedControlProps = {
  options: Option[];
  value: string;
  onChange: (value: string) => void;
  style?: ViewStyle;
};

/** Two-way heat/cold choice. Large targets, never a dropdown. */
export function SegmentedControl({ options, value, onChange, style }: SegmentedControlProps) {
  const theme = useTheme();
  const toneFill = { hot: theme.accent, cold: theme.cold, neutral: theme.text };

  return (
    <View style={[{ flexDirection: 'row', gap: 10 }, style]}>
      {options.map((o) => {
        const on = o.value === value;
        const fill = toneFill[o.tone ?? 'neutral'];
        return (
          <Pressable
            key={o.value}
            onPress={() => onChange(o.value)}
            style={{
              flex: 1,
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              minHeight: 92,
              paddingVertical: 12,
              paddingHorizontal: 8,
              borderRadius: Radius.md,
              backgroundColor: on ? fill : 'transparent',
              borderWidth: on ? 0 : 1,
              borderColor: theme.borderStrong,
            }}>
            {o.icon ? <Icon name={o.icon} size={26} color={on ? theme.textOnAccent : theme.textSecondary} /> : null}
            <Text style={{ fontFamily: Rubik.semibold, fontSize: 17, color: on ? theme.textOnAccent : theme.textSecondary }}>
              {o.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
