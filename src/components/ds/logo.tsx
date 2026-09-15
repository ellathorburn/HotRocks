import { Text, View, type ViewStyle } from 'react-native';
import Svg, { Ellipse } from 'react-native-svg';

import { Rubik, Tracking } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type LogoProps = {
  variant?: 'full' | 'dark' | 'mark' | 'mono' | 'wordmark-text';
  height?: number;
  style?: ViewStyle;
};

/**
 * The four-stone mark, cedar → ember → sand from base to tip, so the glow
 * reads as heat off the pile. Holds on both linen and midnight grounds.
 */
function Mark({ height, mono, color }: { height: number; mono?: boolean; color?: string }) {
  const fills = mono ? [color, color, color, color] : ['#A0522D', '#C8462C', '#E35336', '#F4A460'];

  return (
    <Svg width={height} height={height} viewBox="0 0 64 64">
      <Ellipse cx={32} cy={52} rx={26} ry={9.5} fill={fills[0]} />
      <Ellipse cx={30} cy={40} rx={21} ry={8.5} fill={fills[1]} />
      <Ellipse cx={34} cy={29} rx={15.5} ry={7.5} fill={fills[2]} />
      <Ellipse cx={31} cy={20} rx={10} ry={6} fill={fills[3]} />
    </Svg>
  );
}

/** Brand lockup: mark + live-type wordmark, "Hot" in ember, "Rocks" in cedar/sand. */
export function Logo({ variant = 'full', height = 28, style }: LogoProps) {
  const theme = useTheme();
  const onDark = variant === 'dark';

  if (variant === 'mark' || variant === 'mono') {
    return <Mark height={height} mono={variant === 'mono'} color={theme.text} />;
  }

  const wordmark = (
    <Text style={{ fontFamily: Rubik.bold, fontSize: height * 0.95, letterSpacing: Tracking.display, lineHeight: height }}>
      <Text style={{ color: theme.accent }}>Hot</Text>
      <Text style={{ color: onDark ? theme.sand : theme.cedar }}>Rocks</Text>
    </Text>
  );

  if (variant === 'wordmark-text') {
    return <View style={style}>{wordmark}</View>;
  }

  return (
    <View style={[{ flexDirection: 'row', alignItems: 'center', gap: height * 0.3 }, style]}>
      <Mark height={height} />
      {wordmark}
    </View>
  );
}
