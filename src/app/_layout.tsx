import {
  Rubik_400Regular,
  Rubik_500Medium,
  Rubik_600SemiBold,
  Rubik_700Bold,
  useFonts,
} from '@expo-google-fonts/rubik';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StyleSheet, useColorScheme } from 'react-native';

import { AnimatedSplashOverlay } from '@/components/animated-icon';
import { Button } from '@/components/ds';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { AuthProvider, useAuth } from '@/features/auth/auth-context';
import { signOut } from '@/features/auth/auth-service';
import { hasProfileName } from '@/features/profiles/types/profile-types';
import { DatabaseProvider } from '@/services/database/database-provider';
import { SyncProvider } from '@/services/sync/sync-provider';

SplashScreen.preventAutoHideAsync();

function RootNavigator() {
  const { error, isLoading, isPasswordRecovery, profile, retry, session } = useAuth();

  if (isLoading) return null;

  if (error) {
    return (
      <ThemedView style={styles.errorContainer}>
        <ThemedText type="subtitle">HotRocks could not load your account</ThemedText>
        <ThemedText themeColor="textSecondary" style={styles.errorText}>{error}</ThemedText>
        <Button onPress={retry}>Try again</Button>
        {session ? (
          <Button variant="ghost" onPress={() => void signOut(session.user.id).catch(() => undefined)}>Sign out</Button>
        ) : null}
        <AnimatedSplashOverlay />
      </ThemedView>
    );
  }

  const isOnboarded = Boolean(profile?.onboarding_completed_at);
  const hasName = hasProfileName(profile);
  // A reset link signs the person in; they choose a new password before anything else.
  const signedIn = Boolean(session) && !isPasswordRecovery;

  return (
    <>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Protected guard={!session}>
          <Stack.Screen name="sign-in" />
          <Stack.Screen name="sign-up" />
          <Stack.Screen name="forgot-password" />
          <Stack.Screen name="auth/callback" />
        </Stack.Protected>

        <Stack.Protected guard={Boolean(session) && isPasswordRecovery}>
          <Stack.Screen name="reset-password" />
        </Stack.Protected>

        <Stack.Protected guard={signedIn && !hasName}>
          <Stack.Screen name="complete-profile" />
        </Stack.Protected>

        <Stack.Protected guard={signedIn && hasName && !isOnboarded}>
          <Stack.Screen name="onboarding/intro" />
          <Stack.Screen name="onboarding/timeline" />
          <Stack.Screen name="onboarding/connect" />
        </Stack.Protected>

        <Stack.Protected guard={signedIn && hasName && isOnboarded}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="log-session" options={{ presentation: 'modal' }} />
          <Stack.Screen name="session/[id]" />
          <Stack.Screen name="session/summary" />
          <Stack.Screen name="venue-picker" options={{ presentation: 'modal' }} />
          <Stack.Screen name="settings" />
          <Stack.Screen name="edit-name" />
          <Stack.Screen name="share/[id]" />
        </Stack.Protected>
      </Stack>
      <AnimatedSplashOverlay />
    </>
  );
}

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const [fontsLoaded, fontError] = useFonts({
    Rubik_400Regular,
    Rubik_500Medium,
    Rubik_600SemiBold,
    Rubik_700Bold,
  });

  if (!fontsLoaded && !fontError) return null;

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <DatabaseProvider>
        <AuthProvider>
          <SyncProvider>
            <RootNavigator />
          </SyncProvider>
        </AuthProvider>
      </DatabaseProvider>
    </ThemeProvider>
  );
}

const styles = StyleSheet.create({
  errorContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    paddingHorizontal: 24,
  },
  errorText: { textAlign: 'center' },
});
