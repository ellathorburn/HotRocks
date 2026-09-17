import { router, useFocusEffect } from 'expo-router';
import { setStatusBarStyle } from 'expo-status-bar';
import { useCallback, useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Badge, Button, Icon, RoundStrip, SegmentedControl, Sheet, TimerDisplay } from '@/components/ds';
import type { RoundSegment } from '@/components/ds';
import { NavBar } from '@/components/nav-bar';
import { Radius, Rubik, ScreenGutter, Type } from '@/constants/theme';
import { useAuth } from '@/features/auth/auth-context';
import { createSessionDraft } from '@/features/sessions/data/session-draft-repository';
import type { Round, RoundPart } from '@/features/sessions/domain/session';
import { ThemeSchemeContext, useTheme } from '@/hooks/use-theme';
import { formatTimerClock } from '@/lib/format';
import { createId } from '@/lib/ids';

/**
 * Quick-start timer: pick heat or cold, watch the clock, hand off into the
 * next half of the round when it ends. Mirrors the design's TimerScreen —
 * a full manual session (venue, rating, photos) still goes through
 * `/log-round`. Dark by default: it is read at arm's length in dim changing
 * rooms, so it ignores the system scheme.
 */
export default function TimerScreen() {
  useFocusEffect(useCallback(() => {
    setStatusBarStyle('light');
    return () => setStatusBarStyle('auto');
  }, []));

  return (
    <ThemeSchemeContext value="dark">
      <TimerContent />
    </ThemeSchemeContext>
  );
}

function TimerContent() {
  const theme = useTheme();
  const { user } = useAuth();
  const [type, setType] = useState<'heat' | 'cold'>('heat');
  const [running, setRunning] = useState(false);
  const [segmentStartedAtMs, setSegmentStartedAtMs] = useState<number | null>(null);
  const [accumulatedSeconds, setAccumulatedSeconds] = useState(0);
  const [clockNow, setClockNow] = useState(0);
  const [lastCompletedSeconds, setLastCompletedSeconds] = useState(0);
  const [handoff, setHandoff] = useState(false);
  const [history, setHistory] = useState<RoundPart[]>([]);
  const [sessionStartedAt, setSessionStartedAt] = useState<string | null>(null);

  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => setClockNow(Date.now()), 250);
    return () => clearInterval(id);
  }, [running]);

  const seconds = accumulatedSeconds + (
    running && segmentStartedAtMs !== null
      ? Math.max(0, Math.floor((clockNow - segmentStartedAtMs) / 1000))
      : 0
  );

  const start = () => {
    const now = Date.now();
    setSessionStartedAt((current) => current ?? new Date().toISOString());
    setAccumulatedSeconds(0);
    setSegmentStartedAtMs(now);
    setClockNow(now);
    setRunning(true);
  };

  const stop = () => {
    if (seconds <= 0) return;
    const durationSeconds = Math.max(1, seconds);
    setRunning(false);
    setSegmentStartedAtMs(null);
    setAccumulatedSeconds(0);
    setLastCompletedSeconds(durationSeconds);
    setHistory((current) => [...current, {
      id: createId(),
      kind: type,
      durationSeconds,
      temperatureCTenths: null,
    }]);
    setHandoff(true);
  };

  const pause = () => {
    if (!running) return;
    setAccumulatedSeconds(seconds);
    setSegmentStartedAtMs(null);
    setRunning(false);
  };

  const resume = () => {
    const now = Date.now();
    setSegmentStartedAtMs(now);
    setClockNow(now);
    setRunning(true);
  };

  const startNext = () => {
    setType((current) => current === 'heat' ? 'cold' : 'heat');
    setHandoff(false);
    start();
  };

  const finish = () => {
    if (!user || history.length === 0) return;
    const rounds = history.reduce<Round[]>((result, part) => {
      const previous = result.at(-1);
      if (part.kind === 'cold' && previous?.parts.length === 1 && previous.parts[0].kind === 'heat') {
        previous.parts.push(part);
      } else {
        result.push({ id: createId(), parts: [part] });
      }
      return result;
    }, []);
    const startedAt = sessionStartedAt ?? new Date().toISOString();
    const elapsedSeconds = Math.max(1, Math.round((Date.now() - new Date(startedAt).getTime()) / 1000));
    const draftId = createSessionDraft(user.id, {
      rounds,
      venueName: null,
      rating: null,
      note: null,
      startedAt,
      elapsedSeconds,
      entryMethod: 'timer',
    });
    router.push({ pathname: '/session/summary', params: { draftId } });
    setHandoff(false);
    setHistory([]);
    setSessionStartedAt(null);
    setAccumulatedSeconds(0);
    setSegmentStartedAtMs(null);
    setLastCompletedSeconds(0);
  };

  const stripSegments: RoundSegment[] = [
    ...history.map((part) => ({ type: part.kind, minutes: part.durationSeconds / 60 })),
    ...(seconds > 0 ? [{ type, minutes: Math.max(1 / 60, seconds / 60) } as RoundSegment] : []),
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
        <TimerDisplay time={formatTimerClock(seconds)} type={type} state={running ? 'running' : 'paused'} size={96} />
        {stripSegments.length > 0 ? (
          <View style={{ alignSelf: 'stretch', paddingHorizontal: ScreenGutter }}>
            <RoundStrip segments={stripSegments} height={12} showLabels={false} radius={Radius.sm} />
          </View>
        ) : null}
      </View>
      <View style={{ paddingHorizontal: ScreenGutter, paddingBottom: 28, gap: 10 }}>
        {running || accumulatedSeconds > 0 ? (
          <>
            <Button size="lg" fullWidth onPress={stop}>Stop this round</Button>
            <Button variant="secondary" size="lg" fullWidth onPress={running ? pause : resume}>
              {running ? 'Pause' : 'Resume'}
            </Button>
          </>
        ) : (
          <>
            <Button size="lg" fullWidth onPress={startNext}>
              Start {type === 'heat' ? 'cold' : 'heat'}
            </Button>
            <Button variant="secondary" size="lg" fullWidth onPress={finish}>Finish session</Button>
          </>
        )}
      </View>

      <Sheet
        open={handoff}
        title={`${type === 'heat' ? 'Heat' : 'Cold'} round done, ${formatTimerClock(lastCompletedSeconds)}`}
        onDismiss={() => setHandoff(false)}>
        <View style={{ gap: 18 }}>
          <Text style={{ fontFamily: Rubik.regular, fontSize: Type.body, lineHeight: Type.body * 1.5, color: theme.textSecondary }}>
            {type === 'heat' ? 'Straight into the cold, or call it a session?' : 'Back into the heat, or call it a session?'}
          </Text>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <Button
              variant="secondary"
              size="lg"
              style={{ flex: 1 }}
              iconLeft={<Icon name={type === 'heat' ? 'snowflake' : 'flame'} size={18} color={type === 'heat' ? theme.cold : theme.hot} />}
              onPress={startNext}>
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
