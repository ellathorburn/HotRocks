import type { TimelineEntry, TimelineSegment } from '@/components/ds';
import type { IntervalValues } from '../types/session-types';
import {
  describeInterval,
  formatTemperature,
  type TemperatureUnit,
} from '@/lib/format';

/** Screen-ready timeline blocks, with temperatures in the account's unit. */
export function toSegments(intervals: IntervalValues[], unit: TemperatureUnit): TimelineSegment[] {
  return intervals.map((interval) => ({
    kind: interval.kind,
    durationSeconds: interval.durationSeconds,
    temperature: interval.temperatureCTenths === null
      ? null
      : formatTemperature(interval.temperatureCTenths, unit),
  }));
}

/** Screen-ready timeline rows for the list under a session. */
export function toEntries(intervals: IntervalValues[], unit: TemperatureUnit): TimelineEntry[] {
  return intervals.map((interval) => ({
    id: interval.id,
    kind: interval.kind,
    meta: describeInterval(interval, unit),
  }));
}
