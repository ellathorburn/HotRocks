import { useMigrations } from 'drizzle-orm/expo-sqlite/migrator';
import { type PropsWithChildren, useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import migrations from '../../../drizzle/migrations';
import { database, initializeDatabase } from './client';
import { Rubik, Type } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export function DatabaseProvider({ children }: PropsWithChildren) {
  const theme = useTheme();
  const [ready, setReady] = useState(Boolean(database));
  const [openError, setOpenError] = useState<Error | null>(null);

  useEffect(() => {
    if (ready) return;
    void initializeDatabase()
      .then(() => setReady(true))
      .catch((error: unknown) => {
        setOpenError(error instanceof Error ? error : new Error(String(error)));
      });
  }, [ready]);

  if (openError) {
    return (
      <View style={[styles.center, { backgroundColor: theme.background }]}>
        <Text style={{ color: theme.text, fontFamily: Rubik.semibold, fontSize: Type.subheading }}>
          HotRocks could not open its local database.
        </Text>
        <Text style={{ color: theme.textSecondary, fontFamily: Rubik.regular, fontSize: Type.small }}>
          {openError.message}
        </Text>
      </View>
    );
  }

  if (!ready) {
    return (
      <View style={[styles.center, { backgroundColor: theme.background }]}>
        <ActivityIndicator color={theme.text} />
      </View>
    );
  }

  return <MigratedDatabase>{children}</MigratedDatabase>;
}

function MigratedDatabase({ children }: PropsWithChildren) {
  const theme = useTheme();
  const { success, error } = useMigrations(database, migrations);

  if (error) {
    return (
      <View style={[styles.center, { backgroundColor: theme.background }]}>
        <Text style={{ color: theme.text, fontFamily: Rubik.semibold, fontSize: Type.subheading }}>
          HotRocks could not open its local database.
        </Text>
        <Text style={{ color: theme.textSecondary, fontFamily: Rubik.regular, fontSize: Type.small }}>
          {error.message}
        </Text>
      </View>
    );
  }

  if (!success) {
    return (
      <View style={[styles.center, { backgroundColor: theme.background }]}>
        <ActivityIndicator color={theme.text} />
      </View>
    );
  }

  return children;
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    paddingHorizontal: 24,
  },
});
