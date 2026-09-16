import { useQuery } from '@powersync/react';
import { router } from 'expo-router';
import { useMemo } from 'react';
import { FlatList, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button, Card, IconButton, Label, Logo, SessionCard, StatsStrip, type RoundSegment } from '@/components/ds';
import { Rubik, ScreenGutter, Type } from '@/constants/theme';
import { useAuth } from '@/features/auth/auth-context';
import { useTheme } from '@/hooks/use-theme';

type LocalSession = {
  id: string;
  venue_name_snapshot: string | null;
  elapsed_seconds: number;
  round_count: number;
  started_at: string;
  rating: number | null;
};

type LocalPart = {
  session_id: string;
  kind: 'heat' | 'cold';
  duration_seconds: number;
  temperature_c_tenths: number | null;
  round_position: number;
  part_position: number;
};

function formatDuration(seconds: number) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainder = seconds % 60;
  return hours > 0
    ? `${hours}:${String(minutes).padStart(2, '0')}:${String(remainder).padStart(2, '0')}`
    : `${minutes}:${String(remainder).padStart(2, '0')}`;
}

function startOfWeek() {
  const date = new Date();
  const day = date.getDay() || 7;
  date.setDate(date.getDate() - day + 1);
  date.setHours(0, 0, 0, 0);
  return date;
}

export default function HomeScreen() {
  const theme = useTheme();
  const { user } = useAuth();
  const userId = user?.id ?? '';
  const { data: sessions, isLoading } = useQuery<LocalSession>(
    `SELECT id, venue_name_snapshot, elapsed_seconds, round_count, started_at, rating
     FROM sessions
     WHERE user_id = ? AND deleted_at IS NULL
     ORDER BY started_at DESC, id DESC`,
    [userId],
  );
  const { data: parts } = useQuery<LocalPart>(
    `SELECT p.session_id, p.kind, p.duration_seconds, p.temperature_c_tenths,
            r.position AS round_position, p.position AS part_position
     FROM round_parts p
     JOIN rounds r ON r.id = p.round_id
     WHERE p.user_id = ?
     ORDER BY r.position, p.position`,
    [userId],
  );

  const cards = useMemo(() => sessions.map((session) => {
    const segments: RoundSegment[] = parts
      .filter((part) => part.session_id === session.id)
      .map((part) => ({
        type: part.kind,
        minutes: part.duration_seconds / 60,
        temp: part.temperature_c_tenths === null ? null : part.temperature_c_tenths / 10,
      }));
    return {
      id: session.id,
      venue: session.venue_name_snapshot ?? 'Venue not set',
      totalTime: formatDuration(session.elapsed_seconds),
      rounds: session.round_count,
      date: new Intl.DateTimeFormat(undefined, { weekday: 'long', hour: '2-digit', minute: '2-digit' }).format(new Date(session.started_at)),
      rating: session.rating,
      segments,
    };
  }), [parts, sessions]);

  const week = useMemo(() => {
    const boundary = startOfWeek();
    const current = sessions.filter((session) => new Date(session.started_at) >= boundary);
    return {
      sessions: current.length,
      rounds: current.reduce((total, session) => total + session.round_count, 0),
      seconds: current.reduce((total, session) => total + session.elapsed_seconds, 0),
    };
  }, [sessions]);

  if (!isLoading && cards.length === 0) return <EmptyHome />;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }} edges={['top']}>
      <View style={{ paddingHorizontal: ScreenGutter, paddingBottom: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Logo height={24} />
        <IconButton icon="settings" label="Settings" size={38} onPress={() => router.push('/settings')} />
      </View>

      <View style={{ paddingHorizontal: ScreenGutter, paddingBottom: 14 }}>
        <Card>
          <Label style={{ marginBottom: 10 }}>This week</Label>
          <StatsStrip stats={[
            { label: 'Sessions', value: week.sessions },
            { label: 'Rounds', value: week.rounds },
            { label: 'Total time', value: formatDuration(week.seconds) },
          ]} />
        </Card>
      </View>

      <FlatList
        data={cards}
        keyExtractor={(session) => session.id}
        contentContainerStyle={{ paddingHorizontal: ScreenGutter, gap: 12, paddingBottom: 24 }}
        renderItem={({ item }) => <SessionCard session={item} onPress={() => router.push(`/session/${item.id}`)} />}
      />

      <View style={{ paddingHorizontal: ScreenGutter, paddingVertical: 8, gap: 8 }}>
        <Button size="lg" fullWidth onPress={() => router.push('/log-round')}>
          Log a session
        </Button>
        {cards[0] ? (
          <Button size="sm" variant="ghost" fullWidth onPress={() => router.push('/log-round')}>
            Same as last time · {cards[0].venue}, {cards[0].rounds} rounds
          </Button>
        ) : null}
      </View>
    </SafeAreaView>
  );
}

function EmptyHome() {
  const theme = useTheme();

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }} edges={['top']}>
      <View style={{ paddingHorizontal: ScreenGutter, paddingBottom: 12 }}>
        <Logo height={24} />
      </View>
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 14, paddingHorizontal: 40 }}>
        <Logo variant="mark" height={72} />
        <Text style={{ fontFamily: Rubik.semibold, fontSize: Type.heading, color: theme.text }}>Nothing logged yet</Text>
        <Text style={{ fontFamily: Rubik.regular, fontSize: Type.body, lineHeight: Type.body * 1.5, color: theme.textSecondary, textAlign: 'center', maxWidth: 260 }}>
          Your sauna sessions and cold plunges will land here.
        </Text>
      </View>
      <View style={{ paddingHorizontal: ScreenGutter, paddingVertical: 8 }}>
        <Button size="lg" fullWidth onPress={() => router.push('/log-round')}>
          Log your first session
        </Button>
      </View>
    </SafeAreaView>
  );
}
