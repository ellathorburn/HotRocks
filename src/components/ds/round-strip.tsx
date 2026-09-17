import { Text, View, type ViewStyle } from 'react-native';

import { Rubik } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type RoundSegment = { type: 'heat' | 'cold'; minutes: number; temp?: number | null };

type RoundStripProps = {
  segments: RoundSegment[];
  height?: number;
  showLabels?: boolean;
  radius?: number;
  gap?: number;
  style?: ViewStyle;
};

/**
 * The shape of a session at a glance: alternating blocks, ember for heat and
 * ice for cold, each block's width proportional to its duration. Replaces
 * the GPS map a Strava activity carries.
 */
export function RoundStrip({ segments, height = 56, showLabels = true, radius = 10, gap = 2, style }: RoundStripProps) {
  const theme = useTheme();
  const total = segments.reduce((a, s) => a + (s.minutes || 0), 0) || 1;

  return (
    <View style={[{ flexDirection: 'row', gap, width: '100%', height, borderRadius: radius, overflow: 'hidden' }, style]}>
      {segments.map((s, i) => {
        const hot = s.type === 'heat';
        const pct = ((s.minutes || 0) / total) * 100;
        return (
          <View
            key={i}
            style={{
              // flexGrow rather than a % width, so the gaps never push the last block out.
              flexGrow: Math.max(s.minutes || 0, 0.01),
              flexBasis: 0,
              minWidth: 10,
              backgroundColor: hot ? theme.hot : theme.cold,
              alignItems: 'center',
              justifyContent: 'center',
              gap: 2,
              overflow: 'hidden',
            }}>
            {showLabels && height >= 40 && pct > 8 ? (
              <>
                <Text
                  numberOfLines={1}
                  style={{ fontFamily: Rubik.semibold, fontSize: 15, lineHeight: 16, color: theme.textOnAccent, fontVariant: ['tabular-nums'] }}>
                  {Math.max(1, Math.round(s.minutes))}′
                </Text>
                {s.temp != null ? (
                  <Text
                    numberOfLines={1}
                    style={{ fontFamily: Rubik.medium, fontSize: 11, lineHeight: 12, letterSpacing: 0.2, color: theme.textOnAccent, opacity: 0.75 }}>
                    {Math.round(s.temp)}°
                  </Text>
                ) : null}
              </>
            ) : null}
          </View>
        );
      })}
    </View>
  );
}
