import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Badge, Button, RoundStrip, SegmentedControl, Sheet, TimerDisplay } from '@/components/ds';
import type { RoundSegment } from '@/components/ds';
import { NavBar } from '@/components/nav-bar';
import { ScreenGutter } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

function formatClock(totalSeconds: number) {
  const mm = String(Math.floor(totalSeconds / 60)).padStart(2, '0');
  const ss = String(totalSeconds % 60).padStart(2, '0');
  return `${mm}:${ss}`;
}

/**
 * Quick-start timer: pick heat or cold, watch the clock, hand off into the
 * next half of the round when it ends. Mirrors the design's TimerScreen —
 * a full manual session (venue, rating, photos) still goes through
 * `/log-round`.
 */
export default function TimerScreen() {
  const theme = useTheme();
  const [type, setType] = useState<'heat' | 'cold'>('heat');
  const [running, setRunning] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [handoff, setHandoff] = useState(false);
  const [history, setHistory] = useState<RoundSegment[]>([]);

  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, [running]);

  const start = () => {
    setRunning(true);
    setSeconds(0);
  };

  const stop = () => {
    setRunning(false);
    setHistory((h) => [...h, { type, minutes: Math.max(1, Math.round(seconds / 60)) }]);
    setHandoff(true);
  };

  if (!running && !handoff && history.length === 0) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }} edges={['top']}>
        <NavBar title="Timer" />
        <View style={{ flex: 1, paddingHorizontal: ScreenGutter, justifyContent: 'center', gap: 28 }}>
          <SegmentedControl
            value={type}
            onChange={(v) => setType(v as 'heat' | 'cold')}
            options={[
              { value: 'heat', label: 'Sauna', icon: 'flame', tone: 'hot' },
              { value: 'cold', label: 'Plunge', icon: 'snowflake', tone: 'cold' },
            ]}
          />
          <Button size="lg" fullWidth onPress={start}>
            Start {type === 'heat' ? 'sauna' : 'plunge'} timer
          </Button>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }} edges={['top']}>
      <NavBar title="" trailing={<Badge tone="inverse">{type === 'heat' ? 'Sauna' : 'Plunge'} round</Badge>} />
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 40 }}>
        <TimerDisplay time={formatClock(seconds)} type={type} state={running ? 'running' : 'paused'} size={88} />
        {history.length > 0 ? <RoundStrip segments={[...history, { type, minutes: Math.max(1, Math.round(seconds / 60)) }]} height={12} showLabels={false} style={{ width: 260 }} /> : null}
      </View>
      <View style={{ paddingHorizontal: ScreenGutter, paddingBottom: 28, gap: 10 }}>
        <Button size="lg" fullWidth onPress={stop}>
          Stop this round
        </Button>
        <Button variant="secondary" size="lg" fullWidth onPress={() => setRunning((r) => !r)}>
          {running ? 'Pause' : 'Resume'}
        </Button>
      </View>

      <Sheet
        open={handoff}
        title={`${type === 'heat' ? 'Heat' : 'Cold'} round done, ${formatClock(seconds)}`}
        onDismiss={() => setHandoff(false)}>
        <View style={{ gap: 18 }}>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <Button
              variant="secondary"
              size="lg"
              style={{ flex: 1 }}
              onPress={() => {
                setType(type === 'heat' ? 'cold' : 'heat');
                setHandoff(false);
                start();
              }}>
              {type === 'heat' ? 'Start cold' : 'Start heat'}
            </Button>
            <Button
              variant="secondary"
              size="lg"
              style={{ flex: 1 }}
              onPress={() => {
                setHandoff(false);
                setHistory([]);
                router.push('/session/summary');
              }}>
              Finish
            </Button>
          </View>
        </View>
      </Sheet>
    </SafeAreaView>
  );
}
