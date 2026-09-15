import { NativeTabs } from 'expo-router/unstable-native-tabs';
import { useColorScheme } from 'react-native';

import { Colors, Rubik } from '@/constants/theme';

/** Sessions / Timer / You — the design system's TabBar, mapped to NativeTabs. */
export default function AppTabs() {
  const scheme = useColorScheme();
  const colors = Colors[scheme === 'unspecified' ? 'light' : (scheme ?? 'light')];

  return (
    <NativeTabs
      backgroundColor={colors.background}
      indicatorColor={colors.backgroundSelected}
      iconColor={{ default: colors.textSecondary, selected: colors.text }}
      labelStyle={{
        default: { fontFamily: Rubik.medium, color: colors.textSecondary },
        selected: { fontFamily: Rubik.semibold, color: colors.text },
      }}>
      <NativeTabs.Trigger name="index">
        <NativeTabs.Trigger.Label>Sessions</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="list.bullet" src={require('@/assets/images/tabIcons/list.png')} renderingMode="template" />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="timer">
        <NativeTabs.Trigger.Label>Timer</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="timer" src={require('@/assets/images/tabIcons/timer.png')} renderingMode="template" />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="profile">
        <NativeTabs.Trigger.Label>You</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="person.fill" src={require('@/assets/images/tabIcons/person.png')} renderingMode="template" />
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
