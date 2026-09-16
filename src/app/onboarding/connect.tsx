import { router } from 'expo-router';
import { useState } from 'react';
import { Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button, Logo, StravaConnect } from '@/components/ds';
import { Dots } from '@/components/dots';
import { Rubik, ScreenGutter, Type } from '@/constants/theme';
import { useAuth } from '@/features/auth/auth-context';
import { useTheme } from '@/hooks/use-theme';

export default function OnboardingConnectScreen() {
  const theme = useTheme();
  const { completeOnboarding } = useAuth();
  const [isFinishing, setIsFinishing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const finish = async () => {
    setErrorMessage(null);
    setIsFinishing(true);
    try {
      await completeOnboarding();
      router.replace('/');
    } catch {
      setErrorMessage('Could not finish setup. Try again.');
      setIsFinishing(false);
    }
  };

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
          <StravaConnect onPress={() => void finish()} />
          <Button variant="ghost" fullWidth loading={isFinishing} onPress={() => void finish()}>
            Skip, log without Strava
          </Button>
          {errorMessage ? (
            <Text style={{ fontFamily: Rubik.medium, fontSize: Type.small, color: theme.cedar, textAlign: 'center' }}>
              {errorMessage}
            </Text>
          ) : null}
        </View>
        <Dots active={2} />
      </View>
    </SafeAreaView>
  );
}
