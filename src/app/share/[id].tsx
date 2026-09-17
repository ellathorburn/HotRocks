import { and, asc, eq, isNull } from 'drizzle-orm';
import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { router, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Chip, IconButton, Logo, RoundStrip, type RoundSegment } from '@/components/ds';
import { displayText, Radius, Rubik, ScreenGutter } from '@/constants/theme';
import { ThemeSchemeContext } from '@/hooks/use-theme';
import { useAuth } from '@/features/auth/auth-context';
import { formatDuration } from '@/lib/format';
import { singleRouteParam } from '@/lib/route-params';
import { database } from '@/services/database/client';
import { roundParts, rounds, sessions } from '@/services/database/schema';

/** The share card is dark-only in the design system, regardless of app theme. */
export default function ShareCardScreen() {
  return (
    <ThemeSchemeContext value="dark">
      <StatusBar style="light" />
      <ShareCardContent />
    </ThemeSchemeContext>
  );
}

function ShareCardContent() {
  const { user } = useAuth();
  const params = useLocalSearchParams<{ id?: string | string[] }>();
  const id = singleRouteParam(params.id);
  const userId = user?.id ?? '';
  const [story, setStory] = useState(false);
  const { data: sessionRows = [], updatedAt } = useLiveQuery(
    database.select({
      venue: sessions.venueNameSnapshot,
      elapsedSeconds: sessions.elapsedSeconds,
      roundCount: sessions.roundCount,
      startedAt: sessions.startedAt,
      heatSeconds: sessions.heatSeconds,
      coldSeconds: sessions.coldSeconds,
    }).from(sessions)
      .where(and(eq(sessions.id, id ?? ''), eq(sessions.userId, userId), isNull(sessions.deletedAt)))
      .limit(1),
    [id, userId],
  );
  const { data: parts = [] } = useLiveQuery(
    database.select({
      kind: roundParts.kind,
      durationSeconds: roundParts.durationSeconds,
      temperatureCTenths: roundParts.temperatureCTenths,
      roundPosition: rounds.position,
      partPosition: roundParts.position,
    }).from(roundParts)
      .innerJoin(rounds, eq(rounds.id, roundParts.roundId))
      .where(and(eq(roundParts.sessionId, id ?? ''), eq(roundParts.userId, userId)))
      .orderBy(asc(rounds.position), asc(roundParts.position)),
    [id, userId],
  );
  const session = sessionRows[0];

  if (!session) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: '#0F0E47' }} edges={['top']}>
        <ShareHeader />
        {updatedAt ? (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: ScreenGutter }}>
            <Text style={{ fontFamily: Rubik.medium, color: '#8686AC', textAlign: 'center' }}>
              This session does not exist or does not belong to this account.
            </Text>
          </View>
        ) : null}
      </SafeAreaView>
    );
  }

  const segments: RoundSegment[] = parts.map((part) => ({
    type: part.kind,
    minutes: part.durationSeconds / 60,
    temp: part.temperatureCTenths === null ? null : part.temperatureCTenths / 10,
  }));
  const peakHeat = parts
    .filter((part) => part.kind === 'heat' && part.temperatureCTenths !== null)
    .reduce<number | null>((peak, part) => Math.max(peak ?? -Infinity, part.temperatureCTenths!), null);
  const coldestCold = parts
    .filter((part) => part.kind === 'cold' && part.temperatureCTenths !== null)
    .reduce<number | null>((coldest, part) => Math.min(coldest ?? Infinity, part.temperatureCTenths!), null);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#0F0E47' }} edges={['top']}>
      <ShareHeader />
      <View style={{ paddingHorizontal: ScreenGutter, gap: 18 }}>
        <View style={{ aspectRatio: story ? 9 / 16 : 1, borderRadius: Radius.lg, padding: 22, justifyContent: 'space-between',
          // Share card is the one gradient in the system; the bloom is its earned glow.
          experimental_backgroundImage: 'linear-gradient(160deg, #2A1330 0%, #0F0E47 55%, #0F0E47 100%)',
          boxShadow: '0 0 40px rgba(227,83,54,0.18)' }}>
          <View>
            <Text numberOfLines={1} style={{ fontFamily: Rubik.medium, fontSize: 12, letterSpacing: 0.5, textTransform: 'uppercase', color: '#8686AC' }}>
              {session.venue ?? 'Venue not set'} · {new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(new Date(session.startedAt))}
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 10, marginTop: 8 }}>
              <Text style={{ fontFamily: Rubik.bold, ...displayText(58), color: '#F5F5DC', fontVariant: ['tabular-nums'] }}>
                {formatDuration(session.elapsedSeconds)}
              </Text>
              <Text style={{ fontFamily: Rubik.regular, fontSize: 16, color: '#8686AC' }}>
                {session.roundCount} {session.roundCount === 1 ? 'round' : 'rounds'}
              </Text>
            </View>
          </View>

          <View>
            <RoundStrip segments={segments} height={story ? 40 : 52} />
            <View style={{ flexDirection: 'row', gap: 14, marginTop: 16 }}>
              <Metric label="Heat" value={formatDuration(session.heatSeconds)} temperature={peakHeat} color="#E35336" />
              <Metric label="Cold" value={formatDuration(session.coldSeconds)} temperature={coldestCold} color="#7EA8C4" />
            </View>
          </View>

          <View style={{ alignItems: 'flex-end' }}><Logo variant="dark" height={16} /></View>
        </View>

        <Text style={{ fontFamily: Rubik.regular, fontSize: 14, lineHeight: 21, color: '#8686AC', textAlign: 'center' }}>
          Image export will be enabled when photo-library permissions are added.
        </Text>
        <View style={{ flexDirection: 'row', gap: 8, justifyContent: 'center' }}>
          <Chip size="sm" selected={!story} onPress={() => setStory(false)}>Square</Chip>
          <Chip size="sm" selected={story} onPress={() => setStory(true)}>9:16</Chip>
        </View>
      </View>
    </SafeAreaView>
  );
}

function ShareHeader() {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: ScreenGutter, paddingTop: 6, paddingBottom: 10, minHeight: 48 }}>
      <IconButton icon="chevron-left" label="Back" size={36} color="#F5F5DC" onPress={() => router.back()} style={{ marginLeft: -8 }} />
      <Text style={{ flex: 1, fontFamily: Rubik.semibold, fontSize: 24, lineHeight: 29, letterSpacing: -0.24, color: '#F5F5DC' }}>Share</Text>
    </View>
  );
}

function Metric({ label, value, temperature, color }: { label: string; value: string; temperature: number | null; color: string }) {
  return (
    <View style={{ flex: 1 }}>
      <Text style={{ fontFamily: Rubik.medium, fontSize: 12, letterSpacing: 0.5, textTransform: 'uppercase', color }}>{label}</Text>
      <Text style={{ fontFamily: Rubik.bold, ...displayText(26), color: '#F5F5DC', fontVariant: ['tabular-nums'] }}>
        {value}{' '}
        <Text style={{ fontFamily: Rubik.regular, fontSize: 14, letterSpacing: 0, color: '#8686AC' }}>
          {temperature === null ? '—' : `${temperature / 10}°C`}
        </Text>
      </Text>
    </View>
  );
}
