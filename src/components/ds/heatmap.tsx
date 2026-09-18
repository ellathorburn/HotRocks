import { useState } from 'react';
import { Text, View, type ViewStyle } from 'react-native';

import { ColdRamp, HeatRamp, Rubik } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type HeatmapDay = number | { heat?: number; cold?: number };

type HeatmapProps = {
  /** One value per day, oldest first, ending today. */
  data: HeatmapDay[];
  timeZone: string;
  now?: Date;
  gap?: number;
  style?: ViewStyle;
};

const DAY_MS = 86_400_000;
const LABEL_WIDTH = 16;
const ROW_LABELS = ['M', '', 'W', '', 'F', '', 'S'];

const clamp = (v: number | undefined) => Math.max(0, Math.min(4, Math.round(v || 0)));

/** Monday = 0 … Sunday = 6, in the account's timezone. */
function weekdayIndex(date: Date, timeZone: string): number {
  const name = new Intl.DateTimeFormat('en-US', { weekday: 'short', timeZone }).format(date);
  return ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].indexOf(name);
}

function dayOfMonth(date: Date, timeZone: string): number {
  return Number(new Intl.DateTimeFormat('en-US', { day: 'numeric', timeZone }).format(date));
}

/**
 * Calendar heatmap on the brand's heat ramp: one row per weekday (Monday
 * first), one column per week, most recent week last. Cells size themselves
 * to fill the available width, month names mark where a month starts, and
 * today is outlined.
 */
export function Heatmap({ data, timeZone, now = new Date(), gap = 4, style }: HeatmapProps) {
  const theme = useTheme();
  const [width, setWidth] = useState(0);

  // Pad so every row is a real weekday and today sits in its own row.
  const todayRow = weekdayIndex(now, timeZone);
  const leading = (todayRow - ((data.length - 1) % 7) + 7) % 7;
  const cells: (HeatmapDay | null)[] = [
    ...Array.from({ length: leading }, () => null),
    ...data,
    ...Array.from({ length: 6 - todayRow }, () => null),
  ];
  const columns = Math.ceil(cells.length / 7);
  const todayIndex = leading + data.length - 1;
  const dateAt = (index: number) => new Date(now.getTime() - (todayIndex - index) * DAY_MS);

  const cell = width > 0
    ? Math.max(6, Math.floor((width - LABEL_WIDTH - gap * columns) / columns))
    : 0;

  const monthLabels = Array.from({ length: columns }, (_, column) => {
    for (let row = 0; row < 7; row += 1) {
      const index = column * 7 + row;
      if (index < leading || index > todayIndex) continue;
      const date = dateAt(index);
      if (dayOfMonth(date, timeZone) === 1 || (column === 0 && row === leading)) {
        return new Intl.DateTimeFormat(undefined, { month: 'short', timeZone }).format(date);
      }
    }
    return '';
  });

  const labelStyle = { fontFamily: Rubik.medium, fontSize: 10, lineHeight: 12, color: theme.textSecondary };

  return (
    <View
      accessibilityRole="image"
      accessibilityLabel="Sauna and plunge days over the last 15 weeks"
      onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
      style={style}>
      {cell > 0 ? (
        <>
          <View style={{ flexDirection: 'row', marginLeft: LABEL_WIDTH + gap, gap, marginBottom: 4 }}>
            {monthLabels.map((label, column) => (
              <View key={column} style={{ width: cell }}>
                {/* Labels may overflow into the next, empty column. */}
                <Text numberOfLines={1} style={[labelStyle, { width: cell * 3 }]}>{label}</Text>
              </View>
            ))}
          </View>
          <View style={{ flexDirection: 'row', gap }}>
            <View style={{ width: LABEL_WIDTH, gap }}>
              {ROW_LABELS.map((label, row) => (
                <View key={row} style={{ height: cell, justifyContent: 'center' }}>
                  <Text style={labelStyle}>{label}</Text>
                </View>
              ))}
            </View>
            {Array.from({ length: columns }, (_, column) => (
              <View key={column} style={{ gap }}>
                {Array.from({ length: 7 }, (__, row) => {
                  const index = column * 7 + row;
                  const value = cells[index];
                  if (value === null || value === undefined) {
                    return <View key={row} style={{ width: cell, height: cell }} />;
                  }

                  const heat = clamp(typeof value === 'number' ? value : value.heat);
                  const cold = clamp(typeof value === 'number' ? 0 : value.cold);
                  let background: string = theme.surfaceSunken;
                  if (heat) background = HeatRamp[heat];
                  if (cold) background = ColdRamp[cold];
                  const isToday = index === todayIndex;

                  return (
                    <View
                      key={row}
                      style={{
                        width: cell,
                        height: cell,
                        borderRadius: 3,
                        backgroundColor: background,
                        borderWidth: isToday ? 2 : 0,
                        borderColor: theme.text,
                      }}
                    />
                  );
                })}
              </View>
            ))}
          </View>
        </>
      ) : null}
    </View>
  );
}
