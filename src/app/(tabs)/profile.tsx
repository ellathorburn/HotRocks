import { and, eq, isNull } from 'drizzle-orm';
import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { router } from 'expo-router';
import { useMemo } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Card, Heatmap, Label, ListRow, StatsStrip, type HeatmapDay } from '@/components/ds';
import { NavBar } from '@/components/nav-bar';
import { displayText, Rubik, ScreenGutter } from '@/constants/theme';
import { useAuth } from '@/features/auth/auth-context';
import { useTheme } from '@/hooks/use-theme';
import { formatDuration } from '@/lib/format';
import { database } from '@/services/database/client';
import { roundParts, sessions } from '@/services/database/schema';

function hoursLabel(seconds: number): string {
  const hours = seconds / 3600;
  return hours >= 10 ? `${Math.round(hours)}h` : `${hours.toFixed(hours % 1 === 0 ? 0 : 1)}h`;
}

function dayKey(value: Date): string {
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`;
}

function startOfWeek(value: Date): Date {
  const result = new Date(value);
  const day = result.getDay() || 7;
  result.setDate(result.getDate() - day + 1);
  result.setHours(0, 0, 0, 0);
  return result;
}

export default function ProfileScreen() {
  const theme = useTheme();
  const { user } = useAuth();
  const userId = user?.id ?? '';
  const { data: sessionRows = [] } = useLiveQuery(
    database.select({
      id: sessions.id,
      venue: sessions.venueNameSnapshot,
      startedAt: sessions.startedAt,
      elapsedSeconds: sessions.elapsedSeconds,
      heatSeconds: sessions.heatSeconds,
      coldSeconds: sessions.coldSeconds,
      roundCount: sessions.roundCount,
    }).from(sessions)
      .where(and(eq(sessions.userId, userId), isNull(sessions.deletedAt))),
    [userId],
  );
  const { data: parts = [] } = useLiveQuery(
    database.select({
      sessionId: roundParts.sessionId,
      kind: roundParts.kind,
      temperatureCTenths: roundParts.temperatureCTenths,
    }).from(roundParts).where(eq(roundParts.userId, userId)),
    [userId],
  );

  const statistics = useMemo(() => {
    const sessionById = new Map(sessionRows.map((session) => [session.id, session]));
    const activeParts = parts.filter((part) => sessionById.has(part.sessionId));
    const now = new Date();
    const monthSessions = sessionRows.filter((session) => {
      const date = new Date(session.startedAt);
      return date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth();
    }).length;

    const weeksWithSessions = new Set(sessionRows.map((session) => startOfWeek(new Date(session.startedAt)).getTime()));
    let streak = 0;
    const cursor = startOfWeek(now);
    while (weeksWithSessions.has(cursor.getTime())) {
      streak += 1;
      cursor.setDate(cursor.getDate() - 7);
    }

    const firstDay = new Date(now);
    firstDay.setHours(0, 0, 0, 0);
    firstDay.setDate(firstDay.getDate() - 104);
    const activity = new Map<string, { heat: number; cold: number }>();
    for (const part of activeParts) {
      const session = sessionById.get(part.sessionId);
      if (!session) continue;
      const key = dayKey(new Date(session.startedAt));
      const current = activity.get(key) ?? { heat: 0, cold: 0 };
      current[part.kind] += 1;
      activity.set(key, current);
    }
    const heatmap: HeatmapDay[] = Array.from({ length: 105 }, (_, index) => {
      const date = new Date(firstDay);
      date.setDate(firstDay.getDate() + index);
      return activity.get(dayKey(date)) ?? 0;
    });

    const longest = sessionRows.reduce<(typeof sessionRows)[number] | null>(
      (best, session) => !best || session.elapsedSeconds > best.elapsedSeconds ? session : best,
      null,
    );
    const mostRounds = sessionRows.reduce<(typeof sessionRows)[number] | null>(
      (best, session) => !best || session.roundCount > best.roundCount ? session : best,
      null,
    );
    const hottest = activeParts
      .filter((part) => part.kind === 'heat' && part.temperatureCTenths !== null)
      .reduce<(typeof parts)[number] | null>((best, part) => (
        !best || part.temperatureCTenths! > best.temperatureCTenths! ? part : best
      ), null);
    const coldest = activeParts
      .filter((part) => part.kind === 'cold' && part.temperatureCTenths !== null)
      .reduce<(typeof parts)[number] | null>((best, part) => (
        !best || part.temperatureCTenths! < best.temperatureCTenths! ? part : best
      ), null);

    return {
      sessions: sessionRows.length,
      rounds: sessionRows.reduce((total, session) => total + session.roundCount, 0),
      heatSeconds: sessionRows.reduce((total, session) => total + session.heatSeconds, 0),
      coldSeconds: sessionRows.reduce((total, session) => total + session.coldSeconds, 0),
      monthSessions,
      streak,
      heatmap,
      longest: longest ? `${longest.venue ?? 'Venue not set'} · ${formatDuration(longest.elapsedSeconds)}` : 'No sessions yet',
      mostRounds: mostRounds ? `${mostRounds.venue ?? 'Venue not set'} · ${mostRounds.roundCount} rounds` : 'No sessions yet',
      hottest: hottest ? `${sessionById.get(hottest.sessionId)?.venue ?? 'Venue not set'} · ${hottest.temperatureCTenths! / 10}°C` : 'No temperature yet',
      coldest: coldest ? `${sessionById.get(coldest.sessionId)?.venue ?? 'Venue not set'} · ${coldest.temperatureCTenths! / 10}°C` : 'No temperature yet',
    };
  }, [parts, sessionRows]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }} edges={['top']}>
      <NavBar title="You" trailingIcon="settings" onTrailingPress={() => router.push('/settings')} />
      <ScrollView contentContainerStyle={{ paddingHorizontal: ScreenGutter, paddingBottom: 96, gap: 20 }}>
        <Card>
          <Label style={{ marginBottom: 10 }}>Lifetime</Label>
          <StatsStrip stats={[
            { label: 'Sessions', value: statistics.sessions },
            { label: 'Rounds', value: statistics.rounds },
            { label: 'Sauna', value: hoursLabel(statistics.heatSeconds), tone: 'hot' },
            { label: 'Plunge', value: hoursLabel(statistics.coldSeconds), tone: 'cold' },
          ]} />
        </Card>

        <View style={{ flexDirection: 'row', gap: 12 }}>
          <Card style={{ flex: 1 }}>
            <Label style={{ marginBottom: 6 }}>Current streak</Label>
            <Text style={{ fontFamily: Rubik.bold, ...displayText(34), color: theme.text, fontVariant: ['tabular-nums'] }}>
              {statistics.streak} <Text style={{ fontFamily: Rubik.medium, fontSize: 14, letterSpacing: 0, color: theme.textSecondary }}>weeks</Text>
            </Text>
          </Card>
          <Card style={{ flex: 1 }}>
            <Label style={{ marginBottom: 6 }}>This month</Label>
            <Text style={{ fontFamily: Rubik.bold, ...displayText(34), color: theme.text, fontVariant: ['tabular-nums'] }}>
              {statistics.monthSessions} <Text style={{ fontFamily: Rubik.medium, fontSize: 14, letterSpacing: 0, color: theme.textSecondary }}>sessions</Text>
            </Text>
          </Card>
        </View>

        <View style={{ gap: 10 }}>
          <Label>Last 15 weeks</Label>
          <Card><Heatmap data={statistics.heatmap} cell={13} /></Card>
        </View>

        <View style={{ gap: 8 }}>
          <Label>Records</Label>
          <Card padded={false}>
            <ListRow title="Longest session" meta={statistics.longest} />
            <ListRow title="Hottest sit" meta={statistics.hottest} />
            <ListRow title="Coldest plunge" meta={statistics.coldest} />
            <ListRow title="Most rounds in a visit" meta={statistics.mostRounds} />
          </Card>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
