import { router, useLocalSearchParams } from 'expo-router';
import { ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Badge, Button, Icon, IconButton, ListRow, Rating, RoundStrip, StatsStrip } from '@/components/ds';
import { NavBar } from '@/components/nav-bar';
import { Radius, Rubik, ScreenGutter, Type } from '@/constants/theme';
import { findSession } from '@/features/sessions/sample-data';
import { useTheme } from '@/hooks/use-theme';

export default function SessionDetailScreen() {
  const theme = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const session = findSession(id) ?? findSession('s1')!;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }} edges={['top']}>
      <NavBar
        title={session.venue}
        showBack
        trailing={
          <View style={{ flexDirection: 'row', gap: 2 }}>
            <IconButton icon="pencil" label="Edit" size={38} />
            <IconButton icon="share-2" label="Share" size={38} onPress={() => router.push(`/share/${session.id}`)} />
          </View>
        }
      />
      <ScrollView contentContainerStyle={{ paddingHorizontal: ScreenGutter, paddingBottom: 28 }}>
        <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 10 }}>
          <Text style={{ fontFamily: Rubik.bold, fontSize: 56, color: theme.text, fontVariant: ['tabular-nums'] }}>
            {session.totalTime}
          </Text>
          <Text style={{ fontFamily: Rubik.medium, fontSize: 18, color: theme.textSecondary }}>
            {session.rounds} {session.rounds === 1 ? 'round' : 'rounds'}
          </Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 6, flexWrap: 'wrap' }}>
          <Text style={{ fontFamily: Rubik.regular, fontSize: Type.small, color: theme.textSecondary }}>{session.date}</Text>
          {session.rating ? <Rating value={session.rating} readOnly size={15} /> : null}
          {!session.synced ? <Badge icon="cloud-off">Saved on device</Badge> : null}
        </View>

        <View style={{ marginTop: 18 }}>
          <RoundStrip segments={session.segments} height={64} />
        </View>

        <View style={{ marginTop: 20 }}>
          <StatsStrip
            stats={[
              { label: 'Time in sauna', value: session.heat, tone: 'hot' },
              { label: 'Time in plunge', value: session.cold, tone: 'cold' },
              { label: 'Peak', value: session.peak ? `${session.peak}°` : '—', tone: 'hot' },
            ]}
          />
        </View>

        {session.note ? (
          <Text style={{ marginTop: 20, fontFamily: Rubik.regular, fontSize: Type.body, lineHeight: Type.body * 1.5, color: theme.text }}>
            {session.note}
          </Text>
        ) : null}

        <View style={{ marginTop: 20, gap: 2 }}>
          <Text style={{ fontFamily: Rubik.medium, fontSize: Type.label, letterSpacing: 0.5, textTransform: 'uppercase', color: theme.textSecondary, marginBottom: 6 }}>
            Rounds
          </Text>
          {session.segments.map((s, i) => (
            <ListRow
              key={i}
              title={s.type === 'heat' ? `${s.minutes} min in the sauna` : `${s.minutes} min in the plunge`}
              meta={`${s.temp}°`}
              leading={<Icon name={s.type === 'heat' ? 'flame' : 'snowflake'} size={20} color={s.type === 'heat' ? theme.hot : theme.cold} />}
              chevron
            />
          ))}
        </View>

        <View
          style={{
            marginTop: 20,
            height: 180,
            borderRadius: Radius.lg,
            backgroundColor: theme.surfaceSunken,
            alignItems: 'center',
            justifyContent: 'center',
          }}>
          <Icon name="image" size={26} color={theme.textSecondary} />
        </View>

        <View style={{ marginTop: 20, gap: 10 }}>
          <Button variant="secondary" fullWidth iconLeft={<Icon name="external-link" size={18} color={theme.text} />}>
            View on Strava
          </Button>
          <Button variant="ghost" fullWidth>
            Delete session
          </Button>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
