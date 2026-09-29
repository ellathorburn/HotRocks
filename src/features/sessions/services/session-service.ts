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
 * Rewrites an already-saved session from an edited timeline and queues the
 * cloud update. The session keeps its identity and its place in the feed; only
 * what the user changed moves.
 */
async function update(input: SaveSessionTimelineInput, draftId?: string): Promise<string> {
  const timeline = sessionTimelineSchema.parse(input);
  const totals = calculateSessionTimelineTotals(timeline);
  const updated = sessionStorage.updateTimelineAggregate({
    input: { ...input, ...timeline },
    totals,
    now: new Date().toISOString(),
    draftId,
  });
  if (!updated) throw new Error('Session to edit no longer exists.');
  void requestSync(input.userId);
  return timeline.id;
}

/**
 * Saves a timeline draft and consumes the draft in the same transaction. A
 * draft that carries `editingSessionId` rewrites that session and keeps its
 * original start time; otherwise a new session is created, with manual and
 * repeated drafts ending now and timer drafts keeping their measured start.
 */
async function saveDraft(input: SaveSessionDraftInput): Promise<string> {
  const draft = sessionTimelineDraftService.get(input.draftId, input.userId);
  if (!draft) throw new Error('Session timeline draft not found.');

  const now = input.now ?? new Date();
  const elapsedSeconds = resolveDraftElapsedSeconds(draft);
  const isEdit = draft.editingSessionId !== null;
  const startedAt = isEdit || draft.entryMethod === 'timer'
    ? draft.startedAt
    : new Date(now.getTime() - elapsedSeconds * 1000).toISOString();

  const timeline: SaveSessionTimelineInput = {
    id: draft.editingSessionId ?? input.sessionId,
    userId: input.userId,
    timezoneName: input.timezoneName,
    entryMethod: draft.entryMethod,
    startedAt,
    elapsedSeconds,
    venueName: draft.venueName,
    rating: input.rating,
    note: input.note,
    intervals: draft.intervals,
  };

  return isEdit ? update(timeline, input.draftId) : save(timeline, input.draftId);
}

async function softDelete(sessionId: string, userId: string): Promise<void> {
  sessionStorage.softDelete(sessionId, userId, new Date().toISOString());
  void requestSync(userId);
}

/** Public lifecycle operations for permanently saved sessions. */
export const sessionService = {
  save,
  saveDraft,
  update,
  delete: softDelete,
};
