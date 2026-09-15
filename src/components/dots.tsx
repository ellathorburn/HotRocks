import { View } from 'react-native';

import { useTheme } from '@/hooks/use-theme';

type DotsProps = { n?: number; active?: number };

export function Dots({ n = 3, active = 0 }: DotsProps) {
  const theme = useTheme();

  return (
    <View style={{ flexDirection: 'row', gap: 6, justifyContent: 'center' }}>
      {Array.from({ length: n }).map((_, i) => (
        <View
          key={i}
          style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: i === active ? theme.accent : theme.borderStrong }}
        />
      ))}
    </View>
  );
}
