import { router } from 'expo-router';
import { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  Badge,
  Button,
  DurationStepper,
  Icon,
  Input,
  Label,
  Rating,
  SegmentedControl,
  Sheet,
  TemperatureChips,
} from '@/components/ds';
import type { RoundSegment } from '@/components/ds';
import { NavBar } from '@/components/nav-bar';
import { ScreenGutter } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

const CARRIED_HEAT = 90;
const CARRIED_COLD = 11;

/**
 * Log a round: heat or cold, duration, temperature, optional details. Saving
 * offers another round or hands off to the session summary. No local-first
 * store exists yet (docs/backend-roadmap.md), so the collected rounds travel
 * to `/session/summary` as a route param.
 */
export default function LogRoundScreen() {
  const theme = useTheme();
  const [rounds, setRounds] = useState<RoundSegment[]>([]);
  const roundNumber = rounds.length + 1;

  const [type, setType] = useState<'heat' | 'cold'>(roundNumber > 1 ? 'cold' : 'heat');
  const [mins, setMins] = useState(roundNumber > 1 ? 2 : 15);
  const [temp, setTemp] = useState(roundNumber > 1 ? CARRIED_COLD : CARRIED_HEAT);
  const [expanded, setExpanded] = useState(false);
  const [rating, setRating] = useState(4);
  const [venue, setVenue] = useState('Löyly Kallio');
  const [note, setNote] = useState('');
  const [addAnotherOpen, setAddAnotherOpen] = useState(false);

  const selectType = (next: 'heat' | 'cold') => {
    setType(next);
    setTemp(next === 'cold' ? CARRIED_COLD : CARRIED_HEAT);
    setMins(next === 'cold' ? 2 : 15);
  };

  const finish = (allRounds: RoundSegment[]) => {
    router.replace({ pathname: '/session/summary', params: { rounds: JSON.stringify(allRounds), venue } });
  };

  const saveRound = () => {
    const next = [...rounds, { type, minutes: mins, temp }];
    setRounds(next);
    setAddAnotherOpen(true);
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }} edges={['top']}>
      <NavBar
        title={`Round ${roundNumber}`}
        showBack
        trailing={<Badge>{roundNumber > 1 ? `This session, round ${roundNumber}` : 'New session'}</Badge>}
      />
      <ScrollView contentContainerStyle={{ paddingHorizontal: ScreenGutter, paddingBottom: 96 }}>
        <SegmentedControl
          value={type}
          onChange={(v) => selectType(v as 'heat' | 'cold')}
          options={[
            { value: 'heat', label: 'Sauna', icon: 'flame', tone: 'hot' },
            { value: 'cold', label: 'Plunge', icon: 'snowflake', tone: 'cold' },
          ]}
        />

        <View style={{ marginTop: 28 }}>
          <Label style={{ textAlign: 'center', marginBottom: 14 }}>Duration</Label>
          <DurationStepper value={mins} onChange={setMins} unit="min" presets={type === 'cold' ? [1, 2, 3, 5] : [10, 15, 20, 30]} />
        </View>

        <View style={{ marginTop: 28 }}>
          <Label style={{ marginBottom: 10 }}>Temperature{roundNumber > 1 ? ' · carried forward' : ''}</Label>
          <TemperatureChips type={type} value={temp} onChange={setTemp} />
        </View>

        {expanded ? (
          <View style={{ marginTop: 28, gap: 18 }}>
            <View>
              <Label style={{ marginBottom: 8 }}>Venue</Label>
              <Input value={venue} onChangeText={setVenue} leading={<Icon name="map-pin" size={18} color={theme.textSecondary} />} />
            </View>
            <View>
              <Label style={{ marginBottom: 8 }}>Rating</Label>
              <Rating value={rating} onChange={setRating} />
            </View>
            <View>
              <Label style={{ marginBottom: 8 }}>Note</Label>
              <Input multiline value={note} onChangeText={setNote} />
            </View>
          </View>
        ) : (
          <Button
            variant="ghost"
            fullWidth
            style={{ marginTop: 28 }}
            onPress={() => setExpanded(true)}
            iconLeft={<Icon name="chevron-down" size={18} color={theme.textSecondary} />}>
            Add details
          </Button>
        )}
      </ScrollView>

      <View style={{ paddingHorizontal: ScreenGutter, paddingVertical: 8, paddingBottom: 28 }}>
        <Button size="lg" fullWidth onPress={saveRound}>
          Save round
        </Button>
      </View>

      <Sheet
        open={addAnotherOpen}
        title={`Round ${rounds.length} logged`}
        onDismiss={() => setAddAnotherOpen(false)}>
        <View style={{ gap: 20 }}>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <Button
              variant="secondary"
              size="lg"
              style={{ flex: 1 }}
              iconLeft={<Icon name="snowflake" size={18} color={theme.cold} />}
              onPress={() => setAddAnotherOpen(false)}>
              Another round
            </Button>
            <Button variant="secondary" size="lg" style={{ flex: 1 }} onPress={() => finish(rounds)}>
              Finish
            </Button>
          </View>
        </View>
      </Sheet>
    </SafeAreaView>
  );
}
