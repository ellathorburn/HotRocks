import { ActivityIndicator, StyleSheet } from 'react-native';

import { ThemedView } from '@/components/themed-view';

export default function AuthCallbackScreen() {
  return (
    <ThemedView style={styles.container}>
      <ActivityIndicator accessibilityLabel="Completing sign in" />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
