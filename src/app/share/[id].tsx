import { router, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Chip, IconButton, Logo, TimelineStrip } from '@/components/ds';
import { displayText, Radius, Rubik, ScreenGutter } from '@/constants/theme';
import { useDisplayPreferences } from '@/features/profiles/hooks/use-display-preferences';
import { useShareSession } from '@/features/sessions/hooks/use-session-detail';
import { ThemeSchemeContext } from '@/hooks/use-theme';
import { formatTemperature, formatTotalDuration } from '@/lib/format';
import { singleRouteParam } from '@/lib/route-params';

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
  const preferences = useDisplayPreferences();
  const params = useLocalSearchParams<{ id?: string | string[] }>();
  const id = singleRouteParam(params.id);
  const [story, setStory] = useState(false);
  const {
    session,
    segments,
    composition,
    totals,
    totalTime,
    date,
    title,
    isLoaded,
  } = useShareSession(id ?? '', preferences);

  if (!session) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: '#0F0E47' }} edges={['top']}>
        <ShareHeader />
        {isLoaded ? (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: ScreenGutter }}>
            <Text style={{ fontFamily: Rubik.medium, color: '#8686AC', textAlign: 'center' }}>
              This session does not exist or does not belong to this account.
            </Text>
          </View>
        ) : null}
      </SafeAreaView>
    );
  }

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
              {title} · {date}
            </Text>
            <Text style={{ marginTop: 8, fontFamily: Rubik.bold, ...displayText(58), color: '#F5F5DC', fontVariant: ['tabular-nums'] }}>
              {totalTime}
            </Text>
            <Text style={{ marginTop: 4, fontFamily: Rubik.regular, fontSize: 14, color: '#8686AC' }}>
              {composition}
            </Text>
          </View>

          <View>
            <TimelineStrip segments={segments} height={story ? 40 : 52} />
            <View style={{ flexDirection: 'row', gap: 12, marginTop: 16 }}>
              {totals.heatSeconds > 0 ? (
                <Metric
                  label="Sauna"
                  value={formatTotalDuration(totals.heatSeconds)}
                  temperature={totals.peakHeatCTenths === null ? null : formatTemperature(totals.peakHeatCTenths, preferences.temperatureUnit)}
                  color="#E35336"
                />
              ) : null}
              {totals.coldSeconds > 0 ? (
                <Metric
                  label="Plunge"
                  value={formatTotalDuration(totals.coldSeconds)}
                  temperature={totals.coldestColdCTenths === null ? null : formatTemperature(totals.coldestColdCTenths, preferences.temperatureUnit)}
                  color="#7EA8C4"
                />
              ) : null}
              {totals.restSeconds > 0 ? (
                <Metric label="Break" value={formatTotalDuration(totals.restSeconds)} temperature={null} color="#9090B3" />
              ) : null}
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

function Metric({ label, value, temperature, color }: { label: string; value: string; temperature: string | null; color: string }) {
  return (
    <View style={{ flex: 1 }}>
      <Text style={{ fontFamily: Rubik.medium, fontSize: 12, letterSpacing: 0.5, textTransform: 'uppercase', color }}>{label}</Text>
      <Text style={{ fontFamily: Rubik.bold, ...displayText(22), color: '#F5F5DC', fontVariant: ['tabular-nums'] }}>
        {value}
        {temperature ? (
          <Text style={{ fontFamily: Rubik.regular, fontSize: 13, letterSpacing: 0, color: '#8686AC' }}> {temperature}</Text>
        ) : null}
      </Text>
    </View>
  );
}
