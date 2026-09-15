import { router } from 'expo-router';
import { Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button, Icon, RoundStrip } from '@/components/ds';
import { Dots } from '@/components/dots';
import { Rubik, ScreenGutter, Type } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export default function OnboardingRoundScreen() {
  const theme = useTheme();

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }}>
      <View style={{ flex: 1, justifyContent: 'center', paddingHorizontal: ScreenGutter, gap: 22 }}>
        <Text style={{ fontFamily: Rubik.bold, fontSize: 26, letterSpacing: -0.4, lineHeight: 32, color: theme.text }}>
          A round is a hot block and a cold block.
        </Text>
        <RoundStrip
          segments={[
            { type: 'heat', minutes: 15, temp: 92 },
            { type: 'cold', minutes: 2, temp: 11 },
          ]}
          height={72}
        />
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 4 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Icon name="flame" size={18} color={theme.hot} />
            <Text style={{ fontFamily: Rubik.regular, fontSize: 15, color: theme.textSecondary }}>Sit in the heat</Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Icon name="snowflake" size={18} color={theme.cold} />
            <Text style={{ fontFamily: Rubik.regular, fontSize: 15, color: theme.textSecondary }}>Then the cold</Text>
          </View>
        </View>
        <Text style={{ fontFamily: Rubik.regular, fontSize: Type.body, lineHeight: Type.body * 1.5, color: theme.textSecondary }}>
          A typical visit is three or four rounds. Log as many as you do — each one lands in the same session.
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
