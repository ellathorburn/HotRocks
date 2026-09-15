import { View, type ViewStyle } from 'react-native';

import { Chip } from './chip';

const DEFAULTS = { heat: [70, 80, 90, 100], cold: [4, 8, 11, 15] } as const;

type TemperatureChipsProps = {
  type?: 'heat' | 'cold';
  value?: number;
  onChange?: (value: number) => void;
  values?: number[];
  unit?: string;
  onManual?: () => void;
  style?: ViewStyle;
};

/** Temperature as taps, not a keyboard. Warm values for heat, cold values for cold. */
export function TemperatureChips({ type = 'heat', value, onChange, values, unit = '°C', onManual, style }: TemperatureChipsProps) {
  const list = values ?? DEFAULTS[type];

  return (
    <View style={[{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'center' }, style]}>
      {list.map((t) => (
        <Chip key={t} tone={type === 'cold' ? 'cold' : 'hot'} selected={t === value} onPress={() => onChange?.(t)}>
          {t}
          {unit}
        </Chip>
      ))}
      <Chip onPress={onManual}>Other</Chip>
    </View>
  );
}
