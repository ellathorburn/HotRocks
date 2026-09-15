import { router } from 'expo-router';
import { Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button, Logo, StravaConnect } from '@/components/ds';
import { Dots } from '@/components/dots';
import { Rubik, ScreenGutter, Type } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export default function OnboardingConnectScreen() {
  const theme = useTheme();
  const finish = () => router.replace('/');

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }}>
      <View style={{ flex: 1, justifyContent: 'center', paddingHorizontal: ScreenGutter, gap: 20 }}>
        <Logo height={30} />
        <Text style={{ fontFamily: Rubik.bold, fontSize: 30, letterSpacing: -0.4, lineHeight: 33, color: theme.text }}>
          Put your sauna time in the same feed as your training.
        </Text>
        <Text style={{ fontFamily: Rubik.regular, fontSize: Type.body, lineHeight: Type.body * 1.5, color: theme.textSecondary }}>
          We ask for permission to write activities, so each session appears in your Strava feed as a workout. Nothing
          is read from your account.
        </Text>
        <View style={{ gap: 12, marginTop: 8 }}>
          <StravaConnect onPress={finish} />
          <Button variant="ghost" fullWidth onPress={finish}>
            Skip, log without Strava
          </Button>
        </View>
        <Dots active={2} />
      </View>
    </SafeAreaView>
  );
}
