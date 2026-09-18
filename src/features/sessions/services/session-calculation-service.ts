import type {
  IntervalValues,
  SessionInterval,
  SessionIntervalKind,
  SessionTimeline,
  SessionTimelineTotals,
  TimelineNavigationDraft,
} from '../types/session-types';
import { sessionTimelineSchema } from '../validation/session-validation';

/** Totals for any interval list, including incomplete drafts. Never throws. */
export function calculateIntervalTotals(
  intervals: IntervalValues[],
  elapsedSeconds: number,
): SessionTimelineTotals {
  const heat = intervals.filter((interval) => interval.kind === 'heat');
  const cold = intervals.filter((interval) => interval.kind === 'cold');
  const rest = intervals.filter((interval) => interval.kind === 'rest');
  const heatSeconds = sumDurations(heat);
  const coldSeconds = sumDurations(cold);
  const restSeconds = sumDurations(rest);
  const recordedSeconds = heatSeconds + coldSeconds + restSeconds;

  return {
    elapsedSeconds,
    recordedSeconds,
    activeSeconds: heatSeconds + coldSeconds,
    heatSeconds,
    coldSeconds,
    restSeconds,
    untrackedSeconds: Math.max(0, elapsedSeconds - recordedSeconds),
    intervalCount: intervals.length,
    heatIntervalCount: heat.length,
    coldIntervalCount: cold.length,
    restIntervalCount: rest.length,
    peakHeatCTenths: temperatureExtreme(heat, Math.max),
    coldestColdCTenths: temperatureExtreme(cold, Math.min),
  };
}

/** Totals for a save-ready session. Throws when the timeline violates a save rule. */
export function calculateSessionTimelineTotals(input: SessionTimeline): SessionTimelineTotals {
  const session = sessionTimelineSchema.parse(input);
  return calculateIntervalTotals(session.intervals, session.elapsedSeconds);
}

/**
 * Wall-clock visit time for a draft. Timer drafts measure it; manual and
 * repeated drafts only know their recorded intervals.
 */
export function resolveDraftElapsedSeconds(draft: TimelineNavigationDraft): number {
  const recorded = sumDurations(draft.intervals);
  return Math.max(draft.elapsedSeconds, recorded);
}

/** Narrows loose interval values to the validated union; breaks carry no temperature. */
export function toSessionInterval(values: IntervalValues): SessionInterval {
  return values.kind === 'rest'
    ? { id: values.id, kind: 'rest', durationSeconds: values.durationSeconds, temperatureCTenths: null }
    : {
      id: values.id,
      kind: values.kind,
      durationSeconds: values.durationSeconds,
      temperatureCTenths: values.temperatureCTenths,
    };
}

/** Activity kinds that may be appended next without breaking the ordering rule. */
export function allowedNextIntervalKinds(intervals: IntervalValues[]): SessionIntervalKind[] {
  return intervals.length === 0 ? ['heat', 'cold'] : ['heat', 'cold', 'rest'];
}

/** Whether the current timeline can be saved; mirrors `sessionTimelineSchema`. */
export function canSaveIntervals(intervals: IntervalValues[]): boolean {
  return intervals.some((interval) => interval.kind !== 'rest')
    && intervals[0]?.kind !== 'rest';
}

/** Most recent temperature recorded for a kind, used to carry values forward. */
export function lastTemperatureCTenths(
  intervals: IntervalValues[],
  kind: 'heat' | 'cold',
): number | null {
  for (let index = intervals.length - 1; index >= 0; index -= 1) {
    const interval = intervals[index];
    if (interval.kind === kind && interval.temperatureCTenths !== null) {
      return interval.temperatureCTenths;
    }
  }
  return null;
}

function sumDurations(items: IntervalValues[]): number {
  return items.reduce((total, item) => total + item.durationSeconds, 0);
}

function temperatureExtreme(
  items: IntervalValues[],
  compare: (...values: number[]) => number,
): number | null {
  const temperatures = items.flatMap((item) =>
    item.temperatureCTenths === null ? [] : [item.temperatureCTenths],
  );
  return temperatures.length === 0 ? null : compare(...temperatures);
}
