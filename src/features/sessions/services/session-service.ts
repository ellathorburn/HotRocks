import {
  calculateSessionTimelineTotals,
  resolveDraftElapsedSeconds,
} from './session-calculation-service';
import { sessionTimelineDraftService } from './session-draft-service';
import { sessionStorage } from '../storage/session-storage';
import type {
  SaveSessionDraftInput,
  SaveSessionTimelineInput,
} from '../types/session-types';
import { sessionTimelineSchema } from '../validation/session-validation';
import { requestSync } from '@/services/sync/sync-engine';

async function save(input: SaveSessionTimelineInput, draftId?: string): Promise<string> {
  const timeline = sessionTimelineSchema.parse(input);
  const totals = calculateSessionTimelineTotals(timeline);
  sessionStorage.saveTimelineAggregate({
    input: { ...input, ...timeline },
    totals,
    now: new Date().toISOString(),
    draftId,
  });
  void requestSync(input.userId);
  return timeline.id;
}

/**
 * Saves a timeline draft as a permanent session and consumes the draft in the
 * same transaction. Manual and repeated drafts end now; timer drafts keep
 * their measured start.
 */
async function saveDraft(input: SaveSessionDraftInput): Promise<string> {
  const draft = sessionTimelineDraftService.get(input.draftId, input.userId);
  if (!draft) throw new Error('Session timeline draft not found.');

  const now = input.now ?? new Date();
  const elapsedSeconds = resolveDraftElapsedSeconds(draft);
  const startedAt = draft.entryMethod === 'timer'
    ? draft.startedAt
    : new Date(now.getTime() - elapsedSeconds * 1000).toISOString();

  return save({
    id: input.sessionId,
    userId: input.userId,
    timezoneName: input.timezoneName,
    entryMethod: draft.entryMethod,
    startedAt,
    elapsedSeconds,
    venueName: draft.venueName,
    rating: input.rating,
    note: input.note,
    intervals: draft.intervals,
  }, input.draftId);
}

async function softDelete(sessionId: string, userId: string): Promise<void> {
  sessionStorage.softDelete(sessionId, userId, new Date().toISOString());
  void requestSync(userId);
}

/** Public lifecycle operations for permanently saved sessions. */
export const sessionService = {
  save,
  saveDraft,
  delete: softDelete,
};
