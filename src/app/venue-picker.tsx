import { router } from 'expo-router';
import { useState } from 'react';
import { FlatList, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button, Icon, Input, Label, ListRow } from '@/components/ds';
import { NavBar } from '@/components/nav-bar';
import { ScreenGutter } from '@/constants/theme';
import { VENUES } from '@/features/sessions/sample-data';
import { useTheme } from '@/hooks/use-theme';

export default function VenuePickerScreen() {
  const theme = useTheme();
  const [query, setQuery] = useState('');
  const venues = VENUES.filter((v) => v.name.toLowerCase().includes(query.toLowerCase()));

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
            keyExtractor={(v) => v.name}
            renderItem={({ item, index }) => (
              <ListRow
                title={item.name}
                meta={item.meta}
                selected={index === 0}
                leading={<Icon name={item.meta.includes('Cold only') ? 'snowflake' : 'map-pin'} size={20} color={item.meta.includes('Cold only') ? theme.cold : theme.textSecondary} />}
                onPress={() => router.back()}
              />
            )}
          />
        </View>
        <Button variant="secondary" fullWidth iconLeft={<Icon name="plus" size={18} color={theme.text} />} style={{ marginBottom: 18 }}>
          Add a new venue
        </Button>
      </View>
    </SafeAreaView>
  );
}
