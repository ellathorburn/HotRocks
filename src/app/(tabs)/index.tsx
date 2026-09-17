import { and, asc, desc, eq, isNull } from 'drizzle-orm';
import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { router } from 'expo-router';
import { useMemo } from 'react';
import { FlatList, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button, Card, Icon, IconButton, Label, Logo, SessionCard, StatsStrip, type RoundSegment } from '@/components/ds';
import { Rubik, ScreenGutter, Type } from '@/constants/theme';
import { useAuth } from '@/features/auth/auth-context';
import { useTheme } from '@/hooks/use-theme';
import { formatDuration, formatHoursMinutes } from '@/lib/format';
import { database } from '@/services/database/client';
import { roundParts, rounds, sessions as sessionTable, syncOutbox } from '@/services/database/schema';

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
  const { data: sessionRows = [], updatedAt } = useLiveQuery(
    database.select({
      id: sessionTable.id,
      venueNameSnapshot: sessionTable.venueNameSnapshot,
      elapsedSeconds: sessionTable.elapsedSeconds,
      heatSeconds: sessionTable.heatSeconds,
      coldSeconds: sessionTable.coldSeconds,
      roundCount: sessionTable.roundCount,
      startedAt: sessionTable.startedAt,
      rating: sessionTable.rating,
    }).from(sessionTable)
      .where(and(eq(sessionTable.userId, userId), isNull(sessionTable.deletedAt)))
      .orderBy(desc(sessionTable.startedAt), desc(sessionTable.id)),
    [userId],
  );
  const { data: parts = [] } = useLiveQuery(
    database.select({
      sessionId: roundParts.sessionId,
      kind: roundParts.kind,
      durationSeconds: roundParts.durationSeconds,
      temperatureCTenths: roundParts.temperatureCTenths,
      roundPosition: rounds.position,
      partPosition: roundParts.position,
    }).from(roundParts)
      .innerJoin(rounds, eq(rounds.id, roundParts.roundId))
      .where(eq(roundParts.userId, userId))
      .orderBy(asc(rounds.position), asc(roundParts.position)),
    [userId],
  );
  const { data: pending = [] } = useLiveQuery(
    database.select({ aggregateId: syncOutbox.aggregateId })
      .from(syncOutbox)
      .where(and(eq(syncOutbox.userId, userId), eq(syncOutbox.aggregateType, 'session'))),
    [userId],
  );

  const cards = useMemo(() => sessionRows.map((session) => {
    const segments: RoundSegment[] = parts
      .filter((part) => part.sessionId === session.id)
      .map((part) => ({
        type: part.kind,
        minutes: part.durationSeconds / 60,
        temp: part.temperatureCTenths === null ? null : part.temperatureCTenths / 10,
      }));
    return {
      id: session.id,
      venue: session.venueNameSnapshot ?? 'Venue not set',
      totalTime: formatDuration(session.elapsedSeconds),
      rounds: session.roundCount,
      date: new Intl.DateTimeFormat(undefined, { weekday: 'long', hour: '2-digit', minute: '2-digit' }).format(new Date(session.startedAt)),
      rating: session.rating,
      segments,
      synced: !pending.some((item) => item.aggregateId === session.id),
    };
  }), [parts, pending, sessionRows]);

  const week = useMemo(() => {
    const boundary = startOfWeek();
    const current = sessionRows.filter((session) => new Date(session.startedAt) >= boundary);
    return {
      sessions: current.length,
      rounds: current.reduce((total, session) => total + session.roundCount, 0),
      heatSeconds: current.reduce((total, session) => total + session.heatSeconds, 0),
      coldSeconds: current.reduce((total, session) => total + session.coldSeconds, 0),
    };
  }, [sessionRows]);

  if (updatedAt && cards.length === 0) return <EmptyHome />;

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
            { label: 'Sauna', value: formatHoursMinutes(week.heatSeconds), tone: 'hot' },
            { label: 'Plunge', value: formatHoursMinutes(week.coldSeconds), tone: 'cold' },
          ]} />
        </Card>
      </View>

      <FlatList
        data={cards}
        keyExtractor={(session) => session.id}
        contentContainerStyle={{ paddingHorizontal: ScreenGutter, paddingTop: 2, gap: 12, paddingBottom: 24 }}
        renderItem={({ item }) => <SessionCard session={item} onPress={() => router.push(`/session/${item.id}`)} />}
      />

      <View style={{ paddingHorizontal: ScreenGutter, paddingTop: 8, paddingBottom: 16, gap: 8 }}>
        <Button size="lg" fullWidth iconLeft={<Icon name="plus" size={20} color={theme.textOnAccent} />} onPress={() => router.push('/log-round')}>
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
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 14, paddingHorizontal: ScreenGutter }}>
        <Logo variant="mark" height={72} />
        <Text style={{ fontFamily: Rubik.semibold, fontSize: Type.heading, letterSpacing: -0.24, color: theme.text }}>Nothing logged yet</Text>
        <Text style={{ fontFamily: Rubik.regular, fontSize: Type.body, lineHeight: Type.body * 1.5, color: theme.textSecondary, textAlign: 'center', maxWidth: 260 }}>
          A session is one visit — as many rounds of sauna and plunge as you do. Log one and it lands here.
        </Text>
      </View>
      <View style={{ paddingHorizontal: ScreenGutter, paddingTop: 8, paddingBottom: 16 }}>
        <Button size="lg" fullWidth onPress={() => router.push('/log-round')}>
          Log your first session
        </Button>
      </View>
    </SafeAreaView>
  );
}
