import { router, useLocalSearchParams } from 'expo-router';
import { ulid } from 'ulid';
import { useMemo, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button, Icon, Input, Label, ListRow, Rating, RoundStrip } from '@/components/ds';
import type { RoundSegment } from '@/components/ds';
import { NavBar } from '@/components/nav-bar';
import { Rubik, ScreenGutter } from '@/constants/theme';
import { useAuth } from '@/features/auth/auth-context';
import { saveSession } from '@/features/sessions/data/session-repository';
import { roundSchema, type Round, type RoundPart } from '@/features/sessions/domain/session';
import { useTheme } from '@/hooks/use-theme';

function totalDuration(rounds: Round[], elapsedSeconds?: string) {
  const activeSeconds = rounds.flatMap((round) => round.parts).reduce((sum, part) => sum + part.durationSeconds, 0);
  const seconds = Math.max(activeSeconds, Number(elapsedSeconds) || activeSeconds);
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}` : `${m}:${String(s).padStart(2, '0')}`;
}

function describePart(part: RoundPart) {
  const duration = part.durationSeconds % 60 === 0
    ? `${part.durationSeconds / 60} min`
    : `${Math.floor(part.durationSeconds / 60)}m ${part.durationSeconds % 60}s`;
  const temperature = part.temperatureCTenths === null ? '' : ` at ${part.temperatureCTenths / 10}°`;
  return `${part.kind === 'heat' ? 'Sauna' : 'Plunge'} ${duration}${temperature}`;
}

export default function SessionSummaryScreen() {
  const theme = useTheme();
  const { profile, user } = useAuth();
  const params = useLocalSearchParams<{
    rounds?: string;
    venue?: string;
    startedAt?: string;
    elapsedSeconds?: string;
    entryMethod?: 'manual' | 'timer' | 'repeat';
  }>();
  const rounds = useMemo<Round[]>(() => {
    try {
      const parsed = roundSchema.array().safeParse(params.rounds ? JSON.parse(params.rounds) : []);
      return parsed.success ? parsed.data : [];
    } catch {
      return [];
    }
  }, [params.rounds]);
  const segments = useMemo<RoundSegment[]>(() => rounds.flatMap((round) => round.parts.map((part) => ({
    type: part.kind,
    minutes: part.durationSeconds / 60,
    temp: part.temperatureCTenths === null ? null : part.temperatureCTenths / 10,
  }))), [rounds]);
  const [open, setOpen] = useState(false);
  const [rating, setRating] = useState(0);
  const [note, setNote] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const handleSave = async () => {
    if (!user || rounds.length === 0) return;
    const activeSeconds = rounds.flatMap((round) => round.parts).reduce((sum, part) => sum + part.durationSeconds, 0);
    const elapsedSeconds = Math.max(activeSeconds, Number(params.elapsedSeconds) || activeSeconds);
    const sessionId = ulid();
    setIsSaving(true);
    setSaveError(null);

    try {
      await saveSession({
        id: sessionId,
        userId: user.id,
        startedAt: params.startedAt ?? new Date(Date.now() - elapsedSeconds * 1000).toISOString(),
        elapsedSeconds,
        venueName: params.venue ?? 'Löyly Kallio',
        rating: rating || null,
        note: note.trim() || null,
        rounds,
        timezoneName: profile?.timezone_name ?? 'Africa/Johannesburg',
        entryMethod: params.entryMethod ?? 'manual',
      });
      router.replace('/');
    } catch {
      setSaveError('Could not save this session. Try again.');
      setIsSaving(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }} edges={['top']}>
      <NavBar title="Session" showBack />
      <ScrollView contentContainerStyle={{ paddingHorizontal: ScreenGutter, paddingBottom: 96 }}>
        <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 10 }}>
          <Text style={{ fontFamily: Rubik.bold, fontSize: 56, color: theme.text, fontVariant: ['tabular-nums'] }}>
            {totalDuration(rounds, params.elapsedSeconds)}
          </Text>
          <Text style={{ fontFamily: Rubik.medium, fontSize: 18, color: theme.textSecondary }}>
            {rounds.length} {rounds.length === 1 ? 'round' : 'rounds'}
          </Text>
        </View>

        <View style={{ marginTop: 16 }}>
          <RoundStrip segments={segments} height={48} />
        </View>

        <View style={{ marginTop: 20, gap: 2 }}>
          {rounds.map((round, i) => (
            <ListRow
              key={round.id}
              title={`Round ${i + 1}`}
              meta={round.parts.map(describePart).join(' · ')}
              leading={<Icon name={round.parts[0].kind === 'heat' ? 'flame' : 'snowflake'} size={20} color={round.parts[0].kind === 'heat' ? theme.hot : theme.cold} />}
              chevron
              onPress={() => router.back()}
            />
          ))}
        </View>

        <View style={{ marginTop: 20 }}>
          <Label style={{ marginBottom: 8 }}>Venue</Label>
          <ListRow
            title={params.venue ?? 'Löyly Kallio'}
            meta="Same as last time"
            leading={<Icon name="map-pin" size={20} color={theme.textSecondary} />}
            chevron
            onPress={() => router.push({
              pathname: '/venue-picker',
              params: {
                rounds: params.rounds,
                venue: params.venue,
                startedAt: params.startedAt,
                elapsedSeconds: params.elapsedSeconds,
                entryMethod: params.entryMethod,
              },
            })}
            style={{ backgroundColor: theme.card }}
          />
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
            <Button
              variant="ghost"
              fullWidth
              onPress={() => setOpen(true)}
              iconLeft={<Icon name="chevron-down" size={18} color={theme.textSecondary} />}>
              Add rating, note and photos
            </Button>
          )}
        </View>
      </ScrollView>

      <View style={{ paddingHorizontal: ScreenGutter, paddingVertical: 8, paddingBottom: 28 }}>
        {saveError ? (
          <Text style={{ fontFamily: Rubik.medium, fontSize: 14, color: theme.cedar, textAlign: 'center', marginBottom: 8 }}>
            {saveError}
          </Text>
        ) : null}
        <Button size="lg" fullWidth loading={isSaving} disabled={!user || rounds.length === 0} onPress={() => void handleSave()}>
          Save session
        </Button>
      </View>
    </SafeAreaView>
  );
}
