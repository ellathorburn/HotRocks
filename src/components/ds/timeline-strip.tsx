import { Text, View, type ViewStyle } from 'react-native';

import { Radius, Rubik } from '@/constants/theme';
import type { SessionIntervalKind } from '@/features/sessions/types/session-types';
import { useTheme } from '@/hooks/use-theme';
import { describeComposition, formatStepDurationCompact } from '@/lib/format';

import { Icon } from './icon';
import { intervalMeta } from './interval-meta';

export type TimelineSegment = {
  kind: SessionIntervalKind;
  durationSeconds: number;
  /** Formatted in the account's unit, e.g. "90°C"; null when none was recorded. */
  temperature?: string | null;
};

type TimelineStripProps = {
  segments: TimelineSegment[];
  height?: number;
  showLabels?: boolean;
  radius?: number;
  gap?: number;
  style?: ViewStyle;
};

/**
 * The shape of a visit at a glance: one block per timeline entry, ember for
 * sauna, ice for cold, indigo for a break, each block's width proportional to
 * its duration. Replaces the GPS map a Strava activity carries.
 */
export function TimelineStrip({
  segments,
  height = 56,
  showLabels = true,
  radius = Radius.md,
  gap = 2,
  style,
}: TimelineStripProps) {
  const theme = useTheme();
  const total = segments.reduce((sum, segment) => sum + segment.durationSeconds, 0) || 1;
  const showIcon = height >= 28;
  const showText = showLabels && height >= 40;

  return (
    <View
      accessibilityRole="image"
      accessibilityLabel={`Session timeline: ${describeSegments(segments)}`}
      style={[{ flexDirection: 'row', gap, width: '100%', height, borderRadius: radius, overflow: 'hidden' }, style]}>
      {segments.map((segment, index) => {
        const meta = intervalMeta(segment.kind, theme);
        const share = (segment.durationSeconds / total) * 100;
        const minutes = segment.durationSeconds / 60;
        return (
          <View
            key={index}
            style={{
              // flexGrow rather than a % width, so the gaps never push the last block out.
              flexGrow: Math.max(segment.durationSeconds, 1),
              flexBasis: 0,
              minWidth: 10,
              backgroundColor: meta.fill,
              alignItems: 'center',
              justifyContent: 'center',
              gap: 2,
              overflow: 'hidden',
            }}>
            {showIcon && minutes >= 2 ? (
              <Icon name={meta.icon} size={showText ? 11 : Math.min(12, height - 8)} color={meta.ink} />
            ) : null}
            {showText && share > 8 ? (
              <>
                <Text
                  numberOfLines={1}
                  style={{ fontFamily: Rubik.semibold, fontSize: 13, lineHeight: 15, color: meta.ink, fontVariant: ['tabular-nums'] }}>
                  {formatStepDurationCompact(segment.durationSeconds)}
                </Text>
                {segment.temperature != null ? (
                  <Text
                    numberOfLines={1}
                    style={{ fontFamily: Rubik.medium, fontSize: 10, lineHeight: 11, letterSpacing: 0.2, color: meta.ink, opacity: 0.75 }}>
                    {segment.temperature}
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

function describeSegments(segments: TimelineSegment[]): string {
  if (segments.length === 0) return 'empty';
  return describeComposition({
    heatIntervalCount: segments.filter((segment) => segment.kind === 'heat').length,
    coldIntervalCount: segments.filter((segment) => segment.kind === 'cold').length,
    restIntervalCount: segments.filter((segment) => segment.kind === 'rest').length,
  });
}
