import { router } from 'expo-router';
import { useState } from 'react';
import { FlatList, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Badge, Button, Card, Icon, IconButton, Label, Logo, SessionCard, StatsStrip } from '@/components/ds';
import { Rubik, ScreenGutter, Type } from '@/constants/theme';
import { useDisplayPreferences } from '@/features/profiles/hooks/use-display-preferences';
import { useHomeSessions } from '@/features/sessions/hooks/use-home-sessions';
import { sessionTimelineDraftService } from '@/features/sessions/services/session-draft-service';
import { useTheme } from '@/hooks/use-theme';
import { formatCount, formatTotalDuration } from '@/lib/format';

export default function HomeScreen() {
  const theme = useTheme();
  const preferences = useDisplayPreferences();
  const { cards, week, lastSession, unsyncedCount, isLoaded } = useHomeSessions(preferences);
  const [repeatError, setRepeatError] = useState<string | null>(null);

  const repeatLastSession = () => {
    if (!lastSession || !preferences.userId) return;
    setRepeatError(null);
    try {
      const draftId = sessionTimelineDraftService.createRepeat(preferences.userId, lastSession.id);
      router.push({ pathname: '/session/summary', params: { draftId } });
    } catch (error) {
      if (__DEV__) console.error('Repeat session failed', error);
      setRepeatError('Could not reuse that session. Log a new one instead.');
    }
  };

  const weekStats = (
    <View style={{ paddingHorizontal: ScreenGutter, paddingBottom: 14 }}>
      <Card>
        <Label style={{ marginBottom: 10 }}>This week</Label>
        <StatsStrip stats={[
          { label: 'Sessions', value: week.sessions },
          { label: 'Sauna', value: formatTotalDuration(week.heatSeconds), tone: 'hot' },
          { label: 'Plunge', value: formatTotalDuration(week.coldSeconds), tone: 'cold' },
          { label: 'Break', value: formatTotalDuration(week.restSeconds) },
        ]} />
      </Card>
    </View>
  );

  const header = (
    <View style={{ paddingHorizontal: ScreenGutter, paddingBottom: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
      <Logo height={24} />
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        {unsyncedCount > 0 ? (
          <Badge icon="cloud-off">{`${formatCount(unsyncedCount, 'session', 'sessions')} on device`}</Badge>
        ) : null}
        <IconButton icon="settings" label="Settings" size={38} onPress={() => router.push('/settings')} />
      </View>
    </View>
  );

  if (isLoaded && cards.length === 0) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }} edges={['top']}>
        {header}
        {weekStats}
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 14, paddingHorizontal: ScreenGutter }}>
          <Logo variant="mark" height={72} />
          <Text style={{ fontFamily: Rubik.semibold, fontSize: Type.heading, letterSpacing: -0.24, color: theme.text }}>
            Nothing logged yet
          </Text>
          <Text style={{ fontFamily: Rubik.regular, fontSize: Type.body, lineHeight: Type.body * 1.5, color: theme.textSecondary, textAlign: 'center', maxWidth: 260 }}>
            Log a sauna, a cold plunge or a break and it lands here.
          </Text>
        </View>
        <View style={{ paddingHorizontal: ScreenGutter, paddingTop: 8, paddingBottom: 16 }}>
          <Button size="lg" fullWidth onPress={() => router.push('/log-session')}>
            Log your first session
          </Button>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }} edges={['top']}>
      {header}
      {weekStats}

      <FlatList
        data={cards}
        keyExtractor={(session) => session.id}
        contentContainerStyle={{ paddingHorizontal: ScreenGutter, paddingTop: 2, gap: 12, paddingBottom: 24 }}
        renderItem={({ item }) => <SessionCard session={item} onPress={() => router.push(`/session/${item.id}`)} />}
      />

      <View style={{ paddingHorizontal: ScreenGutter, paddingTop: 8, paddingBottom: 16, gap: 8 }}>
        <Button size="lg" fullWidth iconLeft={<Icon name="plus" size={20} color={theme.textOnAccent} />} onPress={() => router.push('/log-session')}>
          Log a session
        </Button>
        {lastSession ? (
          <Button size="sm" variant="ghost" fullWidth onPress={repeatLastSession}>
            Same as last time · {lastSession.title}
          </Button>
        ) : null}
        {repeatError ? (
          <Text style={{ fontFamily: Rubik.medium, fontSize: Type.small, color: theme.cedar, textAlign: 'center' }}>
            {repeatError}
          </Text>
        ) : null}
      </View>
    </SafeAreaView>
  );
}
