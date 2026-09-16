import { and, asc, eq, isNull } from 'drizzle-orm';
import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { router, useLocalSearchParams } from 'expo-router';
import { Alert, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Badge, Button, Icon, IconButton, ListRow, Rating, RoundStrip, StatsStrip, type RoundSegment } from '@/components/ds';
import { NavBar } from '@/components/nav-bar';
import { Rubik, ScreenGutter, Type } from '@/constants/theme';
import { useAuth } from '@/features/auth/auth-context';
import { softDeleteSession } from '@/features/sessions/data/session-repository';
import { useTheme } from '@/hooks/use-theme';
import { database } from '@/services/database/client';
import { roundParts, rounds, sessions, stravaExports, syncOutbox } from '@/services/database/schema';

type PartRow = {
  roundId: string;
  roundPosition: number;
  partPosition: number;
  kind: 'heat' | 'cold';
  durationSeconds: number;
  temperatureCTenths: number | null;
};

function formatDuration(seconds: number) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainder = seconds % 60;
  return hours > 0
    ? `${hours}:${String(minutes).padStart(2, '0')}:${String(remainder).padStart(2, '0')}`
    : `${minutes}:${String(remainder).padStart(2, '0')}`;
}

function describePart(part: PartRow) {
  const duration = part.durationSeconds % 60 === 0
    ? `${part.durationSeconds / 60} min`
    : `${Math.floor(part.durationSeconds / 60)}m ${part.durationSeconds % 60}s`;
  const temperature = part.temperatureCTenths === null ? '' : ` at ${part.temperatureCTenths / 10}°`;
  return `${part.kind === 'heat' ? 'Sauna' : 'Plunge'} ${duration}${temperature}`;
}

