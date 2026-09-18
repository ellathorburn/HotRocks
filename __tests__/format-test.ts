import { describe, expect, test } from '@jest/globals';

import { formatSessionTitle, formatTotalDuration } from '../src/lib/format';

describe('duration format', () => {
  test('uses one scale everywhere instead of clock-like values', () => {
    expect(formatTotalDuration(30)).toBe('30 sec');
    expect(formatTotalDuration(25 * 60)).toBe('25 min');
    expect(formatTotalDuration(81 * 60)).toBe('1 h 21 min');
    expect(formatTotalDuration(2 * 3600)).toBe('2 h');
    expect(formatTotalDuration(146 * 3600 + 20 * 60)).toBe('146 h');
  });
});

describe('session title', () => {
  const now = new Date('2026-09-18T12:00:00.000Z');

  test('prefers the venue', () => {
    expect(formatSessionTitle('Löyly Kallio', '2026-09-14T06:00:00.000Z', 'UTC', now)).toBe('Löyly Kallio');
  });

  test('uses the weekday within the last week and a date before that', () => {
    expect(formatSessionTitle(null, '2026-09-14T06:00:00.000Z', 'UTC', now)).toMatch(/Monday’s session/);
    expect(formatSessionTitle(null, '2026-09-01T06:00:00.000Z', 'UTC', now)).toMatch(/^Session on /);
  });
});
