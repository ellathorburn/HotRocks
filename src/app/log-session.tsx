import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  ActivityPicker,
  Badge,
  Button,
  DurationStepper,
  Icon,
  Label,
  Sheet,
  TemperatureChips,
  TimelineList,
  TimelineStrip,
  intervalMeta,
} from '@/components/ds';
import { NavBar } from '@/components/nav-bar';
import { Rubik, ScreenGutter, Type } from '@/constants/theme';
import {
  useDisplayPreferences,
  type DisplayPreferences,
} from '@/features/profiles/hooks/use-display-preferences';
import { useSessionTimelineDraft } from '@/features/sessions/hooks/use-session-timeline-draft';
import {
  lastTemperatureCTenths,
  toSessionInterval,
} from '@/features/sessions/services/session-calculation-service';
import {
  describeTimelineRuleError,
  sessionTimelineDraftService,
} from '@/features/sessions/services/session-draft-service';
import type { IntervalValues, SessionIntervalKind } from '@/features/sessions/types/session-types';
import { MIN_INTERVAL_SECONDS } from '@/features/sessions/validation/session-validation';
import { useTheme } from '@/hooks/use-theme';
import { formatStepDuration, formatTotalDuration, INTERVAL_LABELS } from '@/lib/format';
import { createId } from '@/lib/ids';
import { singleRouteParam } from '@/lib/route-params';

/** Duration presets and starting values per activity, in seconds. */
const DURATIONS: Record<SessionIntervalKind, { presets: number[]; initial: number }> = {
  heat: { presets: [600, 900, 1200, 1800], initial: 900 },
  cold: { presets: [30, 60, 120, 180, 300], initial: 120 },
  rest: { presets: [180, 300, 480, 600], initial: 300 },
};

/** Fallback temperatures when nothing comparable has been logged yet. */
const INITIAL_TEMPERATURE_C_TENTHS = { heat: 900, cold: 110 } as const;

/**
 * Adds one entry to a session timeline. A session is an ordered list of sauna,
 * cold plunge and break entries in any combination; the services decide which
 * kinds may be added next, and the first entry is never a break.
 */
export default function LogSessionScreen() {
  const theme = useTheme();
  const preferences = useDisplayPreferences();
  const params = useLocalSearchParams<{ draftId?: string | string[]; entryId?: string | string[] }>();
  const [draftId, setDraftId] = useState(singleRouteParam(params.draftId));
  const editingId = singleRouteParam(params.entryId);
  const draft = useSessionTimelineDraft(draftId ?? '', preferences);
  const editing = draft.intervals.find((interval) => interval.id === editingId) ?? null;

  // An entry being edited only exists once the draft has loaded, so the form is
  // mounted with its values rather than updating state from an effect.
  if (editingId && !editing) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }} edges={['top']}>
        <NavBar title="Edit entry" showBack />
        {draft.isLoaded ? (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: ScreenGutter }}>
            <Text style={{ fontFamily: Rubik.medium, fontSize: Type.body, color: theme.textSecondary }}>
              That entry is no longer part of this session.
            </Text>
          </View>
        ) : null}
      </SafeAreaView>
    );
  }

  return (
    <EntryForm
      key={editing?.id ?? 'new-entry'}
      preferences={preferences}
      draft={draft}
      draftId={draftId}
      onDraftCreated={setDraftId}
      editing={editing}
    />
  );
}

type EntryFormProps = {
  preferences: DisplayPreferences;
  draft: ReturnType<typeof useSessionTimelineDraft>;
  draftId: string | null;
  onDraftCreated: (draftId: string) => void;
  editing: IntervalValues | null;
};

