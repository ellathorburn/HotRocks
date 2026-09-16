import { router } from 'expo-router';
import { ulid } from 'ulid';
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Badge, Button, RoundStrip, SegmentedControl, Sheet, TimerDisplay } from '@/components/ds';
import type { RoundSegment } from '@/components/ds';
import { NavBar } from '@/components/nav-bar';
import { ScreenGutter } from '@/constants/theme';
import type { Round, RoundPart } from '@/features/sessions/domain/session';
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
  const [history, setHistory] = useState<RoundPart[]>([]);
  const [sessionStartedAt, setSessionStartedAt] = useState<string | null>(null);

  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, [running]);

  const start = () => {
    setSessionStartedAt((current) => current ?? new Date().toISOString());
    setRunning(true);
    setSeconds(0);
  };

  const stop = () => {
    setRunning(false);
    setHistory((current) => [...current, {
      id: ulid(),
      kind: type,
      durationSeconds: Math.max(1, seconds),
      temperatureCTenths: null,
    }]);
    setHandoff(true);
  };

  const finish = () => {
    const rounds = history.reduce<Round[]>((result, part) => {
      const previous = result.at(-1);
      if (part.kind === 'cold' && previous?.parts.length === 1 && previous.parts[0].kind === 'heat') {
        previous.parts.push(part);
      } else {
        result.push({ id: ulid(), parts: [part] });
      }
      return result;
    }, []);
    const startedAt = sessionStartedAt ?? new Date().toISOString();
    const elapsedSeconds = Math.max(1, Math.round((Date.now() - new Date(startedAt).getTime()) / 1000));
    router.push({
      pathname: '/session/summary',
      params: { rounds: JSON.stringify(rounds), startedAt, elapsedSeconds: String(elapsedSeconds), entryMethod: 'timer' },
    });
    setHandoff(false);
    setHistory([]);
    setSessionStartedAt(null);
  };

  const stripSegments: RoundSegment[] = [
    ...history.map((part) => ({ type: part.kind, minutes: part.durationSeconds / 60 })),
    ...(running ? [{ type, minutes: Math.max(1 / 60, seconds / 60) } as RoundSegment] : []),
  ];

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
        {stripSegments.length > 0 ? <RoundStrip segments={stripSegments} height={12} showLabels={false} style={{ width: 260 }} /> : null}
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
              onPress={finish}>
              Finish
            </Button>
          </View>
        </View>
      </Sheet>
    </SafeAreaView>
  );
}
