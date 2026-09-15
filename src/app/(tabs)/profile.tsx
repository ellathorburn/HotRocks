import { router } from 'expo-router';
import { ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Badge, Card, Heatmap, Label, ListRow, StatsStrip } from '@/components/ds';
import { NavBar } from '@/components/nav-bar';
import { Rubik, ScreenGutter } from '@/constants/theme';
import { HEATMAP } from '@/features/sessions/sample-data';
import { useTheme } from '@/hooks/use-theme';

export default function ProfileScreen() {
  const theme = useTheme();

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }} edges={['top']}>
      <NavBar title="You" trailingIcon="settings" onTrailingPress={() => router.push('/settings')} />
      <ScrollView contentContainerStyle={{ paddingHorizontal: ScreenGutter, paddingBottom: 96, gap: 20 }}>
        <Card>
          <Label style={{ marginBottom: 10 }}>Lifetime</Label>
          <StatsStrip
            stats={[
              { label: 'Sessions', value: 214 },
              { label: 'Rounds', value: 702 },
              { label: 'Sauna', value: '146h', tone: 'hot' },
              { label: 'Plunge', value: '21h', tone: 'cold' },
            ]}
          />
        </Card>

        <View style={{ flexDirection: 'row', gap: 12 }}>
          <Card style={{ flex: 1 }}>
            <Label style={{ marginBottom: 6 }}>Current streak</Label>
            <Text style={{ fontFamily: Rubik.bold, fontSize: 34, color: theme.text, fontVariant: ['tabular-nums'] }}>
              11 <Text style={{ fontFamily: Rubik.medium, fontSize: 14, color: theme.textSecondary }}>weeks</Text>
            </Text>
          </Card>
          <Card style={{ flex: 1 }}>
            <Label style={{ marginBottom: 6 }}>This month</Label>
            <Text style={{ fontFamily: Rubik.bold, fontSize: 34, color: theme.text, fontVariant: ['tabular-nums'] }}>
              13 <Text style={{ fontFamily: Rubik.medium, fontSize: 14, color: theme.textSecondary }}>sessions</Text>
            </Text>
          </Card>
        </View>

        <View style={{ gap: 10 }}>
          <Label>Last 15 weeks</Label>
          <Card>
            <Heatmap data={HEATMAP} cell={13} />
          </Card>
        </View>

        <View style={{ gap: 8 }}>
          <Label>Records</Label>
          <Card padded={false}>
            <ListRow
              title="Longest session"
              meta="Allas Sea Pool · 1:21:00"
              trailing={
                <Badge tone="hot" textColor="#9A4F2B">
                  PR
                </Badge>
              }
            />
            <ListRow title="Hottest sit" meta="Kotiharjun Sauna · 98°C" />
            <ListRow
              title="Coldest plunge"
              meta="Löyly Kallio · 11°C"
              trailing={
                <Badge tone="cold" textColor="#436C86">
                  PR
                </Badge>
              }
            />
            <ListRow title="Most rounds in a visit" meta="Allas Sea Pool · 6 rounds" />
          </Card>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
