import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { NavBar } from '@/components/nav-bar';
import { NameForm } from '@/features/profiles/components/name-form';
import { useTheme } from '@/hooks/use-theme';

export default function EditNameScreen() {
  const theme = useTheme();

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }} edges={['top']}>
      <NavBar title="Your name" showBack />
      <NameForm submitLabel="Save" onSaved={() => router.back()} />
    </SafeAreaView>
  );
}
