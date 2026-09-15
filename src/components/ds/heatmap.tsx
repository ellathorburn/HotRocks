import { View, type ViewStyle } from 'react-native';

import { ColdRamp, HeatRamp } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type HeatmapDay = number | { heat?: number; cold?: number };

type HeatmapProps = {
  weeks?: number;
  data?: HeatmapDay[];
  cell?: number;
  gap?: number;
  style?: ViewStyle;
};

const clamp = (v: number | undefined) => Math.max(0, Math.min(4, Math.round(v || 0)));

/**
 * Calendar heatmap on the brand's heat ramp, laid out as 7 rows (days) by N
 * columns (weeks), most recent week last — the RN analogue of the web
 * grid-auto-flow: column layout.
 */
export function Heatmap({ weeks = 15, data = [], cell = 13, gap = 4, style }: HeatmapProps) {
  const theme = useTheme();
  const values = data.length ? data : Array.from({ length: weeks * 7 }, () => 0);
  const columns = Math.ceil(values.length / 7);

  return (
    <View style={[{ flexDirection: 'row', gap }, style]}>
      {Array.from({ length: columns }).map((_, col) => (
        <View key={col} style={{ gap }}>
          {Array.from({ length: 7 }).map((__, row) => {
            const i = col * 7 + row;
            const v = values[i];
            if (v === undefined) return <View key={row} style={{ width: cell, height: cell }} />;

            const heat = clamp(typeof v === 'number' ? v : v.heat);
            const cold = clamp(typeof v === 'number' ? 0 : v.cold);
            let background: string = theme.surfaceSunken;
            if (heat) background = HeatRamp[heat];
            if (cold) background = ColdRamp[cold];

            return (
              <View
                key={row}
                style={{
                  width: cell,
                  height: cell,
                  borderRadius: 3,
                  backgroundColor: background,
                }}
              />
            );
          })}
        </View>
      ))}
    </View>
  );
}
