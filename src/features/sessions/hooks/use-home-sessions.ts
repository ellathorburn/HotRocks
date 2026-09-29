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

  // One status for the feed instead of a badge on every card. A conflict is
  // counted apart from an ordinary offline save: it needs a decision, and it
  // blocks every incoming change until it gets one.
  const queuedFor = (sessionId: string) =>
    pending.find((item) => item.aggregateId === sessionId) ?? null;
  const unsyncedCount = sessions.filter((session) => {
    const queued = queuedFor(session.id);
    return queued !== null && queued.status !== 'action_required';
  }).length;
  const conflictedSessions = sessions.filter(
    (session) => queuedFor(session.id)?.status === 'action_required',
  );

  return {
    cards,
    week,
    lastSession,
    unsyncedCount,
    conflictCount: conflictedSessions.length,
    firstConflictId: conflictedSessions[0]?.id ?? null,
    isLoaded: Boolean(updatedAt),
  };
}
