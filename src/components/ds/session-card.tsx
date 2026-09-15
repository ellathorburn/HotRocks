import { Text, View } from 'react-native';

import { Rubik, Type } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

import { Badge } from './badge';
import { Card } from './card';
import { Rating } from './rating';
import { RoundStrip, type RoundSegment } from './round-strip';

export type SessionCardData = {
  venue: string;
  totalTime: string;
  rounds: number;
  date: string;
  rating?: number | null;
  segments: RoundSegment[];
  synced?: boolean;
};

type SessionCardProps = {
  session: SessionCardData;
  onPress?: () => void;
};

/** One session in the Home feed. Venue, total time, rounds, date, rating, mini strip. */
export function SessionCard({ session, onPress }: SessionCardProps) {
  const theme = useTheme();
  const { venue, totalTime, rounds, date, rating, segments, synced = true } = session;

  return (
    <Card onPress={onPress} padded={false}>
      <View style={{ padding: 16, gap: 8 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Text
            numberOfLines={1}
            style={{ flexShrink: 1, fontFamily: Rubik.medium, fontSize: Type.subheading, color: theme.text }}>
            {venue}
          </Text>
          {!synced ? <Badge icon="cloud-off">On device</Badge> : null}
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8 }}>
          <Text style={{ fontFamily: Rubik.bold, fontSize: 36, color: theme.text, fontVariant: ['tabular-nums'] }}>
            {totalTime}
          </Text>
          <Text style={{ fontFamily: Rubik.regular, fontSize: Type.small, color: theme.textSecondary }}>
            {rounds} {rounds === 1 ? 'round' : 'rounds'}
          </Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <Text style={{ fontFamily: Rubik.regular, fontSize: Type.small, color: theme.textSecondary }}>{date}</Text>
          {rating ? <Rating value={rating} readOnly size={14} /> : null}
        </View>
      </View>
      <RoundStrip segments={segments} height={10} showLabels={false} radius={0} gap={1} />
    </Card>
  );
}
