import { z } from 'zod';

/** Shortest duration an entry can have. */
export const MIN_INTERVAL_SECONDS = 30;

/** User-facing messages for timeline rules; screens show these verbatim. */
export const timelineRuleMessages = {
  leadingBreak: "A session can't start with a break — add it after a sauna or cold plunge.",
  noActiveInterval: 'Add a sauna or cold plunge before you can save this session.',
  elapsedTooShort: 'Session elapsed time cannot be shorter than recorded time.',
} as const;

export const sessionIntervalKindSchema = z.enum(['heat', 'cold', 'rest']);

const sessionIntervalBaseSchema = z.object({
  id: z.string().min(1),
  durationSeconds: z.int().min(MIN_INTERVAL_SECONDS),
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

const timelineFieldsSchema = z.object({
  startedAt: z.iso.datetime({ offset: true }),
  elapsedSeconds: z.int().nonnegative(),
  venueName: z.string().trim().min(1).max(160).nullable(),
  rating: z.int().min(1).max(5).nullable(),
  note: z.string().max(4000).nullable(),
  intervals: z.array(sessionIntervalSchema),
});

/** Ordering rule shared by drafts and saved sessions: a break needs something before it. */
function rejectLeadingBreak(
  value: { intervals: z.infer<typeof sessionIntervalSchema>[] },
  context: z.core.$RefinementCtx,
): void {
  if (value.intervals[0]?.kind === 'rest') {
    context.addIssue({
      code: 'custom',
      message: timelineRuleMessages.leadingBreak,
      path: ['intervals', 0],
    });
  }
}

export const sessionTimelineDraftSchema = timelineFieldsSchema
  .extend({ id: z.string().min(1) })
  .superRefine(rejectLeadingBreak);

export const sessionTimelineSchema = sessionTimelineDraftSchema.superRefine((session, context) => {
  if (!session.intervals.some((interval) => interval.kind !== 'rest')) {
    context.addIssue({
      code: 'custom',
      message: timelineRuleMessages.noActiveInterval,
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
      message: timelineRuleMessages.elapsedTooShort,
      path: ['elapsedSeconds'],
    });
  }
});

export const timelineNavigationDraftSchema = timelineFieldsSchema
  .extend({
    schemaVersion: z.literal(2),
    entryMethod: z.enum(['manual', 'timer', 'repeat']),
  })
  .superRefine(rejectLeadingBreak);
