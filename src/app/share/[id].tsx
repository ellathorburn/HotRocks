import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button, Chip, Icon, IconButton, Logo, RoundStrip } from '@/components/ds';
import { Radius, Rubik, ScreenGutter } from '@/constants/theme';
import { findSession } from '@/features/sessions/sample-data';

/** The share card is dark-only in the design system, regardless of app theme. */
export default function ShareCardScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const session = findSession(id) ?? findSession('s1')!;
  const [story, setStory] = useState(false);
  const heat = session.segments.filter((s) => s.type === 'heat').reduce((a, s) => a + s.minutes, 0);
  const cold = session.segments.filter((s) => s.type === 'cold').reduce((a, s) => a + s.minutes, 0);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#0F0E47' }} edges={['top']}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: ScreenGutter, paddingVertical: 6 }}>
        <IconButton icon="chevron-left" label="Back" size={36} color="#F5F5DC" onPress={() => router.back()} style={{ marginLeft: -8 }} />
        <Text style={{ flex: 1, fontFamily: Rubik.semibold, fontSize: 24, color: '#F5F5DC' }}>Share</Text>
      </View>
      <View style={{ paddingHorizontal: ScreenGutter, gap: 18 }}>
        <View
          style={{
            aspectRatio: story ? 9 / 16 : 1,
            borderRadius: Radius.lg,
            backgroundColor: '#180F35',
            padding: 22,
            justifyContent: 'space-between',
          }}>
          <View>
            <Text style={{ fontFamily: Rubik.medium, fontSize: 12, letterSpacing: 0.5, textTransform: 'uppercase', color: '#8686AC' }}>
              {session.venue} · {session.date.split(',')[0]}
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 10, marginTop: 8 }}>
              <Text style={{ fontFamily: Rubik.bold, fontSize: 52, color: '#F5F5DC', fontVariant: ['tabular-nums'] }}>
                {session.totalTime}
              </Text>
              <Text style={{ fontFamily: Rubik.regular, fontSize: 16, color: '#8686AC' }}>
                {session.rounds} {session.rounds === 1 ? 'round' : 'rounds'}
              </Text>
            </View>
          </View>

          <View>
            <RoundStrip segments={session.segments} height={story ? 40 : 52} />
            <View style={{ flexDirection: 'row', gap: 14, marginTop: 16 }}>
              <View style={{ flex: 1 }}>
                <Text style={{ fontFamily: Rubik.medium, fontSize: 12, letterSpacing: 0.5, textTransform: 'uppercase', color: '#E35336' }}>Heat</Text>
                <Text style={{ fontFamily: Rubik.bold, fontSize: 24, color: '#F5F5DC' }}>
                  {heat} min <Text style={{ fontFamily: Rubik.regular, fontSize: 13, color: '#8686AC' }}>{session.peak ?? '—'}°C</Text>
                </Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontFamily: Rubik.medium, fontSize: 12, letterSpacing: 0.5, textTransform: 'uppercase', color: '#7EA8C4' }}>Cold</Text>
                <Text style={{ fontFamily: Rubik.bold, fontSize: 24, color: '#F5F5DC' }}>
                  {cold} min <Text style={{ fontFamily: Rubik.regular, fontSize: 13, color: '#8686AC' }}>{session.coldTemp}°C</Text>
                </Text>
              </View>
            </View>
          </View>

          <View style={{ alignItems: 'flex-end' }}>
            <Logo variant="dark" height={16} />
          </View>
        </View>

        <View style={{ gap: 10 }}>
          <Button size="lg" fullWidth iconLeft={<Icon name="download" size={18} color="#0F0E47" />}>
            Save to photos
          </Button>
          <Button variant="secondary" size="lg" fullWidth>
            Open the activity in Strava
          </Button>
          <View style={{ flexDirection: 'row', gap: 8, justifyContent: 'center' }}>
            <Chip size="sm" selected={!story} onPress={() => setStory(false)}>
              Square
            </Chip>
            <Chip size="sm" selected={story} onPress={() => setStory(true)}>
              9:16
            </Chip>
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
}
