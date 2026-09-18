import { router } from 'expo-router';
import { ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Card, Heatmap, Label, ListRow, StatsStrip } from '@/components/ds';
import { NavBar } from '@/components/nav-bar';
import { displayText, Rubik, ScreenGutter } from '@/constants/theme';
import { useAuth } from '@/features/auth/auth-context';
import { useDisplayPreferences } from '@/features/profiles/hooks/use-display-preferences';
import { useSessionStatistics } from '@/features/sessions/hooks/use-session-statistics';
import { useTheme } from '@/hooks/use-theme';
import { formatTotalDuration } from '@/lib/format';

export default function ProfileScreen() {
  const theme = useTheme();
  const preferences = useDisplayPreferences();
  const statistics = useSessionStatistics(preferences);
  const { profile } = useAuth();
  const firstName = profile?.first_name?.trim();

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }} edges={['top']}>
      <NavBar title={firstName ? `Hey, ${firstName}.` : 'You'} trailingIcon="settings" onTrailingPress={() => router.push('/settings')} />
      <ScrollView contentContainerStyle={{ paddingHorizontal: ScreenGutter, paddingBottom: 28, gap: 20 }}>
        <Card>
          <Label style={{ marginBottom: 10 }}>Lifetime</Label>
          <StatsStrip stats={[
            { label: 'Sessions', value: statistics.sessions },
            { label: 'Sauna', value: formatTotalDuration(statistics.heatSeconds), tone: 'hot' },
            { label: 'Plunge', value: formatTotalDuration(statistics.coldSeconds), tone: 'cold' },
            { label: 'Break', value: formatTotalDuration(statistics.restSeconds) },
          ]} />
        </Card>

        <View style={{ flexDirection: 'row', gap: 12 }}>
          <Card style={{ flex: 1 }}>
            <Label style={{ marginBottom: 6 }}>Current streak</Label>
            <Text style={{ fontFamily: Rubik.bold, ...displayText(34), color: theme.text, fontVariant: ['tabular-nums'] }}>
              {statistics.streak} <Text style={{ fontFamily: Rubik.medium, fontSize: 14, letterSpacing: 0, color: theme.textSecondary }}>{statistics.streak === 1 ? 'week' : 'weeks'}</Text>
            </Text>
          </Card>
          <Card style={{ flex: 1 }}>
            <Label style={{ marginBottom: 6 }}>This month</Label>
            <Text style={{ fontFamily: Rubik.bold, ...displayText(34), color: theme.text, fontVariant: ['tabular-nums'] }}>
              {statistics.monthSessions} <Text style={{ fontFamily: Rubik.medium, fontSize: 14, letterSpacing: 0, color: theme.textSecondary }}>{statistics.monthSessions === 1 ? 'session' : 'sessions'}</Text>
            </Text>
          </Card>
        </View>

        <View style={{ gap: 10 }}>
          <Label>Last 15 weeks</Label>
          <Card><Heatmap data={statistics.heatmap} timeZone={preferences.timeZone} /></Card>
        </View>

        <View style={{ gap: 8 }}>
          <Label>Records</Label>
          <Card padded={false}>
            <ListRow title="Longest session" meta={statistics.longest} />
            <ListRow title="Hottest sit" meta={statistics.hottest} />
            <ListRow title="Coldest plunge" meta={statistics.coldest} />
            <ListRow title="Most entries in a visit" meta={statistics.mostEntries} />
          </Card>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
