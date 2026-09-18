import { describe, expect, test } from '@jest/globals';

import {
  allowedNextIntervalKinds,
  calculateSessionTimelineTotals,
  canSaveIntervals,
  lastTemperatureCTenths,
} from '../src/features/sessions/services/session-calculation-service';
import type {
  SessionTimeline,
  SessionTimelineDraft,
} from '../src/features/sessions/types/session-types';
import { sessionTimelineSchema } from '../src/features/sessions/validation/session-validation';

function timeline(
  intervals: SessionTimelineDraft['intervals'],
  elapsedSeconds = intervals.reduce((total, interval) => total + interval.durationSeconds, 0),
): SessionTimeline {
  return {
    id: 'session-1',
    startedAt: '2026-09-17T10:00:00.000Z',
    elapsedSeconds,
    venueName: null,
    rating: null,
    note: null,
    intervals,
  };
}

describe('session timeline validation and calculations', () => {
  test('allows arbitrary ordering and repeated activity types', () => {
    const input = timeline([
      { id: 'heat-1', kind: 'heat', durationSeconds: 900, temperatureCTenths: 900 },
      { id: 'rest-1', kind: 'rest', durationSeconds: 480, temperatureCTenths: null },
      { id: 'heat-2', kind: 'heat', durationSeconds: 720, temperatureCTenths: 950 },
      { id: 'cold-1', kind: 'cold', durationSeconds: 120, temperatureCTenths: 100 },
      { id: 'cold-2', kind: 'cold', durationSeconds: 60, temperatureCTenths: 80 },
    ]);

    expect(sessionTimelineSchema.parse(input).intervals.map(({ kind }) => kind))
      .toEqual(['heat', 'rest', 'heat', 'cold', 'cold']);
    expect(calculateSessionTimelineTotals(input)).toMatchObject({
      heatSeconds: 1620,
      coldSeconds: 180,
      restSeconds: 480,
      activeSeconds: 1800,
      recordedSeconds: 2280,
      intervalCount: 5,
      heatIntervalCount: 2,
      coldIntervalCount: 2,
      restIntervalCount: 1,
      peakHeatCTenths: 950,
      coldestColdCTenths: 80,
    });
  });

  test('requires every entry to last at least 30 seconds', () => {
    const entry = (durationSeconds: number) => timeline([
      { id: 'cold-1', kind: 'cold', durationSeconds, temperatureCTenths: null },
    ]);

    expect(sessionTimelineSchema.safeParse(entry(30)).success).toBe(true);
    expect(sessionTimelineSchema.safeParse(entry(29)).success).toBe(false);
  });

  test('tracks elapsed time that was not assigned to an interval', () => {
    const input = timeline([
      { id: 'heat-1', kind: 'heat', durationSeconds: 900, temperatureCTenths: null },
    ], 1200);

    expect(calculateSessionTimelineTotals(input).untrackedSeconds).toBe(300);
  });

  test('rejects an empty session and a session that starts with a break', () => {
    expect(() => sessionTimelineSchema.parse(timeline([], 600)))
      .toThrow('Add a sauna or cold plunge before you can save this session.');

    const leadingBreak = timeline([
      { id: 'rest-1', kind: 'rest', durationSeconds: 300, temperatureCTenths: null },
      { id: 'heat-1', kind: 'heat', durationSeconds: 900, temperatureCTenths: 900 },
    ]);
    expect(() => sessionTimelineSchema.parse(leadingBreak))
      .toThrow("A session can't start with a break — add it after a sauna or cold plunge.");
  });

  test('rejects temperatures on breaks and elapsed time shorter than the timeline', () => {
    const invalidBreak = {
      ...timeline([{ id: 'heat-1', kind: 'heat', durationSeconds: 60, temperatureCTenths: null }]),
      intervals: [{ id: 'rest-1', kind: 'rest', durationSeconds: 60, temperatureCTenths: 200 }],
    };
    expect(() => sessionTimelineSchema.parse(invalidBreak)).toThrow();

    const tooShort = timeline([
      { id: 'cold-1', kind: 'cold', durationSeconds: 120, temperatureCTenths: null },
      { id: 'rest-1', kind: 'rest', durationSeconds: 60, temperatureCTenths: null },
    ], 179);
    expect(() => sessionTimelineSchema.parse(tooShort))
      .toThrow('Session elapsed time cannot be shorter than recorded time.');
  });

  test('exposes the ordering rule the entry screens offer', () => {
    const logged = [
      { id: 'heat-1', kind: 'heat' as const, durationSeconds: 900, temperatureCTenths: 900 },
      { id: 'heat-2', kind: 'heat' as const, durationSeconds: 600, temperatureCTenths: null },
    ];

    expect(allowedNextIntervalKinds([])).toEqual(['heat', 'cold']);
    expect(allowedNextIntervalKinds(logged)).toEqual(['heat', 'cold', 'rest']);
    expect(canSaveIntervals([])).toBe(false);
    expect(canSaveIntervals(logged)).toBe(true);
    expect(lastTemperatureCTenths(logged, 'heat')).toBe(900);
    expect(lastTemperatureCTenths(logged, 'cold')).toBeNull();
  });
});
