import type { z } from 'zod';

import type {
  sessionIntervalKindSchema,
  sessionIntervalSchema,
  sessionTimelineDraftSchema,
  sessionTimelineSchema,
  timelineNavigationDraftSchema,
} from '../validation/session-validation';

/** Session-related application types live here. Their runtime rules live in validation/. */
export type SessionIntervalKind = z.infer<typeof sessionIntervalKindSchema>;
export type SessionInterval = z.infer<typeof sessionIntervalSchema>;
export type SessionTimelineDraft = z.infer<typeof sessionTimelineDraftSchema>;
export type SessionTimeline = z.infer<typeof sessionTimelineSchema>;
export type TimelineNavigationDraft = z.infer<typeof timelineNavigationDraftSchema>;
export type SessionEntryMethod = TimelineNavigationDraft['entryMethod'];

/**
 * A stored or in-progress interval before it is narrowed to the validated
 * union. SQLite rows and screen state arrive in this shape.
 */
export type IntervalValues = {
  id: string;
  kind: SessionIntervalKind;
  durationSeconds: number;
  temperatureCTenths: number | null;
};

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

export type SaveSessionTimelineInput = SessionTimeline & {
  userId: string;
  timezoneName: string;
  entryMethod: SessionEntryMethod;
};

/** Fields the summary screen edits locally before saving a draft. */
export type SaveSessionDraftInput = {
  sessionId: string;
  draftId: string;
  userId: string;
  timezoneName: string;
  rating: number | null;
  note: string | null;
  now?: Date;
};
