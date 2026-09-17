import { Text, View, type ViewStyle } from 'react-native';

import { displayText, Rubik } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

import { Label } from './label';

type TimerDisplayProps = {
  time?: string;
  type?: 'heat' | 'cold';
  state?: 'running' | 'paused';
  size?: number;
  caption?: string;
  style?: ViewStyle;
};

/** The live timer. Legible at arm's length; ember bloom is the one earned glow. */
export function TimerDisplay({ time = '00:00', type = 'heat', state = 'running', size = 88, caption, style }: TimerDisplayProps) {
  const theme = useTheme();
  const hot = type === 'heat';
  const colour = hot ? theme.hot : theme.cold;

  return (
    <View style={[{ alignItems: 'center', gap: 12 }, style]}>
      <Label style={{ color: colour }}>{caption ?? (hot ? 'In the heat' : 'In the cold')}</Label>
      <Text
        style={{
          fontFamily: Rubik.bold,
          ...displayText(size),
          fontVariant: ['tabular-nums'],
          color: state === 'paused' ? theme.textSecondary : colour,
          textShadowColor: state === 'running' && hot ? 'rgba(227,83,54,0.35)' : 'transparent',
          textShadowRadius: state === 'running' && hot ? 32 : 0,
        }}>
        {time}
      </Text>
      {state === 'paused' ? <Label>Paused</Label> : null}
    </View>
  );
}
