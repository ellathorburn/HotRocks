import {
  Rubik_400Regular,
  Rubik_500Medium,
  Rubik_600SemiBold,
  Rubik_700Bold,
  useFonts,
} from '@expo-google-fonts/rubik';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import { PowerSyncContext } from '@powersync/react';
import * as SplashScreen from 'expo-splash-screen';
import { useColorScheme } from 'react-native';

import { AnimatedSplashOverlay } from '@/components/animated-icon';
import { AuthProvider, useAuth } from '@/features/auth/auth-context';
import { powerSync } from '@/services/powersync/system';

SplashScreen.preventAutoHideAsync();

function RootNavigator() {
  const { isLoading, profile, session } = useAuth();

  if (isLoading) return null;

  if (!session) {
    return (
      <>
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="sign-in" />
        </Stack>
        <AnimatedSplashOverlay />
      </>
    );
  }

  if (!profile?.onboarding_completed_at) {
    return (
      <>
        <Stack initialRouteName="onboarding/intro" screenOptions={{ headerShown: false }}>
          <Stack.Screen name="onboarding/intro" />
          <Stack.Screen name="onboarding/round" />
          <Stack.Screen name="onboarding/connect" />
        </Stack>
        <AnimatedSplashOverlay />
      </>
    );
  }

  return (
    <>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="log-round" options={{ presentation: 'modal' }} />
        <Stack.Screen name="session/[id]" />
        <Stack.Screen name="session/summary" />
        <Stack.Screen name="venue-picker" options={{ presentation: 'modal' }} />
        <Stack.Screen name="settings" />
        <Stack.Screen name="share/[id]" />
      </Stack>
      <AnimatedSplashOverlay />
    </>
  );
}

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const [fontsLoaded] = useFonts({
    Rubik_400Regular,
    Rubik_500Medium,
    Rubik_600SemiBold,
    Rubik_700Bold,
  });

  if (!fontsLoaded) return null;

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <PowerSyncContext.Provider value={powerSync}>
        <AuthProvider>
          <RootNavigator />
        </AuthProvider>
      </PowerSyncContext.Provider>
    </ThemeProvider>
  );
}
