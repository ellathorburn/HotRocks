import { and, eq } from 'drizzle-orm';
import { z } from 'zod';

import {
  sessionIntervalSchema,
  sessionTimelineDraftSchema,
  type SessionInterval,
} from '../domain/session-timeline';
import { createId } from '@/lib/ids';
import { database } from '@/services/database/client';
import { sessionDrafts } from '@/services/database/schema';

export const timelineNavigationDraftSchema = sessionTimelineDraftSchema
  .omit({ id: true })
  .extend({
    schemaVersion: z.literal(2),
    entryMethod: z.enum(['manual', 'timer', 'repeat']),
  });

export type TimelineNavigationDraft = z.infer<typeof timelineNavigationDraftSchema>;

export function createSessionTimelineDraft(
  userId: string,
  input: Omit<TimelineNavigationDraft, 'schemaVersion'>,
): string {
  const id = createId();
  const draft = timelineNavigationDraftSchema.parse({ schemaVersion: 2, ...input });
  database.insert(sessionDrafts).values({
    id,
    userId,
    payloadJson: JSON.stringify(draft),
    updatedAt: new Date().toISOString(),
  }).run();
  return id;
}

export function readSessionTimelineDraft(
  id: string,
  userId: string,
): TimelineNavigationDraft | null {
  const row = database.select({ payloadJson: sessionDrafts.payloadJson })
    .from(sessionDrafts)
    .where(and(eq(sessionDrafts.id, id), eq(sessionDrafts.userId, userId)))
    .get();
  if (!row) return null;

  try {
    return timelineNavigationDraftSchema.parse(JSON.parse(row.payloadJson));
  } catch {
    return null;
  }
}

export function updateSessionTimelineDraft(
  id: string,
  userId: string,
  update: (draft: TimelineNavigationDraft) => TimelineNavigationDraft,
): void {
  const current = readSessionTimelineDraft(id, userId);
  if (!current) throw new Error('Session timeline draft not found.');
  const next = timelineNavigationDraftSchema.parse(update(current));
  writeDraft(id, userId, next);
}

export function appendSessionInterval(
  draftId: string,
  userId: string,
  interval: SessionInterval,
): void {
  const parsedInterval = sessionIntervalSchema.parse(interval);
  updateSessionTimelineDraft(draftId, userId, (draft) => ({
    ...draft,
    intervals: [...draft.intervals, parsedInterval],
  }));
}

export function updateSessionInterval(
  draftId: string,
  userId: string,
  intervalId: string,
  update: (interval: SessionInterval) => SessionInterval,
): void {
  updateSessionTimelineDraft(draftId, userId, (draft) => {
    let found = false;
    const intervals = draft.intervals.map((interval) => {
      if (interval.id !== intervalId) return interval;
      found = true;
      return sessionIntervalSchema.parse(update(interval));
    });
    if (!found) throw new Error('Session interval not found.');
    return { ...draft, intervals };
  });
}

export function removeSessionInterval(
  draftId: string,
  userId: string,
  intervalId: string,
): void {
  updateSessionTimelineDraft(draftId, userId, (draft) => {
    const intervals = draft.intervals.filter((interval) => interval.id !== intervalId);
    if (intervals.length === draft.intervals.length) {
      throw new Error('Session interval not found.');
    }
    return { ...draft, intervals };
  });
}

export function moveSessionInterval(
  draftId: string,
  userId: string,
  intervalId: string,
  targetIndex: number,
): void {
  updateSessionTimelineDraft(draftId, userId, (draft) => {
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
}

export function deleteSessionTimelineDraft(id: string, userId: string): void {
  database.delete(sessionDrafts)
    .where(and(eq(sessionDrafts.id, id), eq(sessionDrafts.userId, userId)))
    .run();
}

function writeDraft(
  id: string,
  userId: string,
  draft: TimelineNavigationDraft,
): void {
  database.update(sessionDrafts).set({
    payloadJson: JSON.stringify(draft),
    updatedAt: new Date().toISOString(),
  }).where(and(eq(sessionDrafts.id, id), eq(sessionDrafts.userId, userId))).run();
}
