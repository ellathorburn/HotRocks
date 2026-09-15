import { router } from 'expo-router';
import { FlatList, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button, Card, IconButton, Label, Logo, SessionCard, StatsStrip } from '@/components/ds';
import { Rubik, ScreenGutter, Type } from '@/constants/theme';
import { SESSIONS } from '@/features/sessions/sample-data';
import { useTheme } from '@/hooks/use-theme';

export default function HomeScreen() {
  const theme = useTheme();
  const hasSessions = SESSIONS.length > 0;

  if (!hasSessions) {
    return <EmptyHome />;
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }} edges={['top']}>
      <View style={{ paddingHorizontal: ScreenGutter, paddingBottom: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Logo height={24} />
        <IconButton icon="settings" label="Settings" size={38} onPress={() => router.push('/settings')} />
      </View>

      <View style={{ paddingHorizontal: ScreenGutter, paddingBottom: 14 }}>
        <Card>
          <Label style={{ marginBottom: 10 }}>This week</Label>
          <StatsStrip
            stats={[
              { label: 'Sessions', value: 3 },
              { label: 'Rounds', value: 8 },
              { label: 'Sauna', value: '1:29', tone: 'hot' },
              { label: 'Plunge', value: '0:20', tone: 'cold' },
            ]}
          />
        </Card>
      </View>

      <FlatList
        data={SESSIONS}
        keyExtractor={(s) => s.id}
        contentContainerStyle={{ paddingHorizontal: ScreenGutter, gap: 12, paddingBottom: 24 }}
        renderItem={({ item }) => <SessionCard session={item} onPress={() => router.push(`/session/${item.id}`)} />}
      />

      <View style={{ paddingHorizontal: ScreenGutter, paddingVertical: 8, gap: 8 }}>
        <Button size="lg" fullWidth onPress={() => router.push('/log-round')}>
          Log a session
        </Button>
        <Button size="sm" variant="ghost" fullWidth onPress={() => router.push('/log-round')}>
          Same as last time · Löyly Kallio, 3 rounds
        </Button>
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
          A round is the hot sit and the cold plunge together. Log one and it lands here.
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
