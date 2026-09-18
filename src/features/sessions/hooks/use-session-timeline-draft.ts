import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { useMemo } from 'react';

import { toEntries, toSegments } from './timeline-view-model';
import {
  allowedNextIntervalKinds,
  calculateIntervalTotals,
  canSaveIntervals,
  resolveDraftElapsedSeconds,
} from '../services/session-calculation-service';
import { sessionQueries } from '../storage/session-query-storage';
import type { TimelineNavigationDraft } from '../types/session-types';
import { timelineNavigationDraftSchema } from '../validation/session-validation';
import type { DisplayPreferences } from '@/features/profiles/hooks/use-display-preferences';
import { describeComposition } from '@/lib/format';

/** The draft a logging screen is building, with its rules and totals applied. */
export function useSessionTimelineDraft(draftId: string, preferences: DisplayPreferences) {
  const { userId, temperatureUnit } = preferences;
  const { data: rows = [], updatedAt } = useLiveQuery(
    sessionQueries.draftPayload(draftId, userId),
    [draftId, userId],
  );

  const draft = useMemo<TimelineNavigationDraft | null>(() => {
    if (!rows[0]) return null;
    try {
      return timelineNavigationDraftSchema.parse(JSON.parse(rows[0].payloadJson));
    } catch {
      return null;
    }
  }, [rows]);

  const derived = useMemo(() => {
    const intervals = draft?.intervals ?? [];
    const totals = calculateIntervalTotals(
      intervals,
      draft ? resolveDraftElapsedSeconds(draft) : 0,
    );
    return {
      intervals,
      totals,
      composition: describeComposition(totals),
      segments: toSegments(intervals, temperatureUnit),
      entries: toEntries(intervals, temperatureUnit),
      allowedKinds: allowedNextIntervalKinds(intervals),
      canSave: canSaveIntervals(intervals),
    };
  }, [draft, temperatureUnit]);

  return { draft, isLoaded: Boolean(updatedAt), ...derived };
}
