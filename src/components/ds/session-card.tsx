import { Text, View } from 'react-native';

import { displayText, Rubik, Type } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

import { Card } from './card';
import { Rating } from './rating';
import { TimelineStrip, type TimelineSegment } from './timeline-strip';

export type SessionCardData = {
  id: string;
  venue: string;
  totalTime: string;
  /** "2 saunas · 1 plunge · 1 break" */
  composition: string;
  date: string;
  rating?: number | null;
  segments: TimelineSegment[];
};

type SessionCardProps = {
  session: SessionCardData;
  onPress?: () => void;
};

/** One session in the Home feed: venue, total time, what it was made of, strip. */
export function SessionCard({ session, onPress }: SessionCardProps) {
  const theme = useTheme();
  const { venue, totalTime, composition, date, rating, segments } = session;

  return (
    <Card onPress={onPress} padded={false}>
      <View style={{ padding: 16 }}>
        {/* Two lines so long venue names read in full on typical phones. */}
        <Text
          numberOfLines={2}
          style={{ fontFamily: Rubik.medium, fontSize: Type.subheading, lineHeight: Type.subheading * 1.3, color: theme.text }}>
          {venue}
        </Text>
        <Text style={{ fontFamily: Rubik.bold, ...displayText(36), color: theme.text, fontVariant: ['tabular-nums'], marginTop: 6 }}>
          {totalTime}
        </Text>
        <Text style={{ fontFamily: Rubik.regular, fontSize: Type.small, color: theme.textSecondary, marginTop: 6 }}>
          {composition}
        </Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 8 }}>
          <Text style={{ fontFamily: Rubik.regular, fontSize: Type.small, color: theme.textSecondary }}>{date}</Text>
          {rating ? <Rating value={rating} readOnly size={14} /> : null}
        </View>
      </View>
      <TimelineStrip segments={segments} height={10} showLabels={false} radius={0} gap={1} />
    </Card>
  );
}
