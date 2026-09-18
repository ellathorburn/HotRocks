import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { useMemo } from 'react';

import { toEntries, toSegments } from './timeline-view-model';
import { calculateIntervalTotals } from '../services/session-calculation-service';
import { sessionQueries } from '../storage/session-query-storage';
import type { DisplayPreferences } from '@/features/profiles/hooks/use-display-preferences';
import {
  describeComposition,
  formatSessionDate,
  formatSessionTitle,
  formatTotalDuration,
} from '@/lib/format';

/** One saved session, ready to render: totals, timeline, sync and Strava state. */
export function useSessionDetail(sessionId: string, preferences: DisplayPreferences) {
  const { userId, temperatureUnit, timeZone } = preferences;
  const { data: sessions = [], updatedAt } = useLiveQuery(
    sessionQueries.sessionById(sessionId, userId),
    [sessionId, userId],
  );
  const { data: intervals = [] } = useLiveQuery(
    sessionQueries.intervalsForSession(sessionId, userId),
    [sessionId, userId],
  );
  const { data: exports = [] } = useLiveQuery(
    sessionQueries.stravaExportForSession(sessionId, userId),
    [sessionId, userId],
  );
  const { data: pending = [] } = useLiveQuery(
    sessionQueries.pendingSyncForSession(sessionId, userId),
    [sessionId, userId],
  );

  const session = sessions[0] ?? null;
  const derived = useMemo(() => {
    const totals = calculateIntervalTotals(intervals, session?.elapsedSeconds ?? 0);
    return {
      totals,
      composition: describeComposition(totals) || 'Nothing logged',
      segments: toSegments(intervals, temperatureUnit),
      entries: toEntries(intervals, temperatureUnit),
      totalTime: formatTotalDuration(session?.elapsedSeconds ?? 0),
      date: session ? formatSessionDate(session.startedAt, timeZone) : '',
      title: session ? formatSessionTitle(session.venue, session.startedAt, timeZone) : '',
    };
  }, [intervals, session, temperatureUnit, timeZone]);

  return {
    session,
    stravaExport: exports[0] ?? null,
    isPendingSync: pending.length > 0,
    isLoaded: Boolean(updatedAt),
    ...derived,
  };
}

/** The share card reads the same session through the same view model. */
export function useShareSession(sessionId: string, preferences: DisplayPreferences) {
  return useSessionDetail(sessionId, preferences);
}
