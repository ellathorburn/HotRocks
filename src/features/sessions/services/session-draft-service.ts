import { ZodError } from 'zod';

import type {
  SessionInterval,
  TimelineNavigationDraft,
} from '../types/session-types';
import {
  sessionIntervalSchema,
  timelineNavigationDraftSchema,
  timelineRuleMessages,
} from '../validation/session-validation';
import { sessionStorage } from '../storage/session-storage';
import { createId } from '@/lib/ids';

function parseStoredDraft(payloadJson: string | null): TimelineNavigationDraft | null {
  if (!payloadJson) return null;
  try {
    return timelineNavigationDraftSchema.parse(JSON.parse(payloadJson));
  } catch {
    return null;
  }
}

function create(
  userId: string,
  input: Omit<TimelineNavigationDraft, 'schemaVersion'>,
): string {
  const draft = timelineNavigationDraftSchema.parse({ schemaVersion: 2, ...input });
  return sessionStorage.createDraft(userId, JSON.stringify(draft));
}

function get(id: string, userId: string): TimelineNavigationDraft | null {
  return parseStoredDraft(sessionStorage.readDraft(id, userId));
}

function update(
  id: string,
  userId: string,
  change: (draft: TimelineNavigationDraft) => TimelineNavigationDraft,
): void {
  const current = get(id, userId);
  if (!current) throw new Error('Session timeline draft not found.');
  const next = timelineNavigationDraftSchema.parse(change(current));
  sessionStorage.updateDraft(id, userId, JSON.stringify(next));
}

/**
 * Returns the user-facing message for a timeline rule violation raised by a
 * draft or save operation, or null for unexpected failures.
 */
export function describeTimelineRuleError(error: unknown): string | null {
  if (!(error instanceof ZodError)) return null;
  const known = Object.values(timelineRuleMessages) as string[];
  return error.issues.find((issue) => known.includes(issue.message))?.message ?? null;
}

/** Canonical interval-based draft API. Every mutation enforces the timeline rules. */
export const sessionTimelineDraftService = {
  create,
  get,
  update,
  /** Starts a repeat of a saved session: same venue and intervals, fresh IDs. */
  createRepeat(userId: string, sessionId: string, now = new Date()): string {
    const source = sessionStorage.readSessionTimeline(sessionId, userId);
    if (!source) throw new Error('Session to repeat was not found.');
    return create(userId, {
      intervals: source.intervals.map((interval) => ({ ...interval, id: createId() })),
      venueName: source.venueName,
      rating: null,
      note: null,
      startedAt: now.toISOString(),
      elapsedSeconds: 0,
      entryMethod: 'repeat',
    });
  },
  setVenue(draftId: string, userId: string, venueName: string | null): void {
    update(draftId, userId, (draft) => ({ ...draft, venueName: venueName?.trim() || null }));
  },
  addInterval(draftId: string, userId: string, interval: SessionInterval): void {
    const parsed = sessionIntervalSchema.parse(interval);
    update(draftId, userId, (draft) => ({
      ...draft,
      intervals: [...draft.intervals, parsed],
    }));
  },
  updateInterval(
    draftId: string,
    userId: string,
    intervalId: string,
    change: (interval: SessionInterval) => SessionInterval,
  ): void {
    update(draftId, userId, (draft) => {
      let found = false;
      const intervals = draft.intervals.map((interval) => {
        if (interval.id !== intervalId) return interval;
        found = true;
        return sessionIntervalSchema.parse(change(interval));
      });
      if (!found) throw new Error('Session interval not found.');
      return { ...draft, intervals };
    });
  },
  removeInterval(draftId: string, userId: string, intervalId: string): void {
    update(draftId, userId, (draft) => {
      const intervals = draft.intervals.filter((interval) => interval.id !== intervalId);
      if (intervals.length === draft.intervals.length) {
        throw new Error('Session interval not found.');
      }
      return { ...draft, intervals };
    });
  },
  moveInterval(
    draftId: string,
    userId: string,
    intervalId: string,
    targetIndex: number,
  ): void {
    update(draftId, userId, (draft) => {
      const currentIndex = draft.intervals.findIndex((interval) => interval.id === intervalId);
      if (currentIndex < 0) throw new Error('Session interval not found.');
      if (!Number.isInteger(targetIndex) || targetIndex < 0 || targetIndex >= draft.intervals.length) {
        throw new Error('Session interval position is out of range.');
      }
      const intervals = [...draft.intervals];
      const [interval] = intervals.splice(currentIndex, 1);
      intervals.splice(targetIndex, 0, interval);
      return { ...draft, intervals };
    });
  },
  /** Records wall-clock visit time measured by the timer. */
  setElapsedSeconds(draftId: string, userId: string, elapsedSeconds: number): void {
    update(draftId, userId, (draft) => ({ ...draft, elapsedSeconds: Math.max(0, Math.round(elapsedSeconds)) }));
  },
  delete: sessionStorage.deleteDraft,
};
