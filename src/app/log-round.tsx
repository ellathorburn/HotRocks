import { router } from 'expo-router';
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
  RoundStrip,
  SegmentedControl,
  Sheet,
  TemperatureChips,
} from '@/components/ds';
import { NavBar } from '@/components/nav-bar';
import { Rubik, ScreenGutter, Type } from '@/constants/theme';
import { useAuth } from '@/features/auth/auth-context';
import { createSessionDraft } from '@/features/sessions/data/session-draft-repository';
import type { Round, RoundPartKind } from '@/features/sessions/domain/session';
import { useTheme } from '@/hooks/use-theme';
import { createId } from '@/lib/ids';

const CARRIED_HEAT = 90;
const CARRIED_COLD = 11;

/**
 * A heat entry can hand directly to a cold entry in the same round. A cold
 * entry finishes that round, so continuing starts the next one with heat.
 * The local-first repository will replace the route-param draft transport.
 */
export default function LogRoundScreen() {
  const theme = useTheme();
  const { user } = useAuth();
  const [rounds, setRounds] = useState<Round[]>([]);
  const [continueLastRound, setContinueLastRound] = useState(false);
  const roundNumber = continueLastRound ? rounds.length : rounds.length + 1;

  const [type, setType] = useState<RoundPartKind>('heat');
  const [mins, setMins] = useState(15);
  const [temp, setTemp] = useState(CARRIED_HEAT);
  const [lastTemps, setLastTemps] = useState<Record<RoundPartKind, number>>({ heat: CARRIED_HEAT, cold: CARRIED_COLD });
  const [expanded, setExpanded] = useState(false);
  const [rating, setRating] = useState(4);
  const [venue, setVenue] = useState('');
  const [note, setNote] = useState('');
  const [addAnotherOpen, setAddAnotherOpen] = useState(false);

  const selectType = (next: RoundPartKind) => {
    setType(next);
    setTemp(lastTemps[next]);
    setMins(next === 'cold' ? 2 : 15);
  };

  const finish = (allRounds: Round[]) => {
    if (!user) return;
    const elapsedSeconds = allRounds
      .flatMap((round) => round.parts)
      .reduce((total, part) => total + part.durationSeconds, 0);
    const draftId = createSessionDraft(user.id, {
      rounds: allRounds,
      venueName: venue.trim() || null,
      rating: rating || null,
      note: note.trim() || null,
      startedAt: new Date(Date.now() - elapsedSeconds * 1000).toISOString(),
      elapsedSeconds,
      entryMethod: 'manual',
    });
    router.replace({ pathname: '/session/summary', params: { draftId } });
  };

  const saveRound = () => {
    const part = {
      id: createId(),
      kind: type,
      durationSeconds: Math.round(mins * 60),
      temperatureCTenths: Math.round(temp * 10),
    };
    const next = continueLastRound
      ? rounds.map((round, index) => index === rounds.length - 1 ? { ...round, parts: [...round.parts, part] } : round)
      : [...rounds, { id: createId(), parts: [part] }];
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

  const loggedParts = rounds.flatMap((round) => round.parts);
  const minutesOf = (kind: RoundPartKind) => Math.round(
    loggedParts.filter((part) => part.kind === kind).reduce((total, part) => total + part.durationSeconds, 0) / 60,
  );
  const heatMinutes = minutesOf('heat');
  const coldMinutes = minutesOf('cold');
  const soFar = `${rounds.length === 1 ? 'One round' : `${rounds.length} rounds`} so far.`;
  const totalLabel = coldMinutes > 0
    ? `${soFar} ${heatMinutes} minutes in the heat, ${coldMinutes} in the cold.`
    : `${soFar} ${heatMinutes} minutes in the heat.`;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }} edges={['top']}>
      <NavBar
        title={`Round ${roundNumber}`}
        showBack
        trailing={<Badge>{roundNumber > 1 ? `This session, round ${roundNumber}` : 'New session'}</Badge>}
      />
      <ScrollView contentContainerStyle={{ paddingHorizontal: ScreenGutter, paddingBottom: 24 }}>
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

      <View style={{ paddingHorizontal: ScreenGutter, paddingTop: 8, paddingBottom: 28 }}>
        <Button size="lg" fullWidth onPress={saveRound}>
          Save round
        </Button>
      </View>

      <Sheet
        open={addAnotherOpen}
        title={`Round ${rounds.length} logged`}
        onDismiss={() => setAddAnotherOpen(false)}>
        <View>
          <Text style={{ fontFamily: Rubik.regular, fontSize: Type.body, lineHeight: Type.body * 1.5, color: theme.textSecondary, marginBottom: 18 }}>
            {totalLabel}
          </Text>
          <RoundStrip
            segments={loggedParts.map((part) => ({ type: part.kind, minutes: part.durationSeconds / 60, temp: part.temperatureCTenths === null ? null : part.temperatureCTenths / 10 }))}
            height={40}
          />
          <View style={{ flexDirection: 'row', gap: 10, marginTop: 20 }}>
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
