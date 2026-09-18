import { useState } from 'react';
import { TextInput, View, type ViewStyle } from 'react-native';

import { Radius, Rubik, Type } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import {
  temperatureUnitSymbol,
  toDisplayTemperature,
  toTemperatureCTenths,
  type TemperatureUnit,
} from '@/lib/format';

import { Chip } from './chip';

const PRESETS = {
  heat: { celsius: [70, 80, 90, 100], fahrenheit: [160, 175, 195, 210] },
  cold: { celsius: [4, 8, 11, 15], fahrenheit: [39, 46, 52, 59] },
} as const;

type TemperatureChipsProps = {
  kind: 'heat' | 'cold';
  unit: TemperatureUnit;
  /** Canonical tenths of a degree Celsius, or null when none was recorded. */
  valueCTenths: number | null;
  onChange: (valueCTenths: number | null) => void;
  style?: ViewStyle;
};

/**
 * Temperature as taps, not a keyboard, with the account's unit converted to
 * canonical tenths of a degree Celsius on the way in. Temperature is optional:
 * tapping the selected value clears it.
 */
export function TemperatureChips({ kind, unit, valueCTenths, onChange, style }: TemperatureChipsProps) {
  const theme = useTheme();
  const [manual, setManual] = useState(false);
  const presets = PRESETS[kind][unit];
  const displayed = valueCTenths === null ? null : toDisplayTemperature(valueCTenths, unit);
  const isPreset = displayed !== null && presets.includes(displayed as never);

  return (
    <View style={style}>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
        {presets.map((preset) => (
          <Chip
            key={preset}
            tone={kind === 'cold' ? 'cold' : 'hot'}
            selected={preset === displayed}
            onPress={() => {
              setManual(false);
              onChange(preset === displayed ? null : toTemperatureCTenths(preset, unit));
            }}>
            {preset}
            {temperatureUnitSymbol(unit)}
          </Chip>
        ))}
        <Chip selected={manual || (displayed !== null && !isPreset)} onPress={() => setManual((open) => !open)}>
          Other
        </Chip>
      </View>
      {manual || (displayed !== null && !isPreset) ? (
        <TextInput
          keyboardType="numbers-and-punctuation"
          inputMode="numeric"
          accessibilityLabel={`Temperature in ${unit === 'fahrenheit' ? 'Fahrenheit' : 'Celsius'}`}
          placeholder={`Temperature in ${temperatureUnitSymbol(unit)}`}
          placeholderTextColor={theme.textSecondary}
          defaultValue={displayed !== null && !isPreset ? String(displayed) : ''}
          onChangeText={(text) => {
            const parsed = Number(text.replace(',', '.'));
            onChange(text.trim() === '' || Number.isNaN(parsed) ? null : toTemperatureCTenths(parsed, unit));
          }}
          style={{
            marginTop: 10,
            minHeight: 48,
            paddingHorizontal: 14,
            borderRadius: Radius.md,
            borderWidth: 1,
            borderColor: theme.borderStrong,
            fontFamily: Rubik.regular,
            fontSize: Type.body,
            color: theme.text,
          }}
        />
      ) : null}
    </View>
  );
}
