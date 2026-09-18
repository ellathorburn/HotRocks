import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { FlatList, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button, Icon, Input, Label, ListRow } from '@/components/ds';
import { NavBar } from '@/components/nav-bar';
import { ScreenGutter } from '@/constants/theme';
import { useDisplayPreferences } from '@/features/profiles/hooks/use-display-preferences';
import { useSessionTimelineDraft } from '@/features/sessions/hooks/use-session-timeline-draft';
import { useVenues } from '@/features/sessions/hooks/use-venues';
import { sessionTimelineDraftService } from '@/features/sessions/services/session-draft-service';
import { useTheme } from '@/hooks/use-theme';
import { singleRouteParam } from '@/lib/route-params';

export default function VenuePickerScreen() {
  const theme = useTheme();
  const preferences = useDisplayPreferences();
  const params = useLocalSearchParams<{ draftId?: string | string[] }>();
  const draftId = singleRouteParam(params.draftId);
  const [query, setQuery] = useState('');
  const { draft } = useSessionTimelineDraft(draftId ?? '', preferences);
  const savedVenues = useVenues(preferences);
  const venues = savedVenues.filter((venue) => venue.name.toLowerCase().includes(query.trim().toLowerCase()));
  const exactMatch = savedVenues.some((venue) => venue.name.toLowerCase() === query.trim().toLowerCase());

  const selectVenue = (venue: string) => {
    if (!draftId || !preferences.userId) return;
    sessionTimelineDraftService.setVenue(draftId, preferences.userId, venue);
    router.dismissTo({ pathname: '/session/summary', params: { draftId } });
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }} edges={['top']}>
      <NavBar title="Venue" showBack />
      <View style={{ paddingHorizontal: ScreenGutter, gap: 18, flex: 1 }}>
        <Input value={query} onChangeText={setQuery} placeholder="Search or add a venue" leading={<Icon name="search" size={18} color={theme.textSecondary} />} />
        <View style={{ gap: 8, flex: 1 }}>
          <Label>Recent</Label>
          <FlatList
            data={venues}
            keyboardShouldPersistTaps="handled"
            keyExtractor={(venue) => venue.id}
            renderItem={({ item }) => (
              <ListRow
                title={item.name}
                meta={item.meta}
                selected={item.name === draft?.venueName}
                leading={(
                  <Icon
                    name={item.coldOnly ? 'snowflake' : 'map-pin'}
                    size={20}
                    color={item.coldOnly ? theme.cold : theme.textSecondary}
                  />
                )}
                onPress={() => selectVenue(item.name)}
              />
            )}
          />
        </View>
        {query.trim() && !exactMatch ? (
          <Button variant="secondary" fullWidth iconLeft={<Icon name="plus" size={18} color={theme.text} />} style={{ marginBottom: 18 }} onPress={() => selectVenue(query.trim())}>
            Add “{query.trim()}”
          </Button>
        ) : null}
      </View>
    </SafeAreaView>
  );
}
