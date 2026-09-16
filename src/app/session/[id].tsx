import { useQuery } from '@powersync/react';
import { router, useLocalSearchParams } from 'expo-router';
import { Alert, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Badge, Button, Icon, IconButton, ListRow, Rating, RoundStrip, StatsStrip, type RoundSegment } from '@/components/ds';
import { NavBar } from '@/components/nav-bar';
import { Rubik, ScreenGutter, Type } from '@/constants/theme';
import { useAuth } from '@/features/auth/auth-context';
import { softDeleteSession } from '@/features/sessions/data/session-repository';
import { useTheme } from '@/hooks/use-theme';

type SessionRow = {
  id: string;
  venue_name_snapshot: string | null;
  elapsed_seconds: number;
  heat_seconds: number;
  cold_seconds: number;
  round_count: number;
  started_at: string;
  rating: number | null;
  note: string | null;
};

type PartRow = {
  round_id: string;
  round_position: number;
  part_position: number;
  kind: 'heat' | 'cold';
  duration_seconds: number;
  temperature_c_tenths: number | null;
};

type ExportRow = { status: string; strava_activity_id: number | null };

function formatDuration(seconds: number) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainder = seconds % 60;
  return hours > 0
    ? `${hours}:${String(minutes).padStart(2, '0')}:${String(remainder).padStart(2, '0')}`
    : `${minutes}:${String(remainder).padStart(2, '0')}`;
}

function describePart(part: PartRow) {
  const duration = part.duration_seconds % 60 === 0
    ? `${part.duration_seconds / 60} min`
    : `${Math.floor(part.duration_seconds / 60)}m ${part.duration_seconds % 60}s`;
  const temperature = part.temperature_c_tenths === null ? '' : ` at ${part.temperature_c_tenths / 10}°`;
  return `${part.kind === 'heat' ? 'Sauna' : 'Plunge'} ${duration}${temperature}`;
}

export default function SessionDetailScreen() {
  const theme = useTheme();
  const { user } = useAuth();
  const { id } = useLocalSearchParams<{ id: string }>();
  const userId = user?.id ?? '';
  const { data: sessions, isLoading } = useQuery<SessionRow>(
    `SELECT id, venue_name_snapshot, elapsed_seconds, heat_seconds, cold_seconds,
            round_count, started_at, rating, note
     FROM sessions WHERE id = ? AND user_id = ? AND deleted_at IS NULL LIMIT 1`,
    [id, userId],
  );
  const { data: parts } = useQuery<PartRow>(
    `SELECT p.round_id, r.position AS round_position, p.position AS part_position,
            p.kind, p.duration_seconds, p.temperature_c_tenths
     FROM round_parts p JOIN rounds r ON r.id = p.round_id
     WHERE p.session_id = ? AND p.user_id = ?
     ORDER BY r.position, p.position`,
    [id, userId],
  );
  const { data: exports } = useQuery<ExportRow>(
    'SELECT status, strava_activity_id FROM strava_exports WHERE session_id = ? AND user_id = ? LIMIT 1',
    [id, userId],
  );
  const session = sessions[0];
  const stravaExport = exports[0];
  const segments: RoundSegment[] = parts.map((part) => ({
    type: part.kind,
    minutes: part.duration_seconds / 60,
    temp: part.temperature_c_tenths === null ? null : part.temperature_c_tenths / 10,
  }));
  const logicalRounds = parts.reduce<PartRow[][]>((groups, part) => {
    const current = groups.at(-1);
    if (current?.[0].round_id === part.round_id) current.push(part);
    else groups.push([part]);
    return groups;
  }, []);
  const peakHeat = parts
    .filter((part) => part.kind === 'heat' && part.temperature_c_tenths !== null)
    .reduce<number | null>((peak, part) => Math.max(peak ?? -Infinity, part.temperature_c_tenths!), null);

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
        {!isLoading ? (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: ScreenGutter }}>
            <Text style={{ fontFamily: Rubik.medium, fontSize: Type.body, color: theme.textSecondary }}>Session not found.</Text>
          </View>
        ) : null}
      </SafeAreaView>
    );
  }

  const venue = session.venue_name_snapshot ?? 'Venue not set';
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
            {formatDuration(session.elapsed_seconds)}
          </Text>
          <Text style={{ fontFamily: Rubik.medium, fontSize: 18, color: theme.textSecondary }}>
            {session.round_count} {session.round_count === 1 ? 'round' : 'rounds'}
          </Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 6, flexWrap: 'wrap' }}>
          <Text style={{ fontFamily: Rubik.regular, fontSize: Type.small, color: theme.textSecondary }}>
            {new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(session.started_at))}
          </Text>
          {session.rating ? <Rating value={session.rating} readOnly size={15} /> : null}
          {stravaExport && stravaExport.status !== 'posted' ? <Badge icon="cloud-off">Waiting for Strava</Badge> : null}
        </View>

        <View style={{ marginTop: 18 }}>
          <RoundStrip segments={segments} height={64} />
        </View>

        <View style={{ marginTop: 20 }}>
          <StatsStrip stats={[
            { label: 'Time in sauna', value: formatDuration(session.heat_seconds), tone: 'hot' },
            { label: 'Time in plunge', value: formatDuration(session.cold_seconds), tone: 'cold' },
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
              key={round[0].round_id}
              title={`Round ${index + 1}`}
              meta={round.map(describePart).join(' · ')}
              leading={<Icon name={round[0].kind === 'heat' ? 'flame' : 'snowflake'} size={20} color={round[0].kind === 'heat' ? theme.hot : theme.cold} />}
              chevron
            />
          ))}
        </View>

        <View style={{ marginTop: 20, gap: 10 }}>
          {stravaExport?.strava_activity_id ? (
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
