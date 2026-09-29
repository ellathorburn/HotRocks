import { describe, expect, test } from '@jest/globals';

import { buildStravaActivityText } from '@/features/strava/services/strava-activity-text';
import { calculateIntervalTotals } from '@/features/sessions/services/session-calculation-service';

type TestInterval = {
  kind: 'heat' | 'cold' | 'rest';
  durationSeconds: number;
  temperatureCTenths: number | null;
};

const totalsFor = (
  intervals: TestInterval[],
  elapsedSeconds: number,
) => calculateIntervalTotals(
  intervals.map((interval, index) => ({ id: `interval-${index}`, ...interval })),
  elapsedSeconds,
);

const sauna = { kind: 'heat' as const, durationSeconds: 900, temperatureCTenths: 920 };
const plunge = { kind: 'cold' as const, durationSeconds: 120, temperatureCTenths: 110 };
const breakInterval = { kind: 'rest' as const, durationSeconds: 300, temperatureCTenths: null };

describe('Strava activity text', () => {
  test('names a mixed session after the venue', () => {
    const { name } = buildStravaActivityText({
      venueName: 'Sea Point Pavilion',
      totals: totalsFor([sauna, breakInterval, plunge], 1500),
      note: null,
      temperatureUnit: 'celsius',
    });

    expect(name).toBe('Sauna & cold plunge at Sea Point Pavilion');
  });

  test('names the activity for what it actually contained', () => {
    const only = (
      intervals: TestInterval[],
      seconds: number,
    ) => buildStravaActivityText({
      venueName: null,
      totals: totalsFor(intervals, seconds),
      note: null,
      temperatureUnit: 'celsius',
    }).name;

    expect(only([sauna], 900)).toBe('Sauna');
    expect(only([plunge], 120)).toBe('Cold plunge');
    expect(only([sauna, plunge], 1020)).toBe('Sauna & cold plunge');
  });

  test('falls back to the activity alone when there is no venue', () => {
    const { name } = buildStravaActivityText({
      venueName: null,
      totals: totalsFor([sauna], 900),
      note: null,
      temperatureUnit: 'celsius',
    });

    expect(name).toBe('Sauna');
  });

  test('describes the composition, totals and temperatures', () => {
    const { description } = buildStravaActivityText({
      venueName: 'Sea Point Pavilion',
      totals: totalsFor([sauna, breakInterval, plunge], 1500),
      note: null,
      temperatureUnit: 'celsius',
    });

    const lines = description.split('\n');
    expect(lines[1]).toBe('Sauna 15 min · Plunge 2 min · Break 5 min');
    expect(lines[2]).toBe('Peak sauna 92°C · Coldest plunge 11°C');
  });

  test('leaves out sections the session has nothing for', () => {
    const { description } = buildStravaActivityText({
      venueName: null,
      totals: totalsFor([sauna], 900),
      note: null,
      temperatureUnit: 'celsius',
    });

    expect(description).not.toContain('Plunge');
    expect(description).not.toContain('Break');
    expect(description).not.toContain('Coldest plunge');
    expect(description).toContain('Peak sauna 92°C');
  });

  test('respects the athlete display unit', () => {
    const { description } = buildStravaActivityText({
      venueName: null,
      totals: totalsFor([sauna, plunge], 1020),
      note: null,
      temperatureUnit: 'fahrenheit',
    });

    expect(description).toContain('198°F');
    expect(description).not.toContain('°C');
  });

  test('adds the note last, separated from the stats', () => {
    const { description } = buildStravaActivityText({
      venueName: null,
      totals: totalsFor([sauna], 900),
      note: '  Felt strong today.  ',
      temperatureUnit: 'celsius',
    });

    expect(description.endsWith('\n\nFelt strong today.')).toBe(true);
  });

  test('a blank note adds no trailing whitespace', () => {
    const { description } = buildStravaActivityText({
      venueName: null,
      totals: totalsFor([sauna], 900),
      note: '   ',
      temperatureUnit: 'celsius',
    });

    expect(description).toBe(description.trimEnd());
  });

  test('keeps the name within what Strava stores', () => {
    const { name } = buildStravaActivityText({
      venueName: 'V'.repeat(400),
      totals: totalsFor([sauna], 900),
      note: null,
      temperatureUnit: 'celsius',
    });

    expect(name.length).toBe(255);
  });
});
