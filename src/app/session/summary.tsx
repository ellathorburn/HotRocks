import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button, Card, Icon, Input, Label, ListRow, Rating, TimelineList, TimelineStrip } from '@/components/ds';
import { NavBar } from '@/components/nav-bar';
import { displayText, Rubik, ScreenGutter, Type } from '@/constants/theme';
import { useDisplayPreferences } from '@/features/profiles/hooks/use-display-preferences';
import { useSessionTimelineDraft } from '@/features/sessions/hooks/use-session-timeline-draft';
import {
  describeTimelineRuleError,
  sessionTimelineDraftService,
} from '@/features/sessions/services/session-draft-service';
import { sessionService } from '@/features/sessions/services/session-service';
import { useTheme } from '@/hooks/use-theme';
import { formatTotalDuration } from '@/lib/format';
import { createId } from '@/lib/ids';
import { singleRouteParam } from '@/lib/route-params';

/** Review a timeline before it becomes a permanent session. */
export default function SessionSummaryScreen() {
  const theme = useTheme();
  const preferences = useDisplayPreferences();
  const params = useLocalSearchParams<{ draftId?: string | string[] }>();
  const draftId = singleRouteParam(params.draftId);
  const {
    draft,
    entries,
    segments,
    composition,
    totals,
    canSave,
    isLoaded,
  } = useSessionTimelineDraft(draftId ?? '', preferences);

  const [detailsOpen, setDetailsOpen] = useState(false);
  const [rating, setRating] = useState(0);
  const [note, setNote] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  if (!draftId || !preferences.userId || (isLoaded && !draft)) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }} edges={['top']}>
        <NavBar title="Session" showBack />
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16, paddingHorizontal: ScreenGutter }}>
          <Text style={{ fontFamily: Rubik.medium, color: theme.textSecondary, textAlign: 'center' }}>
            This session draft is missing or no longer belongs to this account.
          </Text>
          <Button variant="secondary" onPress={() => router.replace('/')}>Return home</Button>
        </View>
      </SafeAreaView>
    );
  }

  if (!draft) return null;

  const deleteEntry = (entryId: string) => {
    setSaveError(null);
    try {
      sessionTimelineDraftService.removeInterval(draftId, preferences.userId, entryId);
    } catch (error) {
      setSaveError(describeTimelineRuleError(error) ?? 'Could not remove that entry.');
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    setSaveError(null);
    try {
      const sessionId = await sessionService.saveDraft({
        sessionId: createId(),
        draftId,
        userId: preferences.userId,
        timezoneName: preferences.timeZone,
        rating: rating || null,
        note: note.trim() || null,
      });
      router.replace(`/session/${sessionId}`);
    } catch (error) {
      if (__DEV__) console.error('Session save failed', error);
      setSaveError(describeTimelineRuleError(error) ?? 'Could not save this session. Try again.');
      setIsSaving(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }} edges={['top']}>
      <NavBar title="Session" showBack />
      <ScrollView contentContainerStyle={{ paddingHorizontal: ScreenGutter, paddingBottom: 24 }} keyboardShouldPersistTaps="handled">
        <Label>Total</Label>
        <Text style={{ marginTop: 4, fontFamily: Rubik.bold, ...displayText(48), color: theme.text, fontVariant: ['tabular-nums'] }}>
          {formatTotalDuration(totals.elapsedSeconds)}
        </Text>

        {/* Only what this session contains so far. */}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 16, marginTop: 10 }}>
          {totals.heatSeconds > 0 ? (
            <Text style={{ fontFamily: Rubik.medium, fontSize: 15, color: theme.hot }}>Sauna {formatTotalDuration(totals.heatSeconds)}</Text>
          ) : null}
          {totals.coldSeconds > 0 ? (
            <Text style={{ fontFamily: Rubik.medium, fontSize: 15, color: theme.coldInk }}>Plunge {formatTotalDuration(totals.coldSeconds)}</Text>
          ) : null}
          {totals.restSeconds > 0 ? (
            <Text style={{ fontFamily: Rubik.medium, fontSize: 15, color: theme.rest }}>Break {formatTotalDuration(totals.restSeconds)}</Text>
          ) : null}
        </View>
        {totals.untrackedSeconds >= 60 ? (
          <Text style={{ marginTop: 8, fontFamily: Rubik.regular, fontSize: 13, color: theme.textSecondary }}>
            +{formatTotalDuration(totals.untrackedSeconds)} not in a logged entry
          </Text>
        ) : null}

        <View style={{ marginTop: 16 }}><TimelineStrip segments={segments} height={48} /></View>

        <View style={{ marginTop: 20 }}>
          <TimelineList
            entries={entries}
            label={composition || 'Session timeline'}
            editable
            onEdit={(entryId) => router.push({ pathname: '/log-session', params: { draftId, entryId } })}
            onDelete={deleteEntry}
          />
        </View>

        <View style={{ marginTop: 16 }}>
          <Button
            variant="secondary"
            fullWidth
            iconLeft={<Icon name="plus" size={18} color={theme.text} />}
            onPress={() => router.push({ pathname: '/log-session', params: { draftId } })}>
            Add another entry
          </Button>
        </View>

        <View style={{ marginTop: 20 }}>
          <Label style={{ marginBottom: 8 }}>Venue</Label>
          <Card padded={false}>
            <ListRow
              title={draft.venueName ?? 'Add a venue'}
              meta={draft.venueName ? undefined : 'Optional. Without one, the session is named after its day.'}
              leading={<Icon name="map-pin" size={20} color={theme.textSecondary} />}
              chevron
              onPress={() => router.push({ pathname: '/venue-picker', params: { draftId } })}
            />
          </Card>
        </View>

        <View style={{ marginTop: 16 }}>
          {detailsOpen ? (
            <View style={{ gap: 16 }}>
              <View>
                <Label style={{ marginBottom: 8 }}>Rating</Label>
                <Rating value={rating} onChange={setRating} />
              </View>
              <View>
                <Label style={{ marginBottom: 8 }}>Note</Label>
                <Input multiline value={note} onChangeText={setNote} placeholder="How did it go?" />
              </View>
            </View>
          ) : (
            <Button variant="ghost" fullWidth onPress={() => setDetailsOpen(true)} iconLeft={<Icon name="chevron-down" size={18} color={theme.textSecondary} />}>
              Add rating and note
            </Button>
          )}
        </View>
      </ScrollView>

      <View style={{ paddingHorizontal: ScreenGutter, paddingTop: 8, paddingBottom: 28, gap: 8 }}>
        {!canSave ? (
          <Text accessibilityRole="alert" style={{ fontFamily: Rubik.medium, fontSize: Type.small, lineHeight: Type.small * 1.4, color: theme.cedar }}>
            Add a sauna or cold plunge before you can save this session.
          </Text>
        ) : null}
        {saveError ? (
          <Text style={{ fontFamily: Rubik.medium, fontSize: Type.small, color: theme.cedar, textAlign: 'center' }}>{saveError}</Text>
        ) : null}
        <Button size="lg" fullWidth loading={isSaving} disabled={!canSave} onPress={() => void handleSave()}>
          Save session
        </Button>
      </View>
    </SafeAreaView>
  );
}
