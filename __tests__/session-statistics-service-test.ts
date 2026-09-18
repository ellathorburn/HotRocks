import { describe, expect, test } from '@jest/globals';

import {
  calculateProfileStatistics,
  calculateWeeklyStatistics,
} from '../src/features/sessions/services/session-statistics-service';

const sessions = [
  {
    id: 'current-week',
    venue: 'Current Sauna',
    startedAt: '2026-09-16T12:00:00.000Z',
    elapsedSeconds: 1200,
    heatSeconds: 900,
    coldSeconds: 120,
    restSeconds: 180,
    intervalCount: 3,
  },
  {
    id: 'previous-week',
    venue: 'Previous Sauna',
    startedAt: '2026-09-09T12:00:00.000Z',
    elapsedSeconds: 1800,
    heatSeconds: 1500,
    coldSeconds: 180,
    restSeconds: 0,
    intervalCount: 4,
  },
];

const intervals = [
  { sessionId: 'current-week', kind: 'heat' as const, temperatureCTenths: 950 },
  { sessionId: 'current-week', kind: 'rest' as const, temperatureCTenths: null },
  { sessionId: 'current-week', kind: 'cold' as const, temperatureCTenths: 80 },
  { sessionId: 'previous-week', kind: 'heat' as const, temperatureCTenths: 900 },
];

describe('session statistics service', () => {
  test('calculates the current profile-timezone week', () => {
    expect(calculateWeeklyStatistics(
      sessions,
      new Date('2026-09-17T12:00:00.000Z'),
      'UTC',
    )).toEqual({ sessions: 1, heatSeconds: 900, coldSeconds: 120, restSeconds: 180 });
  });

  test('calculates streaks, records, and heatmap activity ignoring breaks without UI dependencies', () => {
    const result = calculateProfileStatistics(
      sessions,
      intervals,
      new Date('2026-09-17T12:00:00.000Z'),
      'UTC',
    );

    expect(result).toMatchObject({
      sessions: 2,
      restSeconds: 180,
      monthSessions: 2,
      streak: 2,
      longest: { id: 'previous-week' },
      mostEntries: { id: 'previous-week' },
      hottest: { interval: { temperatureCTenths: 950 } },
      coldest: { interval: { temperatureCTenths: 80 } },
    });
    expect(result.heatmap.at(-2)).toEqual({ heat: 1, cold: 1 });
  });
});
