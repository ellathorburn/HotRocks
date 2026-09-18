import { router, useFocusEffect } from 'expo-router';
import { setStatusBarStyle } from 'expo-status-bar';
import { useCallback, useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  ActivityPicker,
  Badge,
  Button,
  Icon,
  Sheet,
  TimelineStrip,
  TimerDisplay,
  intervalMeta,
} from '@/components/ds';
import { NavBar } from '@/components/nav-bar';
import { Radius, Rubik, ScreenGutter, Type } from '@/constants/theme';
import { useDisplayPreferences } from '@/features/profiles/hooks/use-display-preferences';
import { useSessionTimelineDraft } from '@/features/sessions/hooks/use-session-timeline-draft';
import { toSessionInterval } from '@/features/sessions/services/session-calculation-service';
import { sessionTimelineDraftService } from '@/features/sessions/services/session-draft-service';
import type { SessionIntervalKind } from '@/features/sessions/types/session-types';
import { MIN_INTERVAL_SECONDS } from '@/features/sessions/validation/session-validation';
import { ThemeSchemeContext, useTheme } from '@/hooks/use-theme';
import { formatTimerClock, formatTotalDuration, INTERVAL_LABELS } from '@/lib/format';
import { createId } from '@/lib/ids';

/**
 * Live timer for one visit. Each completed block is written straight into a
 * timeline draft, so the session survives leaving the screen and the summary
 * receives real wall-clock time. Dark by default: it is read at arm's length
 * in dim changing rooms, so it ignores the system scheme.
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
  const preferences = useDisplayPreferences();
  const [draftId, setDraftId] = useState<string | null>(null);
  const { draft, segments, allowedKinds, canSave } = useSessionTimelineDraft(draftId ?? '', preferences);

  const [kind, setKind] = useState<SessionIntervalKind>('heat');
  const [selectedKind, setSelectedKind] = useState<SessionIntervalKind | null>(null);
  const [running, setRunning] = useState(false);
  const [segmentStartedAtMs, setSegmentStartedAtMs] = useState<number | null>(null);
  const [accumulatedSeconds, setAccumulatedSeconds] = useState(0);
  const [clockNow, setClockNow] = useState(0);
  const [completedSeconds, setCompletedSeconds] = useState(0);
  const [handoffOpen, setHandoffOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

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

  const start = useCallback((next: SessionIntervalKind) => {
    if (!preferences.userId) return;
    const now = Date.now();
    setErrorMessage(null);
    setKind(next);
    setAccumulatedSeconds(0);
    setSegmentStartedAtMs(now);
    setClockNow(now);
    setRunning(true);
    if (!draftId) {
      setDraftId(sessionTimelineDraftService.create(preferences.userId, {
        intervals: [],
        venueName: null,
        rating: null,
        note: null,
        startedAt: new Date(now).toISOString(),
        elapsedSeconds: 0,
        entryMethod: 'timer',
      }));
    }
  }, [draftId, preferences.userId]);

  const stop = () => {
    // The button is disabled below the minimum; this guards a stale tap.
    if (seconds < MIN_INTERVAL_SECONDS || !draftId || !preferences.userId || !draft) return;
    setErrorMessage(null);
    const durationSeconds = seconds;
    setRunning(false);
    setSegmentStartedAtMs(null);
    setAccumulatedSeconds(0);
    setCompletedSeconds(durationSeconds);

    try {
      sessionTimelineDraftService.addInterval(draftId, preferences.userId, toSessionInterval({
        id: createId(),
        kind,
        durationSeconds,
        // The timer cannot know a temperature; it is added on the summary.
        temperatureCTenths: null,
      }));
      sessionTimelineDraftService.setElapsedSeconds(
        draftId,
        preferences.userId,
        (Date.now() - new Date(draft.startedAt).getTime()) / 1000,
      );
      setHandoffOpen(true);
    } catch (error) {
      if (__DEV__) console.error('Recording a timed entry failed', error);
      setErrorMessage('Could not record that block. Try again.');
    }
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

  const startNext = (next: SessionIntervalKind) => {
    setHandoffOpen(false);
    start(next);
  };

  const finish = () => {
    if (!draftId) return;
    setHandoffOpen(false);
    router.push({ pathname: '/session/summary', params: { draftId } });
    setDraftId(null);
    setSelectedKind(null);
    setRunning(false);
    setSegmentStartedAtMs(null);
    setAccumulatedSeconds(0);
    setCompletedSeconds(0);
  };

  if (!draftId) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }} edges={['top']}>
        <NavBar title="Start timer" />
        <View style={{ flex: 1, paddingHorizontal: ScreenGutter, justifyContent: 'center', gap: 24 }}>
          <Text style={{ fontFamily: Rubik.semibold, fontSize: 22, color: theme.text, textAlign: 'center' }}>
            What are you starting?
          </Text>
          <ActivityPicker
            value={selectedKind}
            onChange={setSelectedKind}
            // A session cannot open with a break, so the timer never offers one first.
            options={['heat', 'cold']}
          />
        </View>
        <View style={{ paddingHorizontal: ScreenGutter, paddingBottom: 28 }}>
          <Button size="lg" fullWidth disabled={!selectedKind} onPress={() => selectedKind && start(selectedKind)}>
            {selectedKind ? `Start ${INTERVAL_LABELS[selectedKind].toLowerCase()}` : 'Start'}
          </Button>
        </View>
      </SafeAreaView>
    );
  }

  const liveSegments = [
    ...segments,
    ...(seconds > 0 ? [{ kind, durationSeconds: seconds, temperature: null }] : []),
  ];

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }} edges={['top']}>
      <NavBar
        title=""
        trailing={(
          <Badge tone="inverse">
            {draft?.venueName ? `${INTERVAL_LABELS[kind]} · ${draft.venueName}` : INTERVAL_LABELS[kind]}
          </Badge>
        )}
      />
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 40 }}>
        <View style={{ alignItems: 'center', gap: 12 }}>
          <TimerDisplay time={formatTimerClock(seconds)} kind={kind} state={running ? 'running' : 'paused'} size={96} />
          {/* Said up front, so nobody learns the rule by pressing Stop too early. */}
          {seconds < MIN_INTERVAL_SECONDS ? (
            <Text accessibilityLiveRegion="polite" style={{ fontFamily: Rubik.regular, fontSize: Type.small, color: theme.textSecondary }}>
              Stop is available after {MIN_INTERVAL_SECONDS} seconds
            </Text>
          ) : null}
        </View>
        {liveSegments.length > 0 ? (
          <View style={{ alignSelf: 'stretch', paddingHorizontal: ScreenGutter }}>
            <TimelineStrip segments={liveSegments} height={12} showLabels={false} radius={Radius.sm} />
          </View>
        ) : null}
      </View>
      <View style={{ paddingHorizontal: ScreenGutter, paddingBottom: 28, gap: 10 }}>
        {errorMessage ? (
          <Text style={{ fontFamily: Rubik.medium, fontSize: Type.small, color: theme.cedar, textAlign: 'center' }}>
            {errorMessage}
          </Text>
        ) : null}
        {running || accumulatedSeconds > 0 ? (
          <>
            <Button size="lg" fullWidth disabled={seconds < MIN_INTERVAL_SECONDS} onPress={stop}>Stop</Button>
            <Button variant="secondary" size="lg" fullWidth onPress={running ? pause : resume}>
              {running ? 'Pause' : 'Resume'}
            </Button>
          </>
        ) : (
          <Button size="lg" fullWidth disabled={!canSave} onPress={finish}>Finish session</Button>
        )}
      </View>

      <Sheet
        open={handoffOpen}
        title={`${INTERVAL_LABELS[kind]} done, ${formatTotalDuration(completedSeconds)}`}
        onDismiss={() => setHandoffOpen(false)}>
        <View>
          <Text style={{ fontFamily: Rubik.regular, fontSize: Type.body, lineHeight: Type.body * 1.5, color: theme.textSecondary, marginBottom: 18 }}>
            Recorded. What’s next?
          </Text>
          <TimelineStrip segments={segments} height={40} showLabels={false} />
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 20 }}>
            {allowedKinds.map((option) => (
              <Button
                key={option}
                variant="secondary"
                size="lg"
                style={{ flexGrow: 1, flexBasis: '45%' }}
                iconLeft={<Icon name={intervalMeta(option, theme).icon} size={18} color={intervalMeta(option, theme).fill} />}
                onPress={() => startNext(option)}>
                Start {INTERVAL_LABELS[option].toLowerCase()}
              </Button>
            ))}
            <Button size="lg" style={{ flexGrow: 1, flexBasis: '45%' }} disabled={!canSave} onPress={finish}>
              Finish session
            </Button>
          </View>
        </View>
      </Sheet>
    </SafeAreaView>
  );
}
