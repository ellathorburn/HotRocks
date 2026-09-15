import { Pressable, type ViewStyle } from 'react-native';

import { Radius } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

import { Icon, type IconName } from './icon';

type IconButtonProps = {
  icon: IconName;
  label: string;
  size?: number;
  tone?: 'quiet' | 'solid' | 'accent';
  color?: string;
  onPress?: () => void;
  style?: ViewStyle;
};

/** Square tap target for a single glyph. Minimum 44px. */
export function IconButton({ icon, label, size = 44, tone = 'quiet', color, onPress, style }: IconButtonProps) {
  const theme = useTheme();
  const tones = {
    quiet: { background: 'transparent', color: theme.textSecondary },
    solid: { background: theme.card, color: theme.text },
    accent: { background: theme.accent, color: theme.textOnAccent },
  };
  const t = { ...tones[tone], color: color ?? tones[tone].color };

  return (
    <Pressable
      accessibilityLabel={label}
      onPress={onPress}
      style={[
        {
          width: size,
          height: size,
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: Radius.md,
          backgroundColor: t.background,
        },
        style,
      ]}>
      <Icon name={icon} size={22} color={t.color} />
    </Pressable>
  );
}
