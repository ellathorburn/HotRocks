import { and, eq } from 'drizzle-orm';
import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button, Card, Icon, Input, Label, ListRow, Rating, RoundStrip } from '@/components/ds';
import type { RoundSegment } from '@/components/ds';
import { NavBar } from '@/components/nav-bar';
import { displayText, Rubik, ScreenGutter } from '@/constants/theme';
import { useAuth } from '@/features/auth/auth-context';
import {
  deleteSessionDraft,
  navigationDraftSchema,
  type NavigationDraft,
} from '@/features/sessions/data/session-draft-repository';
import { saveSession } from '@/features/sessions/data/session-repository';
import type { Round } from '@/features/sessions/domain/session';
import { useTheme } from '@/hooks/use-theme';
import { describeSessionPart, formatDuration } from '@/lib/format';
import { createId } from '@/lib/ids';
import { singleRouteParam } from '@/lib/route-params';
import { database } from '@/services/database/client';
import { sessionDrafts } from '@/services/database/schema';

function totalDuration(rounds: Round[], elapsedSeconds: number) {
  const activeSeconds = rounds.flatMap((round) => round.parts).reduce((sum, part) => sum + part.durationSeconds, 0);
  return formatDuration(Math.max(activeSeconds, elapsedSeconds));
}

export default function SessionSummaryScreen() {
  const theme = useTheme();
  const { user } = useAuth();
  const params = useLocalSearchParams<{ draftId?: string | string[] }>();
  const draftId = singleRouteParam(params.draftId);
  const userId = user?.id ?? '';
  const { data: rows = [], updatedAt } = useLiveQuery(
    database.select({ payloadJson: sessionDrafts.payloadJson })
      .from(sessionDrafts)
      .where(and(eq(sessionDrafts.id, draftId ?? ''), eq(sessionDrafts.userId, userId)))
      .limit(1),
    [draftId, userId],
  );
  const draft = useMemo(() => {
    if (!rows[0]) return null;
    try {
      return navigationDraftSchema.parse(JSON.parse(rows[0].payloadJson));
    } catch {
      return null;
    }
  }, [rows]);

  if (!draftId || !user || (updatedAt && !draft)) {
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
  return <SessionDraftSummary draftId={draftId} draft={draft} />;
}

function SessionDraftSummary({ draftId, draft }: { draftId: string; draft: NavigationDraft }) {
  const theme = useTheme();
  const { profile, user } = useAuth();
  const [open, setOpen] = useState(Boolean(draft.rating || draft.note));
  const [rating, setRating] = useState(draft.rating ?? 0);
  const [note, setNote] = useState(draft.note ?? '');
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const segments = useMemo<RoundSegment[]>(() => draft.rounds.flatMap((round) => round.parts.map((part) => ({
    type: part.kind,
    minutes: part.durationSeconds / 60,
    temp: part.temperatureCTenths === null ? null : part.temperatureCTenths / 10,
  }))), [draft.rounds]);

  const handleSave = async () => {
    if (!user) return;
    setIsSaving(true);
    setSaveError(null);
    try {
      await saveSession({
        id: createId(),
        userId: user.id,
        startedAt: draft.startedAt,
        elapsedSeconds: draft.elapsedSeconds,
        venueName: draft.venueName,
        rating: rating || null,
        note: note.trim() || null,
        rounds: draft.rounds,
        timezoneName: profile?.timezone_name ?? Intl.DateTimeFormat().resolvedOptions().timeZone ?? 'UTC',
        entryMethod: draft.entryMethod,
      });
      deleteSessionDraft(draftId, user.id);
      router.replace('/');
    } catch (error) {
      if (__DEV__) console.error('Session save failed', error);
      setSaveError('Could not save this session. Try again.');
      setIsSaving(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }} edges={['top']}>
      <NavBar title="Session" showBack />
      <ScrollView contentContainerStyle={{ paddingHorizontal: ScreenGutter, paddingBottom: 24 }}>
        <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 10 }}>
          <Text style={{ fontFamily: Rubik.bold, ...displayText(56), color: theme.text, fontVariant: ['tabular-nums'] }}>
            {totalDuration(draft.rounds, draft.elapsedSeconds)}
          </Text>
          <Text style={{ fontFamily: Rubik.medium, fontSize: 18, color: theme.textSecondary }}>
            {draft.rounds.length} {draft.rounds.length === 1 ? 'round' : 'rounds'}
          </Text>
        </View>

        <View style={{ marginTop: 16 }}><RoundStrip segments={segments} height={48} /></View>

        <View style={{ marginTop: 20, gap: 2 }}>
          {draft.rounds.map((round, index) => (
            <ListRow
              key={round.id}
              title={`Round ${index + 1}`}
              meta={round.parts.map(describeSessionPart).join(' · ')}
              leading={<Icon name={round.parts[0].kind === 'heat' ? 'flame' : 'snowflake'} size={20} color={round.parts[0].kind === 'heat' ? theme.hot : theme.cold} />}
            />
          ))}
        </View>

        <View style={{ marginTop: 20 }}>
          <Label style={{ marginBottom: 8 }}>Venue</Label>
          <Card padded={false}>
            <ListRow
              title={draft.venueName ?? 'Venue not set'}
              leading={<Icon name="map-pin" size={20} color={theme.textSecondary} />}
              chevron
              onPress={() => router.push({ pathname: '/venue-picker', params: { draftId } })}
            />
          </Card>
        </View>

        <View style={{ marginTop: 16 }}>
          {open ? (
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
            <Button variant="ghost" fullWidth onPress={() => setOpen(true)} iconLeft={<Icon name="chevron-down" size={18} color={theme.textSecondary} />}>
              Add rating and note
            </Button>
          )}
        </View>
      </ScrollView>

      <View style={{ paddingHorizontal: ScreenGutter, paddingTop: 8, paddingBottom: 28 }}>
        {saveError ? <Text style={{ fontFamily: Rubik.medium, fontSize: 14, color: theme.cedar, textAlign: 'center', marginBottom: 8 }}>{saveError}</Text> : null}
        <Button size="lg" fullWidth loading={isSaving} disabled={!user} onPress={() => void handleSave()}>
          Save session
        </Button>
      </View>
    </SafeAreaView>
  );
}
