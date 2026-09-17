import { router } from 'expo-router';
import { StyleSheet } from 'react-native';

import { Button } from '@/components/ds';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';

export default function NotFoundScreen() {
  return (
    <ThemedView style={styles.container}>
      <ThemedText type="title">Page not found</ThemedText>
      <ThemedText themeColor="textSecondary" style={styles.message}>
        This link is invalid or no longer available.
      </ThemedText>
      <Button onPress={() => router.replace('/')}>Return home</Button>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    paddingHorizontal: 24,
  },
  message: { textAlign: 'center' },
});
