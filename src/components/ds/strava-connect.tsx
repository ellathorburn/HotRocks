import { ActivityIndicator, Pressable, Text, View, type ViewStyle } from 'react-native';

import { Radius, Rubik } from '@/constants/theme';

import { Icon } from './icon';

/**
 * Strava's brand orange. Their guidelines require their supplied
 * "Connect with Strava" asset before public release; this is the app's own
 * button in their colour, not a copy of that asset. Swap in the official
 * artwork as part of store submission.
 */
const STRAVA_ORANGE = '#FC4C02';
const STRAVA_ORANGE_PRESSED = '#E04502';

type StravaConnectProps = {
  onPress?: () => void;
  loading?: boolean;
  disabled?: boolean;
  height?: number;
  style?: ViewStyle;
};

export function StravaConnect({
  onPress,
  loading = false,
  disabled = false,
  height = 48,
  style,
}: StravaConnectProps) {
  const isInactive = disabled || loading;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Connect with Strava"
      accessibilityState={{ disabled: isInactive, busy: loading }}
      disabled={isInactive}
      onPress={onPress}
      style={({ pressed }) => [
        {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 10,
          height,
          paddingHorizontal: 18,
          borderRadius: Radius.md,
          backgroundColor: pressed ? STRAVA_ORANGE_PRESSED : STRAVA_ORANGE,
          opacity: isInactive ? 0.6 : 1,
        },
        style,
      ]}>
      {loading ? (
        <ActivityIndicator color="#FFFFFF" />
      ) : (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <Icon name="link" size={18} color="#FFFFFF" />
          <Text style={{ fontFamily: Rubik.semibold, fontSize: 16, color: '#FFFFFF' }}>
            Connect with Strava
          </Text>
        </View>
      )}
    </Pressable>
  );
}
