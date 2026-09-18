import { router } from 'expo-router';
import { Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button, Icon, TimelineStrip, intervalMeta } from '@/components/ds';
import { Dots } from '@/components/dots';
import { Rubik, ScreenGutter, Type } from '@/constants/theme';
import { useDisplayPreferences } from '@/features/profiles/hooks/use-display-preferences';
import type { SessionIntervalKind } from '@/features/sessions/types/session-types';
import { useTheme } from '@/hooks/use-theme';
import { formatTemperature, INTERVAL_LABELS } from '@/lib/format';

/** An illustration of the timeline model, shown before any session exists. */
const EXAMPLE = [
  { kind: 'heat' as const, durationSeconds: 900, temperatureCTenths: 900 },
  { kind: 'rest' as const, durationSeconds: 480, temperatureCTenths: null },
  { kind: 'heat' as const, durationSeconds: 720, temperatureCTenths: 880 },
  { kind: 'cold' as const, durationSeconds: 120, temperatureCTenths: 110 },
];

const LEGEND: SessionIntervalKind[] = ['heat', 'rest', 'cold'];

export default function OnboardingTimelineScreen() {
  const theme = useTheme();
  const { temperatureUnit } = useDisplayPreferences();
  const segments = EXAMPLE.map(({ temperatureCTenths, ...segment }) => ({
    ...segment,
    temperature: temperatureCTenths === null ? null : formatTemperature(temperatureCTenths, temperatureUnit),
  }));

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }}>
      <View style={{ flex: 1, justifyContent: 'center', paddingHorizontal: ScreenGutter, gap: 22 }}>
        <Text style={{ fontFamily: Rubik.bold, fontSize: 26, letterSpacing: -0.4, lineHeight: 32, color: theme.text }}>
          Log it in whatever order it happened.
        </Text>
        <TimelineStrip segments={segments} height={72} />
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 4 }}>
          {LEGEND.map((kind) => {
            const meta = intervalMeta(kind, theme);
            return (
              <View key={kind} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Icon name={meta.icon} size={18} color={meta.fill} />
                <Text style={{ fontFamily: Rubik.regular, fontSize: 15, color: theme.textSecondary }}>
                  {INTERVAL_LABELS[kind]}
                </Text>
              </View>
            );
          })}
        </View>
        <Text style={{ fontFamily: Rubik.regular, fontSize: Type.body, lineHeight: Type.body * 1.5, color: theme.textSecondary }}>
          Sauna, cold plunge, break — log each one as it happens. Repeat one, skip another, take a break whenever you
          need it.
        </Text>
      </View>
      <View style={{ paddingHorizontal: ScreenGutter, paddingBottom: 40, gap: 24, alignItems: 'center' }}>
        <Button size="lg" fullWidth onPress={() => router.push('/onboarding/connect')}>
          Continue
        </Button>
        <Dots active={1} />
      </View>
    </SafeAreaView>
  );
}