export default function SessionDetailScreen() {
  const theme = useTheme();
  const { user } = useAuth();
  const { id } = useLocalSearchParams<{ id: string }>();
  const userId = user?.id ?? '';
  const { data: sessionRows = [], updatedAt } = useLiveQuery(
    database.select({
      id: sessions.id,
      venueNameSnapshot: sessions.venueNameSnapshot,
      elapsedSeconds: sessions.elapsedSeconds,
      heatSeconds: sessions.heatSeconds,
      coldSeconds: sessions.coldSeconds,
      roundCount: sessions.roundCount,
      startedAt: sessions.startedAt,
      rating: sessions.rating,
      note: sessions.note,
    }).from(sessions)
      .where(and(eq(sessions.id, id), eq(sessions.userId, userId), isNull(sessions.deletedAt)))
      .limit(1),
    [id, userId],
  );
  const { data: parts = [] } = useLiveQuery(
    database.select({
      roundId: roundParts.roundId,
      roundPosition: rounds.position,
      partPosition: roundParts.position,
      kind: roundParts.kind,
      durationSeconds: roundParts.durationSeconds,
      temperatureCTenths: roundParts.temperatureCTenths,
    }).from(roundParts)
      .innerJoin(rounds, eq(rounds.id, roundParts.roundId))
      .where(and(eq(roundParts.sessionId, id), eq(roundParts.userId, userId)))
      .orderBy(asc(rounds.position), asc(roundParts.position)),
    [id, userId],
  );
  const { data: exportRows = [] } = useLiveQuery(
    database.select({ status: stravaExports.status, stravaActivityId: stravaExports.stravaActivityId })
      .from(stravaExports)
      .where(and(eq(stravaExports.sessionId, id), eq(stravaExports.userId, userId)))
      .limit(1),
    [id, userId],
  );
  const { data: pendingRows = [] } = useLiveQuery(
    database.select({ id: syncOutbox.id })
      .from(syncOutbox)
      .where(and(eq(syncOutbox.userId, userId), eq(syncOutbox.aggregateType, 'session'), eq(syncOutbox.aggregateId, id)))
      .limit(1),
    [id, userId],
  );
  const session = sessionRows[0];
  const stravaExport = exportRows[0];
  const segments: RoundSegment[] = parts.map((part) => ({
    type: part.kind,
    minutes: part.durationSeconds / 60,
    temp: part.temperatureCTenths === null ? null : part.temperatureCTenths / 10,
  }));
  const logicalRounds = parts.reduce<PartRow[][]>((groups, part) => {
    const current = groups.at(-1);
    if (current?.[0].roundId === part.roundId) current.push(part);
    else groups.push([part]);
    return groups;
  }, []);
  const peakHeat = parts
    .filter((part) => part.kind === 'heat' && part.temperatureCTenths !== null)
    .reduce<number | null>((peak, part) => Math.max(peak ?? -Infinity, part.temperatureCTenths!), null);

  const confirmDelete = () => {
    if (!user || !session) return;
    Alert.alert('Delete session?', 'This removes the session from HotRocks.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => void softDeleteSession(session.id, user.id).then(() => router.back()),
      },
    ]);
  };

  if (!session) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }} edges={['top']}>
        <NavBar title="Session" showBack />
        {updatedAt ? (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: ScreenGutter }}>
            <Text style={{ fontFamily: Rubik.medium, fontSize: Type.body, color: theme.textSecondary }}>Session not found.</Text>
          </View>
        ) : null}
      </SafeAreaView>
    );
  }

  const venue = session.venueNameSnapshot ?? 'Venue not set';
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }} edges={['top']}>
      <NavBar
        title={venue}
        showBack
        trailing={
          <View style={{ flexDirection: 'row', gap: 2 }}>
            <IconButton icon="pencil" label="Edit" size={38} />
            <IconButton icon="share-2" label="Share" size={38} onPress={() => router.push(`/share/${session.id}`)} />
          </View>
        }
      />
      <ScrollView contentContainerStyle={{ paddingHorizontal: ScreenGutter, paddingBottom: 28 }}>
        <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 10 }}>
          <Text style={{ fontFamily: Rubik.bold, fontSize: 56, color: theme.text, fontVariant: ['tabular-nums'] }}>
            {formatDuration(session.elapsedSeconds)}
          </Text>
          <Text style={{ fontFamily: Rubik.medium, fontSize: 18, color: theme.textSecondary }}>
            {session.roundCount} {session.roundCount === 1 ? 'round' : 'rounds'}
          </Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 6, flexWrap: 'wrap' }}>
          <Text style={{ fontFamily: Rubik.regular, fontSize: Type.small, color: theme.textSecondary }}>
            {new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(session.startedAt))}
          </Text>
          {session.rating ? <Rating value={session.rating} readOnly size={15} /> : null}
          {pendingRows.length > 0 ? <Badge icon="cloud-off">On device</Badge> : null}
          {stravaExport && stravaExport.status !== 'posted' ? <Badge icon="cloud-off">Waiting for Strava</Badge> : null}
        </View>

        <View style={{ marginTop: 18 }}>
          <RoundStrip segments={segments} height={64} />
        </View>

        <View style={{ marginTop: 20 }}>
          <StatsStrip stats={[
            { label: 'Time in sauna', value: formatDuration(session.heatSeconds), tone: 'hot' },
            { label: 'Time in plunge', value: formatDuration(session.coldSeconds), tone: 'cold' },
            { label: 'Peak', value: peakHeat === null ? '—' : `${peakHeat / 10}°`, tone: 'hot' },
          ]} />
        </View>

        {session.note ? (
          <Text style={{ marginTop: 20, fontFamily: Rubik.regular, fontSize: Type.body, lineHeight: Type.body * 1.5, color: theme.text }}>
            {session.note}
          </Text>
        ) : null}

        <View style={{ marginTop: 20, gap: 2 }}>
          <Text style={{ fontFamily: Rubik.medium, fontSize: Type.label, letterSpacing: 0.5, textTransform: 'uppercase', color: theme.textSecondary, marginBottom: 6 }}>
            Rounds
          </Text>
          {logicalRounds.map((round, index) => (
            <ListRow
              key={round[0].roundId}
              title={`Round ${index + 1}`}
              meta={round.map(describePart).join(' · ')}
              leading={<Icon name={round[0].kind === 'heat' ? 'flame' : 'snowflake'} size={20} color={round[0].kind === 'heat' ? theme.hot : theme.cold} />}
              chevron
            />
          ))}
        </View>

        <View style={{ marginTop: 20, gap: 10 }}>
          {stravaExport?.stravaActivityId ? (
            <Button variant="secondary" fullWidth iconLeft={<Icon name="external-link" size={18} color={theme.text} />}>
              View on Strava
            </Button>
          ) : null}
          <Button variant="ghost" fullWidth onPress={confirmDelete}>
            Delete session
          </Button>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
