import { TabList, TabSlot, Tabs, TabTrigger, type TabTriggerSlotProps } from 'expo-router/ui';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Icon, type IconName, Logo } from '@/components/ds';
import { MaxContentWidth, Radius, Rubik, ScreenGutter, Space } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export default function AppTabs() {
  const theme = useTheme();

  return (
    <Tabs>
      <TabSlot style={styles.slot} />
      <TabList asChild>
        <View style={[styles.barWrap, { borderTopColor: theme.border, backgroundColor: theme.backgroundElement }]}>
          <View style={styles.bar}>
            <Logo height={24} style={styles.logo} />
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

  return (
    <Pressable
      {...props}
      style={({ pressed }) => [
        styles.tab,
        isFocused && { backgroundColor: theme.backgroundSelected },
        pressed && styles.pressed,
      ]}>
      <Icon name={icon} size={18} color={isFocused ? theme.text : theme.textSecondary} />
      <Text style={{ color: isFocused ? theme.text : theme.textSecondary, fontFamily: Rubik.medium, fontSize: 14 }}>
        {children}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  slot: { height: '100%', paddingBottom: 72 },
  barWrap: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    left: 0,
    borderTopWidth: 1,
    paddingHorizontal: ScreenGutter,
    paddingVertical: Space.s2,
  },
  bar: {
    width: '100%',
    maxWidth: MaxContentWidth,
    marginHorizontal: 'auto',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: Space.s2,
  },
  logo: { marginRight: 'auto' },
  tab: {
    minHeight: 44,
    paddingHorizontal: Space.s4,
    borderRadius: Radius.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space.s2,
  },
  pressed: { opacity: 0.72 },
});