function EntryForm({ preferences, draft, draftId, onDraftCreated, editing }: EntryFormProps) {
  const theme = useTheme();
  const { intervals, entries, segments, composition, totals, allowedKinds, canSave } = draft;
  const editingIndex = editing ? intervals.findIndex((interval) => interval.id === editing.id) : -1;

  const [kind, setKind] = useState<SessionIntervalKind>(editing?.kind ?? 'heat');
  const [durationSeconds, setDurationSeconds] = useState(
    editing ? Math.max(MIN_INTERVAL_SECONDS, editing.durationSeconds) : DURATIONS.heat.initial,
  );
  const [temperatureCTenths, setTemperatureCTenths] = useState<number | null>(
    editing ? editing.temperatureCTenths : INITIAL_TEMPERATURE_C_TENTHS.heat,
  );
  const [nextOpen, setNextOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // The first entry of a session can never be a break.
  const options = editingIndex === 0 ? (['heat', 'cold'] as SessionIntervalKind[]) : allowedKinds;

  const selectKind = (next: SessionIntervalKind) => {
    setKind(next);
    setDurationSeconds(DURATIONS[next].initial);
    setTemperatureCTenths(next === 'rest'
      ? null
      // Carry the most recent comparable temperature forward.
      : lastTemperatureCTenths(intervals, next) ?? INITIAL_TEMPERATURE_C_TENTHS[next]);
  };

  const saveEntry = () => {
    if (!preferences.userId) return;
    setErrorMessage(null);
    const interval = toSessionInterval({
      id: editing?.id ?? createId(),
      kind,
      durationSeconds,
      temperatureCTenths,
    });

    try {
      if (editing && draftId) {
        sessionTimelineDraftService.updateInterval(draftId, preferences.userId, editing.id, () => interval);
        router.back();
        return;
      }

      const targetDraftId = draftId ?? sessionTimelineDraftService.create(preferences.userId, {
        intervals: [],
        venueName: null,
        rating: null,
        note: null,
        startedAt: new Date().toISOString(),
        elapsedSeconds: 0,
        entryMethod: 'manual',
      });
      sessionTimelineDraftService.addInterval(targetDraftId, preferences.userId, interval);
      onDraftCreated(targetDraftId);
      setNextOpen(true);
    } catch (error) {
      if (__DEV__) console.error('Adding a timeline entry failed', error);
      setErrorMessage(describeTimelineRuleError(error) ?? 'Could not add that entry. Try again.');
    }
  };

  const deleteEntry = (entryId: string) => {
    if (!draftId || !preferences.userId) return;
    setErrorMessage(null);
    try {
      sessionTimelineDraftService.removeInterval(draftId, preferences.userId, entryId);
    } catch (error) {
      setErrorMessage(describeTimelineRuleError(error) ?? 'Could not remove that entry.');
    }
  };

  const addNext = (next: SessionIntervalKind) => {
    setNextOpen(false);
    selectKind(next);
  };

  const finish = () => {
    setNextOpen(false);
    if (draftId) router.replace({ pathname: '/session/summary', params: { draftId } });
  };

  const meta = intervalMeta(kind, theme);
  const badgeText = editing
    ? `Editing entry ${editingIndex + 1}`
    : intervals.length === 0
      ? 'New session'
      : `This session, entry ${intervals.length + 1}`;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }} edges={['top']}>
      <NavBar title={editing ? 'Edit entry' : 'Add to session'} showBack trailing={<Badge>{badgeText}</Badge>} />
      <ScrollView contentContainerStyle={{ paddingHorizontal: ScreenGutter, paddingBottom: 24 }} keyboardShouldPersistTaps="handled">
        <ActivityPicker value={kind} onChange={selectKind} options={options} />
        {options.length < 3 ? (
          <Text style={{ marginTop: 10, fontFamily: Rubik.regular, fontSize: 13, lineHeight: 18, color: theme.textSecondary }}>
            A session starts with a sauna or a cold plunge — add a break once something else is logged.
          </Text>
        ) : null}

        <View style={{ marginTop: 28 }}>
          <Label style={{ textAlign: 'center', marginBottom: 14 }}>Duration</Label>
          <DurationStepper value={durationSeconds} onChange={setDurationSeconds} presets={DURATIONS[kind].presets} />
        </View>

        {kind === 'rest' ? (
          <Text style={{ marginTop: 20, fontFamily: Rubik.regular, fontSize: Type.small, lineHeight: Type.small * 1.5, color: theme.textSecondary }}>
            Breaks don’t need a temperature.
          </Text>
        ) : (
          <View style={{ marginTop: 28 }}>
            <Label style={{ marginBottom: 10 }}>Temperature</Label>
            <TemperatureChips
              kind={kind}
              unit={preferences.temperatureUnit}
              valueCTenths={temperatureCTenths}
              onChange={setTemperatureCTenths}
            />
          </View>
        )}

        <View style={{ marginTop: 28 }}>
          <TimelineList
            entries={entries}
            editable={!editing && entries.length > 0}
            onEdit={(entryId) => router.push({ pathname: '/log-session', params: { draftId: draftId ?? '', entryId } })}
            onDelete={deleteEntry}
          />
        </View>
      </ScrollView>

      <View style={{ paddingHorizontal: ScreenGutter, paddingTop: 8, paddingBottom: 28, gap: 8 }}>
        {errorMessage ? (
          <Text accessibilityRole="alert" style={{ fontFamily: Rubik.medium, fontSize: Type.small, lineHeight: Type.small * 1.4, color: theme.cedar }}>
            {errorMessage}
          </Text>
        ) : null}
        <Button
          size="lg"
          fullWidth
          iconLeft={<Icon name={meta.icon} size={18} color={theme.textOnAccent} />}
          onPress={saveEntry}>
          {editing ? 'Save changes' : `Add ${INTERVAL_LABELS[kind].toLowerCase()} to session`}
        </Button>
      </View>

      <Sheet
        open={nextOpen}
        title={`${INTERVAL_LABELS[kind]} added, ${formatStepDuration(durationSeconds)}`}
        onDismiss={() => setNextOpen(false)}>
        <View>
          <Text style={{ fontFamily: Rubik.regular, fontSize: Type.body, lineHeight: Type.body * 1.5, color: theme.textSecondary, marginBottom: 18 }}>
            {[
              composition,
              totals.heatSeconds > 0 ? `${formatTotalDuration(totals.heatSeconds)} in the sauna` : null,
              totals.coldSeconds > 0 ? `${formatTotalDuration(totals.coldSeconds)} in the cold` : null,
              totals.restSeconds > 0 ? `${formatTotalDuration(totals.restSeconds)} on a break` : null,
            ].filter(Boolean).join('. ')}.
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
                onPress={() => addNext(option)}>
                Add {INTERVAL_LABELS[option].toLowerCase()}
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
