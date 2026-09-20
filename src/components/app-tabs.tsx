import { TabList, TabSlot, Tabs, TabTrigger, type TabTriggerSlotProps } from 'expo-router/ui';
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon, type IconName } from '@/components/ds';
import { MaxContentWidth, Rubik } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/**
 * Sessions / Timer / You on every platform. The bar sits in the layout below
 * the screen rather than floating over it, so no content or button can end up
 * underneath. Ember is not used here — the tab bar is never the action.
 */
export default function AppTabs() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();

  return (
    <Tabs style={styles.root}>
      <TabSlot style={styles.slot} />
      {/* Tabs only finds triggers that are direct children of the TabList's
          child, so the width cap is side padding rather than an inner View. */}
      <TabList asChild>
        <View
          // asChild merges props through expo-router's Slot, which rejects style arrays.
          style={StyleSheet.flatten([
            styles.bar,
            {
              borderTopColor: theme.border,
              backgroundColor: theme.background,
              paddingBottom: insets.bottom,
              paddingHorizontal: Math.max(0, (width - MaxContentWidth) / 2),
            },
          ])}>
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
      </TabList>
    </Tabs>
  );
}

function TabButton({ children, icon, isFocused, ...props }: TabTriggerSlotProps & { icon: IconName }) {
  const theme = useTheme();
  const color = isFocused ? theme.text : theme.textSecondary;

  return (
    <Pressable
      {...props}
      accessibilityRole="tab"
      accessibilityState={{ selected: Boolean(isFocused) }}
      style={({ pressed }) => [styles.tab, pressed && styles.pressed]}>
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
  root: { flex: 1 },
  slot: { flex: 1 },
  bar: { borderTopWidth: 1, flexDirection: 'row' },
  tab: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
    paddingTop: 10,
    paddingBottom: 8,
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
