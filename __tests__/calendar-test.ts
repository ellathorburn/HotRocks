import { describe, expect, test } from '@jest/globals';

import {
  calendarDayKey,
  calendarMonthKey,
  calendarWeekKey,
  recentCalendarDayKeys,
} from '../src/lib/calendar';

describe('timezone-aware calendar helpers', () => {
  test('uses the requested timezone instead of the device timezone', () => {
    const instant = new Date('2026-09-20T22:30:00.000Z');

    expect(calendarDayKey(instant, 'UTC')).toBe('2026-09-20');
    expect(calendarDayKey(instant, 'Africa/Johannesburg')).toBe('2026-09-21');
    expect(calendarWeekKey(instant, 'UTC')).toBe('2026-09-14');
    expect(calendarWeekKey(instant, 'Africa/Johannesburg')).toBe('2026-09-21');
  });

  test('creates stable month and recent-day keys across month boundaries', () => {
    const instant = new Date('2026-10-01T12:00:00.000Z');

    expect(calendarMonthKey(instant, 'UTC')).toBe('2026-10');
    expect(recentCalendarDayKeys(instant, 3, 'UTC'))
      .toEqual(['2026-09-29', '2026-09-30', '2026-10-01']);
  });
});
