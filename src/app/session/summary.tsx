import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button, Icon, Input, Label, ListRow, Rating, RoundStrip } from '@/components/ds';
import type { RoundSegment } from '@/components/ds';
import { NavBar } from '@/components/nav-bar';
import { Rubik, ScreenGutter } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

function totalMinutes(segments: RoundSegment[]) {
  const total = segments.reduce((sum, s) => sum + s.minutes, 0);
  const h = Math.floor(total / 60);
  const m = Math.round(total % 60);
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:00` : `${m}:00`;
}

export default function SessionSummaryScreen() {
  const theme = useTheme();
  const params = useLocalSearchParams<{ rounds?: string; venue?: string }>();
  const segments = useMemo<RoundSegment[]>(() => {
    try {
      return params.rounds ? JSON.parse(params.rounds) : [];
    } catch {
      return [];
    }
  }, [params.rounds]);
  const heatRounds = segments.filter((s) => s.type === 'heat');
  const [open, setOpen] = useState(false);
  const [rating, setRating] = useState(4);
  const [note, setNote] = useState('');

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }} edges={['top']}>
      <NavBar title="Session" showBack />
      <ScrollView contentContainerStyle={{ paddingHorizontal: ScreenGutter, paddingBottom: 96 }}>
        <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 10 }}>
          <Text style={{ fontFamily: Rubik.bold, fontSize: 56, color: theme.text, fontVariant: ['tabular-nums'] }}>
            {totalMinutes(segments)}
          </Text>
          <Text style={{ fontFamily: Rubik.medium, fontSize: 18, color: theme.textSecondary }}>
            {segments.length} {segments.length === 1 ? 'round' : 'rounds'}
          </Text>
        </View>

        <View style={{ marginTop: 16 }}>
          <RoundStrip segments={segments} height={48} />
        </View>

        <View style={{ marginTop: 20, gap: 2 }}>
          {heatRounds.map((s, i) => (
            <ListRow
              key={i}
              title={`Round ${i + 1}`}
              meta={`${s.minutes} min at ${s.temp}°`}
              leading={<Icon name="flame" size={20} color={theme.hot} />}
              chevron
            />
          ))}
        </View>

        <View style={{ marginTop: 20 }}>
          <Label style={{ marginBottom: 8 }}>Venue</Label>
          <ListRow
            title={params.venue ?? 'Löyly Kallio'}
            meta="Same as last time"
            leading={<Icon name="map-pin" size={20} color={theme.textSecondary} />}
            chevron
            onPress={() => router.push('/venue-picker')}
            style={{ backgroundColor: theme.card }}
          />
        </View>

        <View style={{ marginTop: 16 }}>
          {open ? (
            <View style={{ gap: 16 }}>
              <View>
                <Label style={{ marginBottom: 8 }}>Rating</Label>
                <Rating value={rating} onChange={setRating} />
              </View>
              <View>
                <Label style={{ marginBottom: 8 }}>Note</Label>
                <Input multiline value={note} onChangeText={setNote} placeholder="How did it go?" />
              </View>
            </View>
          ) : (
            <Button
              variant="ghost"
              fullWidth
              onPress={() => setOpen(true)}
              iconLeft={<Icon name="chevron-down" size={18} color={theme.textSecondary} />}>
              Add rating, note and photos
            </Button>
          )}
        </View>
      </ScrollView>

      <View style={{ paddingHorizontal: ScreenGutter, paddingVertical: 8, paddingBottom: 28 }}>
        <Button size="lg" fullWidth onPress={() => router.replace('/')}>
          Save session
        </Button>
      </View>
    </SafeAreaView>
  );
}
