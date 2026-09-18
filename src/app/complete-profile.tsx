import { Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Logo } from '@/components/ds';
import { Rubik, ScreenGutter, Type } from '@/constants/theme';
import { NameForm } from '@/features/profiles/components/name-form';
import { useTheme } from '@/hooks/use-theme';

/**
 * Shown once to any signed-in account without a name — typically Apple or
 * Google sign-ups that did not share one. The route guard moves on as soon as
 * the profile has a name, so no navigation is needed after saving.
 */
export default function CompleteProfileScreen() {
  const theme = useTheme();

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }}>
      <View style={{ paddingHorizontal: ScreenGutter, paddingTop: 32, paddingBottom: 24, gap: 14 }}>
        <Logo variant="mark" height={56} />
        <Text accessibilityRole="header" style={{ fontFamily: Rubik.bold, fontSize: 30, lineHeight: 33, letterSpacing: -0.6, color: theme.text }}>
          What should we call you?
        </Text>
        <Text style={{ fontFamily: Rubik.regular, fontSize: Type.body, lineHeight: Type.body * 1.5, color: theme.textSecondary }}>
          Your name appears on your profile. You can change it later in Settings.
        </Text>
      </View>
      <NameForm submitLabel="Continue" />
    </SafeAreaView>
  );
}
