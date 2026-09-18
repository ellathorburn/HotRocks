import * as Linking from 'expo-linking';
import { router, useLocalSearchParams } from 'expo-router';
import { Alert, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Badge, Button, Card, Icon, IconButton, Label, Rating, StatsStrip, TimelineList, TimelineStrip } from '@/components/ds';
import { NavBar } from '@/components/nav-bar';
import { displayText, Rubik, ScreenGutter, Type } from '@/constants/theme';
import { useDisplayPreferences } from '@/features/profiles/hooks/use-display-preferences';
import { useSessionDetail } from '@/features/sessions/hooks/use-session-detail';
import { sessionService } from '@/features/sessions/services/session-service';
import { useTheme } from '@/hooks/use-theme';
import { formatTemperature, formatTotalDuration } from '@/lib/format';
import { singleRouteParam } from '@/lib/route-params';

export default function SessionDetailScreen() {
  const theme = useTheme();
  const preferences = useDisplayPreferences();
  const params = useLocalSearchParams<{ id?: string | string[] }>();
  const id = singleRouteParam(params.id) ?? '';
  const {
    session,
    stravaExport,
    segments,
    entries,
    composition,
    totals,
    totalTime,
    date,
    title,
    isPendingSync,
    isLoaded,
  } = useSessionDetail(id, preferences);

  const confirmDelete = () => {
    if (!preferences.userId || !session) return;
    Alert.alert('Delete session?', 'This removes the session from HotRocks.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => void sessionService.delete(session.id, preferences.userId).then(() => router.back()),
      },
    ]);
  };

  if (!session) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }} edges={['top']}>
        <NavBar title="Session" showBack />
        {isLoaded ? (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: ScreenGutter }}>
            <Text style={{ fontFamily: Rubik.medium, fontSize: Type.body, color: theme.textSecondary }}>Session not found.</Text>
          </View>
        ) : null}
      </SafeAreaView>
    );
  }

  const { peakHeatCTenths, coldestColdCTenths } = totals;
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }} edges={['top']}>
      <NavBar
        title=""
        showBack
        trailing={<IconButton icon="share-2" label="Share" size={38} onPress={() => router.push(`/share/${session.id}`)} />}
      />
      <ScrollView contentContainerStyle={{ paddingHorizontal: ScreenGutter, paddingBottom: 28 }}>
        {/* In the page rather than the nav bar so a long venue name wraps instead of truncating. */}
        <Text accessibilityRole="header" style={{ fontFamily: Rubik.semibold, fontSize: Type.heading, lineHeight: 29, letterSpacing: -0.24, color: theme.text, marginBottom: 8 }}>
          {title}
        </Text>
        <Text style={{ fontFamily: Rubik.bold, ...displayText(56), color: theme.text, fontVariant: ['tabular-nums'] }}>
          {totalTime}
        </Text>
        <Text style={{ marginTop: 4, fontFamily: Rubik.regular, fontSize: Type.body, color: theme.textSecondary }}>
          {composition}
        </Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 10, flexWrap: 'wrap' }}>
          <Text style={{ fontFamily: Rubik.regular, fontSize: Type.small, color: theme.textSecondary }}>{date}</Text>
          {session.rating ? <Rating value={session.rating} readOnly size={15} /> : null}
          {isPendingSync ? <Badge icon="cloud-off">Saved on device</Badge> : null}
          {stravaExport && stravaExport.status !== 'posted' ? <Badge icon="cloud-off">Waiting for Strava</Badge> : null}
        </View>

        <View style={{ marginTop: 18 }}>
          <TimelineStrip segments={segments} height={64} />
        </View>

        <View style={{ marginTop: 20 }}>
          {/* Only what this session actually contained. */}
          <StatsStrip stats={[
            ...(totals.heatSeconds > 0 ? [{ label: 'Sauna', value: formatTotalDuration(totals.heatSeconds), tone: 'hot' as const }] : []),
            ...(totals.coldSeconds > 0 ? [{ label: 'Plunge', value: formatTotalDuration(totals.coldSeconds), tone: 'cold' as const }] : []),
            ...(totals.restSeconds > 0 ? [{ label: 'Break', value: formatTotalDuration(totals.restSeconds) }] : []),
          ]} />
        </View>

        {peakHeatCTenths !== null || coldestColdCTenths !== null ? (
          <View style={{ flexDirection: 'row', gap: 12, marginTop: 12 }}>
            {peakHeatCTenths !== null ? (
              <Card style={{ flex: 1 }}>
                <Label style={{ marginBottom: 6 }}>Peak sauna</Label>
                <Text style={{ fontFamily: Rubik.bold, ...displayText(28), color: theme.text, fontVariant: ['tabular-nums'] }}>
                  {formatTemperature(peakHeatCTenths, preferences.temperatureUnit)}
                </Text>
              </Card>
            ) : null}
            {coldestColdCTenths !== null ? (
              <Card style={{ flex: 1 }}>
                <Label style={{ marginBottom: 6 }}>Coldest plunge</Label>
                <Text style={{ fontFamily: Rubik.bold, ...displayText(28), color: theme.text, fontVariant: ['tabular-nums'] }}>
                  {formatTemperature(coldestColdCTenths, preferences.temperatureUnit)}
                </Text>
              </Card>
            ) : null}
          </View>
        ) : null}

        {session.note ? (
          <Text style={{ marginTop: 20, fontFamily: Rubik.regular, fontSize: Type.body, lineHeight: Type.body * 1.5, color: theme.text }}>
            {session.note}
          </Text>
        ) : null}

        <View style={{ marginTop: 20 }}>
          <TimelineList entries={entries} />
        </View>

        <View style={{ marginTop: 20, gap: 10 }}>
          {stravaExport?.stravaActivityId ? (
            <Button
              variant="secondary"
              fullWidth
              iconLeft={<Icon name="external-link" size={18} color={theme.text} />}
              onPress={() => void Linking.openURL(`https://www.strava.com/activities/${stravaExport.stravaActivityId}`)}>
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
