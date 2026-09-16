import { and, asc, desc, eq, isNull } from 'drizzle-orm';
import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { FlatList, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button, Icon, Input, Label, ListRow } from '@/components/ds';
import { NavBar } from '@/components/nav-bar';
import { ScreenGutter } from '@/constants/theme';
import { useAuth } from '@/features/auth/auth-context';
import { useTheme } from '@/hooks/use-theme';
import { database } from '@/services/database/client';
import { venues as venueTable } from '@/services/database/schema';

export default function VenuePickerScreen() {
  const theme = useTheme();
  const { user } = useAuth();
  const params = useLocalSearchParams<{
    rounds?: string;
    venue?: string;
    startedAt?: string;
    elapsedSeconds?: string;
    entryMethod?: 'manual' | 'timer' | 'repeat';
  }>();
  const [query, setQuery] = useState('');
  const userId = user?.id ?? '';
  const { data: savedVenues = [] } = useLiveQuery(
    database.select({ id: venueTable.id, name: venueTable.name, lastUsedAt: venueTable.lastUsedAt })
      .from(venueTable)
      .where(and(eq(venueTable.userId, userId), isNull(venueTable.deletedAt)))
      .orderBy(desc(venueTable.lastUsedAt), asc(venueTable.name)),
    [userId],
  );
  const venues = savedVenues.filter((venue) => venue.name.toLowerCase().includes(query.trim().toLowerCase()));
  const exactMatch = savedVenues.some((venue) => venue.name.toLowerCase() === query.trim().toLowerCase());

  const selectVenue = (venue: string) => {
    router.dismissTo({
      pathname: '/session/summary',
      params: {
        rounds: params.rounds,
        venue,
        startedAt: params.startedAt,
        elapsedSeconds: params.elapsedSeconds,
        entryMethod: params.entryMethod,
      },
    });
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }} edges={['top']}>
      <NavBar title="Venue" showBack />
      <View style={{ paddingHorizontal: ScreenGutter, gap: 18, flex: 1 }}>
        <Input
          value={query}
          onChangeText={setQuery}
          placeholder="Search or add a venue"
          leading={<Icon name="search" size={18} color={theme.textSecondary} />}
        />
        <View style={{ gap: 8, flex: 1 }}>
          <Label>Recent</Label>
          <FlatList
            data={venues}
            keyboardShouldPersistTaps="handled"
            keyExtractor={(venue) => venue.id}
            renderItem={({ item }) => (
              <ListRow
                title={item.name}
                meta={item.lastUsedAt
                  ? `Last used ${new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(new Date(item.lastUsedAt))}`
                  : 'Saved venue'}
                selected={item.name === params.venue}
                leading={<Icon name="map-pin" size={20} color={theme.textSecondary} />}
                onPress={() => selectVenue(item.name)}
              />
            )}
          />
        </View>
        {query.trim() && !exactMatch ? (
          <Button
            variant="secondary"
            fullWidth
            iconLeft={<Icon name="plus" size={18} color={theme.text} />}
            style={{ marginBottom: 18 }}
            onPress={() => selectVenue(query.trim())}>
            Add “{query.trim()}”
          </Button>
        ) : null}
      </View>
    </SafeAreaView>
  );
}
