import { type ReactNode } from 'react';
import { Modal, Pressable, Text, View, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Radius, Rubik, ScreenGutter, Type } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type SheetProps = {
  children: ReactNode;
  title?: string;
  open?: boolean;
  onDismiss?: () => void;
  style?: ViewStyle;
};

/** Bottom sheet. 16px top corners, grab handle, content flows inline. */
export function Sheet({ children, title, open = true, onDismiss, style }: SheetProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <Modal visible={open} transparent animationType="slide" onRequestClose={onDismiss}>
      <Pressable style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: theme.scrim }} onPress={onDismiss}>
        <Pressable
          onPress={(e) => e.stopPropagation()}
          style={[
            {
              backgroundColor: theme.card,
              borderTopLeftRadius: Radius.lg,
              borderTopRightRadius: Radius.lg,
              paddingTop: 10,
              paddingHorizontal: ScreenGutter,
              paddingBottom: insets.bottom + 24,
            },
            style,
          ]}>
          <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: theme.border, alignSelf: 'center', marginBottom: 16 }} />
          {title ? (
            <Text style={{ fontFamily: Rubik.semibold, fontSize: Type.heading, lineHeight: 29, letterSpacing: -0.24, color: theme.text, marginBottom: 16 }}>
              {title}
            </Text>
          ) : null}
          {children}
        </Pressable>
      </Pressable>
    </Modal>
  );
}
