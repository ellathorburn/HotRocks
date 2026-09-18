import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { useMemo } from 'react';

import { calculateProfileStatistics } from '../services/session-statistics-service';
import { sessionQueries } from '../storage/session-query-storage';
import type { DisplayPreferences } from '@/features/profiles/hooks/use-display-preferences';
import {
  formatCount,
  formatSessionTitle,
  formatTemperature,
  formatTotalDuration,
} from '@/lib/format';

/** Lifetime totals, streak, heatmap and records for the profile screen. */
export function useSessionStatistics({ userId, timeZone, temperatureUnit }: DisplayPreferences) {
  const { data: sessions = [] } = useLiveQuery(
    sessionQueries.sessionsForUser(userId),
    [userId],
  );
  const { data: intervals = [] } = useLiveQuery(
    sessionQueries.intervalsForUser(userId),
    [userId],
  );

  return useMemo(() => {
    const statistics = calculateProfileStatistics(sessions, intervals, new Date(), timeZone);
    const titleOf = (session: { venue: string | null; startedAt: string }) =>
      formatSessionTitle(session.venue, session.startedAt, timeZone);
    return {
      ...statistics,
      longest: statistics.longest
        ? `${titleOf(statistics.longest)} · ${formatTotalDuration(statistics.longest.elapsedSeconds)}`
        : 'No sessions yet',
      mostEntries: statistics.mostEntries
        ? `${titleOf(statistics.mostEntries)} · ${formatCount(statistics.mostEntries.intervalCount, 'entry', 'entries')}`
        : 'No sessions yet',
      hottest: statistics.hottest
        ? `${titleOf(statistics.hottest.session)} · ${formatTemperature(statistics.hottest.interval.temperatureCTenths!, temperatureUnit)}`
        : 'No temperature yet',
      coldest: statistics.coldest
        ? `${titleOf(statistics.coldest.session)} · ${formatTemperature(statistics.coldest.interval.temperatureCTenths!, temperatureUnit)}`
        : 'No temperature yet',
    };
  }, [intervals, sessions, temperatureUnit, timeZone]);
}
