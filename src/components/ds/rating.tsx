import { Pressable, View, type ViewStyle } from 'react-native';

import { Radius } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

import { Icon } from './icon';

type RatingProps = {
  value?: number;
  onChange?: (value: number) => void;
  size?: number;
  readOnly?: boolean;
  style?: ViewStyle;
};

/** Five taps. Pill container — the only control besides chips allowed to be round. */
export function Rating({ value = 0, onChange, size = 32, readOnly = false, style }: RatingProps) {
  const theme = useTheme();

  return (
    <View
      style={[
        {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 4,
          alignSelf: 'flex-start',
          paddingVertical: readOnly ? 0 : 6,
          paddingHorizontal: readOnly ? 0 : 12,
          borderRadius: Radius.full,
          borderWidth: readOnly ? 0 : 1,
          borderColor: theme.borderStrong,
        },
        style,
      ]}>
      {[1, 2, 3, 4, 5].map((n) =>
        readOnly ? (
          <Icon key={n} name="star" size={size} fill={n <= value} color={n <= value ? theme.sand : theme.borderStrong} />
        ) : (
          <Pressable key={n} onPress={() => onChange?.(n)} hitSlop={4}>
            <Icon name="star" size={size} fill={n <= value} color={n <= value ? theme.sand : theme.borderStrong} />
          </Pressable>
        ),
      )}
    </View>
  );
}
