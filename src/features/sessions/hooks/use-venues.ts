import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { useMemo } from 'react';

import { sessionQueries } from '../storage/session-query-storage';
import type { DisplayPreferences } from '@/features/profiles/hooks/use-display-preferences';
import { formatRelativeDay } from '@/lib/format';

/** Saved venues with a meta line derived from how they have been used. */
export function useVenues({ userId, timeZone }: DisplayPreferences) {
  const { data: venues = [] } = useLiveQuery(
    sessionQueries.venuesForUser(userId),
    [userId],
  );

  return useMemo(() => venues.map((venue) => {
    const coldOnly = venue.sessionCount > 0 && venue.heatSeconds === 0;
    const parts = [
      coldOnly ? 'Cold only' : null,
      venue.sessionCount > 0
        ? `${venue.sessionCount} ${venue.sessionCount === 1 ? 'session' : 'sessions'}`
        : null,
      venue.lastSessionAt ? `Last used ${formatRelativeDay(venue.lastSessionAt, timeZone)}` : null,
    ].filter((part): part is string => part !== null);

    return {
      id: venue.id,
      name: venue.name,
      coldOnly,
      meta: parts.length > 0 ? parts.join(' · ') : 'Saved venue',
    };
  }), [timeZone, venues]);
}
