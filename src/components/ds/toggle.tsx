import { useEffect, useState } from 'react';
import { Animated, Pressable, type ViewStyle } from 'react-native';

import { Motion, Radius } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type ToggleProps = {
  checked?: boolean;
  onChange?: (checked: boolean) => void;
  style?: ViewStyle;
};

/** Settings toggle. Track takes ember when on. */
export function Toggle({ checked = false, onChange, style }: ToggleProps) {
  const theme = useTheme();
  const [anim] = useState(() => new Animated.Value(checked ? 1 : 0));

  useEffect(() => {
    Animated.timing(anim, { toValue: checked ? 1 : 0, duration: Motion.base, useNativeDriver: false }).start();
  }, [checked, anim]);

  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityState={{ checked }}
      onPress={() => onChange?.(!checked)}
      style={[
        {
          width: 52,
          height: 32,
          padding: 3,
          borderRadius: Radius.full,
          backgroundColor: checked ? theme.accent : theme.borderStrong,
          justifyContent: 'center',
        },
        style,
      ]}>
      <Animated.View
        style={{
          width: 26,
          height: 26,
          borderRadius: Radius.full,
          backgroundColor: '#FCFCF0',
          transform: [{ translateX: anim.interpolate({ inputRange: [0, 1], outputRange: [0, 20] }) }],
        }}
      />
    </Pressable>
  );
}
