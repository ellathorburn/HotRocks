import * as Linking from 'expo-linking';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Badge, Button, Card, Icon, IconButton, Label, Rating, Sheet, StatsStrip, TimelineList, TimelineStrip } from '@/components/ds';
import { NavBar } from '@/components/nav-bar';
import { displayText, Rubik, ScreenGutter, Type } from '@/constants/theme';
import { useDisplayPreferences } from '@/features/profiles/hooks/use-display-preferences';
import { useSessionDetail } from '@/features/sessions/hooks/use-session-detail';
import { sessionTimelineDraftService } from '@/features/sessions/services/session-draft-service';
import { sessionService } from '@/features/sessions/services/session-service';
import {
  StravaPostError,
  stravaExportService,
  stravaPostMessages,
} from '@/features/strava/services/strava-export-service';
import {
  resolveSessionConflict,
  type SessionConflictResolution,
} from '@/services/sync/sync-engine';
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
    needsSyncAttention,
    isLoaded,
  } = useSessionDetail(id, preferences);
  const [conflictOpen, setConflictOpen] = useState(false);
  const [isResolving, setIsResolving] = useState(false);
  const [isPosting, setIsPosting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

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

  const startEdit = () => {
    if (!preferences.userId || !session) return;
    setActionError(null);
    try {
      const draftId = sessionTimelineDraftService.createEdit(preferences.userId, session.id);
      router.push({ pathname: '/session/summary', params: { draftId } });
    } catch (error) {
      if (__DEV__) console.error('Starting a session edit failed', error);
      setActionError('Could not open this session for editing.');
    }
  };

  const postToStrava = async () => {
    if (!preferences.userId || !session) return;
    setIsPosting(true);
    setActionError(null);
    try {
      await stravaExportService.post({
        sessionId: session.id,
        userId: preferences.userId,
        venueName: session.venue,
        totals,
        note: session.note,
        temperatureUnit: preferences.temperatureUnit,
      });
    } catch (error) {
      if (__DEV__) console.error('Posting to Strava failed', error);
      setActionError(error instanceof StravaPostError ? error.message : stravaPostMessages.unknown);
    } finally {
      setIsPosting(false);
    }
  };

  const resolveConflict = async (resolution: SessionConflictResolution) => {
    if (!preferences.userId || !session) return;
    setIsResolving(true);
    setActionError(null);
    try {
      await resolveSessionConflict(preferences.userId, session.id, resolution);
      setConflictOpen(false);
    } catch (error) {
      if (__DEV__) console.error('Resolving a sync conflict failed', error);
      setActionError('Could not reach the server. Your choice is saved and will be retried.');
    } finally {
      setIsResolving(false);
    }
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
          {needsSyncAttention ? <Badge tone="hot" icon="alert-triangle">Needs your choice</Badge> : null}
          {stravaExport && stravaExport.status !== 'posted' ? <Badge icon="cloud-off">Waiting for Strava</Badge> : null}
        </View>

        {needsSyncAttention ? (
          <Card style={{ marginTop: 16 }}>
            <Label style={{ marginBottom: 6 }}>Sync stopped</Label>
            <Text style={{ fontFamily: Rubik.regular, fontSize: Type.small, lineHeight: Type.small * 1.5, color: theme.textSecondary }}>
              This session changed on another device too, so HotRocks stopped
              rather than overwrite either version. Nothing else syncs until you
              choose which one to keep.
            </Text>
            <Button variant="secondary" fullWidth style={{ marginTop: 12 }} onPress={() => setConflictOpen(true)}>
              Choose a version
            </Button>
          </Card>
        ) : null}

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
          ) : (
            <Button
              variant="secondary"
              fullWidth
              loading={isPosting}
              disabled={needsSyncAttention}
              iconLeft={<Icon name="link" size={18} color={theme.text} />}
              onPress={() => void postToStrava()}>
              {stravaExport?.status === 'action_required' ? 'Try Strava again' : 'Post to Strava'}
            </Button>
          )}
          <Button
            variant="secondary"
            fullWidth
            iconLeft={<Icon name="pencil" size={18} color={theme.text} />}
            onPress={startEdit}>
            Edit session
          </Button>
          <Button variant="ghost" fullWidth onPress={confirmDelete}>
            Delete session
          </Button>
          {actionError ? (
            <Text accessibilityRole="alert" style={{ fontFamily: Rubik.medium, fontSize: Type.small, color: theme.cedar, textAlign: 'center' }}>
              {actionError}
            </Text>
          ) : null}
        </View>
      </ScrollView>

      <Sheet
        open={conflictOpen}
        title="Which version should HotRocks keep?"
        onDismiss={() => setConflictOpen(false)}>
        <View>
          <Text style={{ fontFamily: Rubik.regular, fontSize: Type.body, lineHeight: Type.body * 1.5, color: theme.textSecondary, marginBottom: 18 }}>
            Both versions cannot be kept. Whichever you do not choose is lost.
          </Text>
          <View style={{ gap: 10 }}>
            <Button size="lg" fullWidth loading={isResolving} onPress={() => void resolveConflict('keep-local')}>
              Keep this device&rsquo;s version
            </Button>
            <Button size="lg" variant="secondary" fullWidth disabled={isResolving} onPress={() => void resolveConflict('use-remote')}>
              Use the other device&rsquo;s version
            </Button>
          </View>
          <Text style={{ marginTop: 14, fontFamily: Rubik.regular, fontSize: 13, lineHeight: 18, color: theme.textSecondary }}>
            Keeping this device&rsquo;s version uploads what you see here. Using the
            other device&rsquo;s version discards these details and downloads that
            version instead.
          </Text>
        </View>
      </Sheet>
    </SafeAreaView>
  );
}
