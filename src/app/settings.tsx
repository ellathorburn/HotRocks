import { useState } from 'react';
import { ScrollView, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Card, Icon, Label, ListRow, Toggle } from '@/components/ds';
import { NavBar } from '@/components/nav-bar';
import { Rubik, ScreenGutter, Type } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export default function SettingsScreen() {
  const theme = useTheme();
  const [celsius, setCelsius] = useState(true);
  const [postPublicly, setPostPublicly] = useState(true);
  const [carryTemp, setCarryTemp] = useState(true);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }} edges={['top']}>
      <NavBar title="Settings" showBack />
      <ScrollView contentContainerStyle={{ paddingHorizontal: ScreenGutter, paddingBottom: 40 }}>
        <Label style={{ marginVertical: 8 }}>Units</Label>
        <Card padded={false}>
          <ListRow
            title="Temperature"
            meta={celsius ? 'Celsius' : 'Fahrenheit'}
            trailing={<Toggle checked={celsius} onChange={setCelsius} />}
          />
        </Card>

        <Label style={{ marginTop: 20, marginBottom: 8 }}>Strava</Label>
        <Card padded={false}>
          <ListRow title="Connected" meta="ilse.k · connected March 2026" leading={<Icon name="check" size={20} color={theme.textSecondary} />} />
          <ListRow title="Default sport type" meta="Workout" chevron />
          <ListRow title="Post publicly by default" trailing={<Toggle checked={postPublicly} onChange={setPostPublicly} />} />
          <ListRow title="Description template" meta="Rounds · heat · cold · peak" chevron />
          <ListRow title="Disconnect Strava" />
        </Card>

        <Label style={{ marginTop: 20, marginBottom: 8 }}>Logging</Label>
        <Card padded={false}>
          <ListRow title="Duration presets" meta="10, 15, 20, 30 min" chevron />
          <ListRow title="Carry temperature forward" trailing={<Toggle checked={carryTemp} onChange={setCarryTemp} />} />
        </Card>

        <Text style={{ marginTop: 20, fontFamily: Rubik.regular, fontSize: Type.small, lineHeight: Type.small * 1.5, color: theme.textSecondary }}>
          Sessions logged without signal are kept on the device and pushed when you are back online.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}
