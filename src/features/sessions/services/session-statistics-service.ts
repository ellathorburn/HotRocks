import {
  calendarDayKey,
  calendarMonthKey,
  calendarWeekKey,
  recentCalendarDayKeys,
} from '@/lib/calendar';

export type StatisticsSession = {
  id: string;
  venue: string | null;
  startedAt: string;
  elapsedSeconds: number;
  heatSeconds: number;
  coldSeconds: number;
  restSeconds: number;
  intervalCount: number;
};

export type StatisticsInterval = {
  sessionId: string;
  kind: 'heat' | 'cold' | 'rest';
  temperatureCTenths: number | null;
};

export const HEATMAP_DAYS = 105;

export function calculateWeeklyStatistics(
  sessions: StatisticsSession[],
  now: Date,
  timeZone: string,
) {
  const currentWeek = calendarWeekKey(now, timeZone);
  const matching = sessions.filter(
    (session) => calendarWeekKey(new Date(session.startedAt), timeZone) === currentWeek,
  );
  return {
    sessions: matching.length,
    heatSeconds: sum(matching, (session) => session.heatSeconds),
    coldSeconds: sum(matching, (session) => session.coldSeconds),
    restSeconds: sum(matching, (session) => session.restSeconds),
  };
}

export function calculateProfileStatistics(
  sessions: StatisticsSession[],
  intervals: StatisticsInterval[],
  now: Date,
  timeZone: string,
) {
  const sessionById = new Map(sessions.map((session) => [session.id, session]));
  const activeIntervals = intervals.filter((interval) => sessionById.has(interval.sessionId));
  const currentMonth = calendarMonthKey(now, timeZone);
  const weeksWithSessions = new Set(
    sessions.map((session) => calendarWeekKey(new Date(session.startedAt), timeZone)),
  );
  let streak = 0;
  const currentWeek = calendarWeekKey(now, timeZone);
  const cursor = new Date(`${currentWeek}T00:00:00.000Z`);
  while (weeksWithSessions.has(cursor.toISOString().slice(0, 10))) {
    streak += 1;
    cursor.setUTCDate(cursor.getUTCDate() - 7);
  }

  const activity = new Map<string, { heat: number; cold: number }>();
  for (const interval of activeIntervals) {
    if (interval.kind === 'rest') continue;
    const session = sessionById.get(interval.sessionId);
    if (!session) continue;
    const key = calendarDayKey(new Date(session.startedAt), timeZone);
    const value = activity.get(key) ?? { heat: 0, cold: 0 };
    value[interval.kind] += 1;
    activity.set(key, value);
  }

  const longest = maximumBy(sessions, (session) => session.elapsedSeconds);
  const mostEntries = maximumBy(sessions, (session) => session.intervalCount);
  const hottest = maximumBy(
    activeIntervals.filter((interval) => interval.kind === 'heat' && interval.temperatureCTenths !== null),
    (interval) => interval.temperatureCTenths ?? -Infinity,
  );
  const coldest = minimumBy(
    activeIntervals.filter((interval) => interval.kind === 'cold' && interval.temperatureCTenths !== null),
    (interval) => interval.temperatureCTenths ?? Infinity,
  );

  return {
    sessions: sessions.length,
    heatSeconds: sum(sessions, (session) => session.heatSeconds),
    coldSeconds: sum(sessions, (session) => session.coldSeconds),
    restSeconds: sum(sessions, (session) => session.restSeconds),
    monthSessions: sessions.filter(
      (session) => calendarMonthKey(new Date(session.startedAt), timeZone) === currentMonth,
    ).length,
    streak,
    heatmap: recentCalendarDayKeys(now, HEATMAP_DAYS, timeZone).map((key) => activity.get(key) ?? 0),
    longest,
    mostEntries,
    hottest: hottest ? { interval: hottest, session: sessionById.get(hottest.sessionId)! } : null,
    coldest: coldest ? { interval: coldest, session: sessionById.get(coldest.sessionId)! } : null,
  };
}

function sum<T>(values: T[], value: (item: T) => number): number {
  return values.reduce((total, item) => total + value(item), 0);
}

function maximumBy<T>(values: T[], score: (item: T) => number): T | null {
  return values.reduce<T | null>(
    (best, item) => best === null || score(item) > score(best) ? item : best,
    null,
  );
}

function minimumBy<T>(values: T[], score: (item: T) => number): T | null {
  return values.reduce<T | null>(
    (best, item) => best === null || score(item) < score(best) ? item : best,
    null,
  );
}
