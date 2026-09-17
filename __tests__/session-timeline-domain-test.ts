import { describe, expect, test } from '@jest/globals';

import {
  calculateSessionTimelineTotals,
  sessionTimelineSchema,
  type SessionTimeline,
  type SessionTimelineDraft,
} from '../src/features/sessions/domain/session-timeline';

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

describe('session timeline domain', () => {
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

  test('tracks elapsed time that was not assigned to an interval', () => {
    const input = timeline([
      { id: 'heat-1', kind: 'heat', durationSeconds: 900, temperatureCTenths: null },
    ], 1200);

    expect(calculateSessionTimelineTotals(input).untrackedSeconds).toBe(300);
  });

  test('rejects a session containing only breaks', () => {
    const input = timeline([
      { id: 'rest-1', kind: 'rest', durationSeconds: 300, temperatureCTenths: null },
    ]);

    expect(() => sessionTimelineSchema.parse(input))
      .toThrow('A session must include at least one sauna or cold plunge.');
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
});
