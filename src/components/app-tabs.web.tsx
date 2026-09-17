import { TabList, TabSlot, Tabs, TabTrigger, type TabTriggerSlotProps } from 'expo-router/ui';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Icon, type IconName } from '@/components/ds';
import { MaxContentWidth, Rubik } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

const TAB_BAR_HEIGHT = 72;

/** Sessions / Timer / You. Ember is not used here — the tab bar is never the action. */
export default function AppTabs() {
  const theme = useTheme();

  return (
    <Tabs>
      <TabSlot style={styles.slot} />
      <TabList asChild>
        <View style={[styles.barWrap, { borderTopColor: theme.border, backgroundColor: theme.background }]}>
          <View style={styles.bar}>
            <TabTrigger name="sessions" href="/" asChild>
              <TabButton icon="list">Sessions</TabButton>
            </TabTrigger>
            <TabTrigger name="timer" href="/timer" asChild>
              <TabButton icon="timer">Timer</TabButton>
            </TabTrigger>
            <TabTrigger name="profile" href="/profile" asChild>
              <TabButton icon="user">You</TabButton>
            </TabTrigger>
          </View>
        </View>
      </TabList>
    </Tabs>
  );
}

function TabButton({ children, icon, isFocused, ...props }: TabTriggerSlotProps & { icon: IconName }) {
  const theme = useTheme();
  const color = isFocused ? theme.text : theme.textSecondary;

  return (
    <Pressable {...props} style={({ pressed }) => [styles.tab, pressed && styles.pressed]}>
      <View style={[styles.indicator, { backgroundColor: isFocused ? theme.text : 'transparent' }]} />
      <View style={[styles.iconWell, { backgroundColor: isFocused ? theme.surfaceSunken : 'transparent' }]}>
        <Icon name={icon} size={22} color={color} />
      </View>
      <Text style={{ color, fontFamily: isFocused ? Rubik.semibold : Rubik.medium, fontSize: 11, lineHeight: 13, letterSpacing: 0.22 }}>
        {children}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  slot: { height: '100%', paddingBottom: TAB_BAR_HEIGHT },
  barWrap: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    left: 0,
    borderTopWidth: 1,
  },
  bar: {
    width: '100%',
    maxWidth: MaxContentWidth,
    marginHorizontal: 'auto',
    flexDirection: 'row',
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
    paddingTop: 10,
    paddingBottom: 12,
  },
  indicator: {
    position: 'absolute',
    top: -1,
    width: 28,
    height: 3,
    borderBottomLeftRadius: 3,
    borderBottomRightRadius: 3,
  },
  iconWell: {
    width: 46,
    height: 30,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: { transform: [{ scale: 0.98 }] },
});
