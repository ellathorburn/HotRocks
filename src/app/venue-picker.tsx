import { useQuery } from '@powersync/react';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { FlatList, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button, Icon, Input, Label, ListRow } from '@/components/ds';
import { NavBar } from '@/components/nav-bar';
import { ScreenGutter } from '@/constants/theme';
import { useAuth } from '@/features/auth/auth-context';
import { useTheme } from '@/hooks/use-theme';

type VenueRow = { id: string; name: string; last_used_at: string | null };

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
  const { data: savedVenues } = useQuery<VenueRow>(
    `SELECT id, name, last_used_at FROM venues
     WHERE user_id = ? AND deleted_at IS NULL
     ORDER BY last_used_at DESC, name ASC`,
    [user?.id ?? ''],
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
                meta={item.last_used_at
                  ? `Last used ${new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(new Date(item.last_used_at))}`
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
