import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { useMemo } from 'react';

import { toSegments } from './timeline-view-model';
import { calculateIntervalTotals } from '../services/session-calculation-service';
import { calculateWeeklyStatistics } from '../services/session-statistics-service';
import { sessionQueries } from '../storage/session-query-storage';
import type { DisplayPreferences } from '@/features/profiles/hooks/use-display-preferences';
import {
  describeComposition,
  formatSessionDate,
  formatSessionTitle,
  formatTotalDuration,
} from '@/lib/format';

/** Home feed cards, this week's totals, and the session offered as a repeat. */
export function useHomeSessions({ userId, timeZone, temperatureUnit }: DisplayPreferences) {
  const { data: sessions = [], updatedAt } = useLiveQuery(
    sessionQueries.sessionsForUser(userId),
    [userId],
  );
  const { data: intervals = [] } = useLiveQuery(
    sessionQueries.intervalsForUser(userId),
    [userId],
  );
  const { data: pending = [] } = useLiveQuery(
    sessionQueries.pendingSessionSync(userId),
    [userId],
  );

  const cards = useMemo(() => sessions.map((session) => {
    const owned = intervals.filter((interval) => interval.sessionId === session.id);
    return {
      id: session.id,
      venue: formatSessionTitle(session.venue, session.startedAt, timeZone),
      totalTime: formatTotalDuration(session.elapsedSeconds),
      composition: describeComposition(calculateIntervalTotals(owned, session.elapsedSeconds))
        || 'Nothing logged',
      date: formatSessionDate(session.startedAt, timeZone),
      rating: session.rating,
      segments: toSegments(owned, temperatureUnit),
    };
  }), [intervals, sessions, temperatureUnit, timeZone]);

  const week = useMemo(
    () => calculateWeeklyStatistics(sessions, new Date(), timeZone),
    [sessions, timeZone],
  );

  const lastSession = sessions[0]
    ? { id: sessions[0].id, title: formatSessionTitle(sessions[0].venue, sessions[0].startedAt, timeZone) }
    : null;

  // One status for the feed instead of a badge on every card.
  const unsyncedCount = sessions.filter((session) =>
    pending.some((item) => item.aggregateId === session.id)).length;

  return { cards, week, lastSession, unsyncedCount, isLoaded: Boolean(updatedAt) };
}
