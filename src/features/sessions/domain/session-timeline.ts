import { z } from 'zod';

export const sessionIntervalKindSchema = z.enum(['heat', 'cold', 'rest']);
export type SessionIntervalKind = z.infer<typeof sessionIntervalKindSchema>;

const sessionIntervalBaseSchema = z.object({
  id: z.string().min(1),
  durationSeconds: z.int().positive(),
});

const temperatureSchema = z.int().min(-500).max(2000).nullable();

export const sessionIntervalSchema = z.discriminatedUnion('kind', [
  sessionIntervalBaseSchema.extend({
    kind: z.literal('heat'),
    temperatureCTenths: temperatureSchema,
  }),
  sessionIntervalBaseSchema.extend({
    kind: z.literal('cold'),
    temperatureCTenths: temperatureSchema,
  }),
  sessionIntervalBaseSchema.extend({
    kind: z.literal('rest'),
    temperatureCTenths: z.null(),
  }),
]);

export type SessionInterval = z.infer<typeof sessionIntervalSchema>;

export const sessionTimelineDraftSchema = z.object({
  id: z.string().min(1),
  startedAt: z.iso.datetime({ offset: true }),
  elapsedSeconds: z.int().nonnegative(),
  venueName: z.string().trim().min(1).max(160).nullable(),
  rating: z.int().min(1).max(5).nullable(),
  note: z.string().max(4000).nullable(),
  intervals: z.array(sessionIntervalSchema),
});

export type SessionTimelineDraft = z.infer<typeof sessionTimelineDraftSchema>;

/** A timeline that has passed the rules required for permanent storage. */
export const sessionTimelineSchema = sessionTimelineDraftSchema.superRefine((session, context) => {
  if (!session.intervals.some((interval) => interval.kind !== 'rest')) {
    context.addIssue({
      code: 'custom',
      message: 'A session must include at least one sauna or cold plunge.',
      path: ['intervals'],
    });
  }

  const recordedSeconds = session.intervals.reduce(
    (total, interval) => total + interval.durationSeconds,
    0,
  );
  if (session.elapsedSeconds < recordedSeconds) {
    context.addIssue({
      code: 'custom',
      message: 'Session elapsed time cannot be shorter than recorded time.',
      path: ['elapsedSeconds'],
    });
  }
});

export type SessionTimeline = z.infer<typeof sessionTimelineSchema>;

export type SessionTimelineTotals = {
  elapsedSeconds: number;
  recordedSeconds: number;
  activeSeconds: number;
  heatSeconds: number;
  coldSeconds: number;
  restSeconds: number;
  untrackedSeconds: number;
  intervalCount: number;
  heatIntervalCount: number;
  coldIntervalCount: number;
  restIntervalCount: number;
  peakHeatCTenths: number | null;
  coldestColdCTenths: number | null;
};

export function calculateSessionTimelineTotals(
  input: SessionTimeline,
): SessionTimelineTotals {
  const session = sessionTimelineSchema.parse(input);
  const heat = session.intervals.filter((interval) => interval.kind === 'heat');
  const cold = session.intervals.filter((interval) => interval.kind === 'cold');
  const rest = session.intervals.filter((interval) => interval.kind === 'rest');
  const heatSeconds = sumDurations(heat);
  const coldSeconds = sumDurations(cold);
  const restSeconds = sumDurations(rest);
  const recordedSeconds = heatSeconds + coldSeconds + restSeconds;

  return {
    elapsedSeconds: session.elapsedSeconds,
    recordedSeconds,
    activeSeconds: heatSeconds + coldSeconds,
    heatSeconds,
    coldSeconds,
    restSeconds,
    untrackedSeconds: session.elapsedSeconds - recordedSeconds,
    intervalCount: session.intervals.length,
    heatIntervalCount: heat.length,
    coldIntervalCount: cold.length,
    restIntervalCount: rest.length,
    peakHeatCTenths: temperatureExtreme(heat, Math.max),
    coldestColdCTenths: temperatureExtreme(cold, Math.min),
  };
}

function sumDurations(intervals: SessionInterval[]): number {
  return intervals.reduce((total, interval) => total + interval.durationSeconds, 0);
}

function temperatureExtreme(
  intervals: SessionInterval[],
  compare: (...values: number[]) => number,
): number | null {
  const temperatures = intervals.flatMap((interval) =>
    interval.temperatureCTenths === null ? [] : [interval.temperatureCTenths],
  );
  return temperatures.length === 0 ? null : compare(...temperatures);
}
