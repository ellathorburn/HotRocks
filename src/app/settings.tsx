import { useState } from 'react';
import { Alert, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button, Card, Label, ListRow, Toggle } from '@/components/ds';
import { NavBar } from '@/components/nav-bar';
import { Rubik, ScreenGutter, Type } from '@/constants/theme';
import { useAuth } from '@/features/auth/auth-context';
import { deleteAccount, signOut } from '@/features/auth/auth-service';
import { useTheme } from '@/hooks/use-theme';

export default function SettingsScreen() {
  const theme = useTheme();
  const { profile, updateProfile, user } = useAuth();
  const [isUpdating, setIsUpdating] = useState(false);
  const [accountError, setAccountError] = useState<string | null>(null);

  const runAccountAction = async (action: () => Promise<void>) => {
    setAccountError(null);
    setIsUpdating(true);
    try {
      await action();
    } catch (error) {
      setAccountError(error instanceof Error ? error.message : 'The account action could not be completed.');
    } finally {
      setIsUpdating(false);
    }
  };

  const setTemperatureUnit = (celsius: boolean) => {
    void runAccountAction(() => updateProfile({ temperature_unit: celsius ? 'celsius' : 'fahrenheit' }));
  };

  const confirmDeleteAccount = () => {
    if (!user) return;
    Alert.alert(
      'Delete your account?',
      'This permanently removes your HotRocks account, cloud data, and data stored on this device.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete account',
          style: 'destructive',
          onPress: () => void runAccountAction(() => deleteAccount(user.id)),
        },
      ],
    );
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }} edges={['top']}>
      <NavBar title="Settings" showBack />
      <ScrollView contentContainerStyle={{ paddingHorizontal: ScreenGutter, paddingBottom: 40 }}>
        <Label style={{ marginVertical: 8 }}>Units</Label>
        <Card padded={false}>
          <ListRow
            title="Temperature"
            meta={profile?.temperature_unit === 'fahrenheit' ? 'Fahrenheit' : 'Celsius'}
            trailing={(
              <Toggle
                checked={profile?.temperature_unit !== 'fahrenheit'}
                onChange={setTemperatureUnit}
              />
            )}
          />
        </Card>

        <Label style={{ marginTop: 20, marginBottom: 8 }}>Strava</Label>
        <Card padded={false}>
          <ListRow title="Not connected" meta="Strava connection is coming in a later release." />
        </Card>

        <Text style={{ marginTop: 20, fontFamily: Rubik.regular, fontSize: Type.small, lineHeight: Type.small * 1.5, color: theme.textSecondary }}>
          Sessions logged without signal are kept on the device and pushed when you are back online.
        </Text>

        <Label style={{ marginTop: 28, marginBottom: 8 }}>Account</Label>
        <View style={{ gap: 8 }}>
          <Button
            variant="secondary"
            fullWidth
            disabled={isUpdating || !user}
            onPress={() => user && void runAccountAction(() => signOut(user.id))}>
            Sign out
          </Button>
          <Button
            variant="ghost"
            fullWidth
            disabled={isUpdating || !user}
            onPress={confirmDeleteAccount}>
            Delete account
          </Button>
          {accountError ? (
            <Text style={{ fontFamily: Rubik.medium, fontSize: Type.small, color: theme.cedar, textAlign: 'center' }}>
              {accountError}
            </Text>
          ) : null}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
