import { Pressable, Text, type ViewStyle } from 'react-native';

import { Radius, Rubik } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

import { Icon } from './icon';

type StravaConnectProps = {
  onPress?: () => void;
  height?: number;
  style?: ViewStyle;
};

/**
 * Placeholder for Strava's official "Connect with Strava" button. Strava's
 * brand guidelines require their supplied asset and prohibit recreating
 * their identity, so this renders a neutral slot until that asset is added.
 */
export function StravaConnect({ onPress, height = 48, style }: StravaConnectProps) {
  const theme = useTheme();

  return (
    <Pressable
      onPress={onPress}
      style={[
        {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 10,
          height,
          paddingHorizontal: 18,
          borderRadius: Radius.md,
          borderWidth: 1,
          borderStyle: 'dashed',
          borderColor: theme.borderStrong,
        },
        style,
      ]}>
      <Icon name="link" size={18} color={theme.textSecondary} />
      <Text style={{ fontFamily: Rubik.medium, fontSize: 15, color: theme.textSecondary }}>
        Official &quot;Connect with Strava&quot; button goes here
      </Text>
    </Pressable>
  );
}
