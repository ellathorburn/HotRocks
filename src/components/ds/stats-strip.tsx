import { Text, View, type ViewStyle } from 'react-native';

import { Rubik } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

import { Label } from './label';

export type Stat = { label: string; value: string | number; unit?: string; tone?: 'hot' | 'cold' | 'neutral' };

type StatsStripProps = {
  stats: Stat[];
  style?: ViewStyle;
};

/**
 * Totals as a grid of at most two per row, so labels never break mid-word and
 * values stay on one line on narrow phones. Labels read Sauna, Plunge and
 * Break, never Heat/Cold.
 */
export function StatsStrip({ stats, style }: StatsStripProps) {
  const theme = useTheme();
  const rows = Array.from({ length: Math.ceil(stats.length / 2) }, (_, index) => stats.slice(index * 2, index * 2 + 2));

  return (
    <View style={[{ gap: 14 }, style]}>
      {rows.map((row, rowIndex) => (
        <View key={rowIndex} style={{ flexDirection: 'row' }}>
          {row.map((stat, index) => (
            <View
              key={stat.label}
              style={{
                flex: 1,
                gap: 4,
                paddingRight: 8,
                paddingLeft: index === 0 ? 0 : 14,
                borderLeftWidth: index === 0 ? 0 : 1,
                borderLeftColor: theme.border,
              }}>
              <Label numberOfLines={1}>{stat.label}</Label>
              <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 3 }}>
                <Text
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  minimumFontScale={0.7}
                  style={{
                    flexShrink: 1,
                    fontFamily: Rubik.bold,
                    fontSize: 24,
                    lineHeight: 28,
                    letterSpacing: -0.48,
                    fontVariant: ['tabular-nums'],
                    color: stat.tone === 'hot' ? theme.hot : stat.tone === 'cold' ? theme.coldInk : theme.text,
                  }}>
                  {stat.value}
                </Text>
                {stat.unit ? <Text style={{ fontFamily: Rubik.regular, fontSize: 13, color: theme.textSecondary }}>{stat.unit}</Text> : null}
              </View>
            </View>
          ))}
          {row.length === 1 ? <View style={{ flex: 1 }} /> : null}
        </View>
      ))}
    </View>
  );
}
