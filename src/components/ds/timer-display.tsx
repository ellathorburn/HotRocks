import { Text, View, type ViewStyle } from 'react-native';

import { displayText, Rubik } from '@/constants/theme';
import type { SessionIntervalKind } from '@/features/sessions/types/session-types';
import { useTheme } from '@/hooks/use-theme';

import { intervalMeta } from './interval-meta';
import { Label } from './label';

type TimerDisplayProps = {
  time?: string;
  kind?: SessionIntervalKind;
  state?: 'running' | 'paused';
  size?: number;
  caption?: string;
  style?: ViewStyle;
};

const CAPTIONS: Record<SessionIntervalKind, string> = {
  heat: 'In the heat',
  cold: 'In the cold',
  rest: 'On a break',
};

/** The live timer. Legible at arm's length; ember bloom is the one earned glow. */
export function TimerDisplay({ time = '00:00', kind = 'heat', state = 'running', size = 88, caption, style }: TimerDisplayProps) {
  const theme = useTheme();
  const meta = intervalMeta(kind, theme);
  const glow = state === 'running' && kind !== 'rest';

  return (
    <View style={[{ alignItems: 'center', gap: 12 }, style]}>
      <Label style={{ color: meta.fill }}>{caption ?? CAPTIONS[kind]}</Label>
      <Text
        style={{
          fontFamily: Rubik.bold,
          ...displayText(size),
          fontVariant: ['tabular-nums'],
          color: state === 'paused' ? theme.textSecondary : meta.fill,
          textShadowColor: glow
            ? (kind === 'heat' ? 'rgba(227,83,54,0.35)' : 'rgba(126,168,196,0.4)')
            : 'transparent',
          textShadowRadius: glow ? 32 : 0,
        }}>
        {time}
      </Text>
      {state === 'paused' ? <Label>Paused</Label> : null}
    </View>
  );
}
