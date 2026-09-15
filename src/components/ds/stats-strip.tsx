import { Text, View, type ViewStyle } from 'react-native';

import { Rubik } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

import { Label } from './label';

export type Stat = { label: string; value: string | number; unit?: string; tone?: 'hot' | 'cold' | 'neutral' };

type StatsStripProps = {
  stats: Stat[];
  style?: ViewStyle;
};

/** Compact totals row: sessions, rounds, time. Labels read Sauna and Plunge, never Heat/Cold. */
export function StatsStrip({ stats, style }: StatsStripProps) {
  const theme = useTheme();

  return (
    <View style={[{ flexDirection: 'row' }, style]}>
      {stats.map((s, i) => (
        <View
          key={i}
          style={{
            flex: 1,
            gap: 4,
            paddingRight: 8,
            paddingLeft: i === 0 ? 0 : 14,
            borderLeftWidth: i === 0 ? 0 : 1,
            borderLeftColor: theme.border,
          }}>
          <Label>{s.label}</Label>
          <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 3 }}>
            <Text
              style={{
                fontFamily: Rubik.bold,
                fontSize: 26,
                fontVariant: ['tabular-nums'],
                color: s.tone === 'hot' ? theme.hot : s.tone === 'cold' ? theme.coldInk : theme.text,
              }}>
              {s.value}
            </Text>
            {s.unit ? <Text style={{ fontFamily: Rubik.regular, fontSize: 13, color: theme.textSecondary }}>{s.unit}</Text> : null}
          </View>
        </View>
      ))}
    </View>
  );
}
