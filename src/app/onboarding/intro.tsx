import { router } from 'expo-router';
import { Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button, Logo } from '@/components/ds';
import { Dots } from '@/components/dots';
import { Rubik, ScreenGutter } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export default function OnboardingIntroScreen() {
  const theme = useTheme();

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }}>
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 22, paddingHorizontal: 40 }}>
        <Logo variant="mark" height={96} />
        <Text
          style={{
            fontFamily: Rubik.bold,
            fontSize: 30,
            letterSpacing: -0.4,
            lineHeight: 34,
            textAlign: 'center',
            maxWidth: 300,
            color: theme.text,
          }}>
          Log your sauna and cold plunge, minute by minute.
        </Text>
      </View>
      <View style={{ paddingHorizontal: ScreenGutter, paddingBottom: 40, gap: 24, alignItems: 'center' }}>
        <Button size="lg" fullWidth onPress={() => router.push('/onboarding/round')}>
          Continue
        </Button>
        <Dots active={0} />
      </View>
    </SafeAreaView>
  );
}
