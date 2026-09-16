import { router } from 'expo-router';
import { ulid } from 'ulid';
import { useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
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
import { NavBar } from '@/components/nav-bar';
import { Rubik, ScreenGutter, Type } from '@/constants/theme';
import type { Round, RoundPartKind } from '@/features/sessions/domain/session';
import { useTheme } from '@/hooks/use-theme';

const CARRIED_HEAT = 90;
const CARRIED_COLD = 11;

/**
 * A heat entry can hand directly to a cold entry in the same round. A cold
 * entry finishes that round, so continuing starts the next one with heat.
 * The local-first repository will replace the route-param draft transport.
 */
export default function LogRoundScreen() {
  const theme = useTheme();
  const [rounds, setRounds] = useState<Round[]>([]);
  const [continueLastRound, setContinueLastRound] = useState(false);
  const roundNumber = continueLastRound ? rounds.length : rounds.length + 1;

  const [type, setType] = useState<RoundPartKind>('heat');
  const [mins, setMins] = useState(15);
  const [temp, setTemp] = useState(CARRIED_HEAT);
  const [lastTemps, setLastTemps] = useState<Record<RoundPartKind, number>>({ heat: CARRIED_HEAT, cold: CARRIED_COLD });
  const [expanded, setExpanded] = useState(false);
  const [rating, setRating] = useState(4);
  const [venue, setVenue] = useState('Löyly Kallio');
  const [note, setNote] = useState('');
  const [addAnotherOpen, setAddAnotherOpen] = useState(false);

  const selectType = (next: RoundPartKind) => {
    setType(next);
    setTemp(lastTemps[next]);
    setMins(next === 'cold' ? 2 : 15);
  };

  const finish = (allRounds: Round[]) => {
    router.replace({ pathname: '/session/summary', params: { rounds: JSON.stringify(allRounds), venue } });
  };

  const saveRound = () => {
    const part = {
      id: ulid(),
      kind: type,
      durationSeconds: Math.round(mins * 60),
      temperatureCTenths: Math.round(temp * 10),
    };
    const next = continueLastRound
      ? rounds.map((round, index) => index === rounds.length - 1 ? { ...round, parts: [...round.parts, part] } : round)
      : [...rounds, { id: ulid(), parts: [part] }];
    setRounds(next);
    setLastTemps((current) => ({ ...current, [type]: temp }));
    setContinueLastRound(false);
    setAddAnotherOpen(true);
  };

  const addNext = () => {
    const continueCurrent = type === 'heat';
    setContinueLastRound(continueCurrent);
    selectType(type === 'heat' ? 'cold' : 'heat');
    setAddAnotherOpen(false);
  };

  const activeSeconds = rounds.flatMap((round) => round.parts).reduce((total, part) => total + part.durationSeconds, 0);
  const totalLabel = `${Math.floor(activeSeconds / 60)}m logged · ${rounds.length} ${rounds.length === 1 ? 'round' : 'rounds'}`;

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
          onChange={(v) => selectType(v as RoundPartKind)}
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
          <Label style={{ marginBottom: 10 }}>Temperature{rounds.length > 0 ? ' · carried forward' : ''}</Label>
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
          <Text style={{ fontFamily: Rubik.medium, fontSize: Type.body, color: theme.textSecondary, textAlign: 'center' }}>
            {totalLabel}
          </Text>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <Button
              variant="secondary"
              size="lg"
              style={{ flex: 1 }}
              iconLeft={<Icon name={type === 'heat' ? 'snowflake' : 'flame'} size={18} color={type === 'heat' ? theme.cold : theme.hot} />}
              onPress={addNext}>
              {type === 'heat' ? 'Add plunge' : 'Add round'}
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
