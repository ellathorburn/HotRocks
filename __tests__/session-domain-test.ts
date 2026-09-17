import { describe, expect, test } from '@jest/globals';

import { calculateSessionTotals, sessionDraftSchema } from '../src/features/sessions/domain/session';

const validDraft = {
  id: 'session-1',
  startedAt: '2026-09-16T12:00:00.000Z',
  elapsedSeconds: 1_020,
  venueName: null,
  rating: 4,
  note: null,
  rounds: [{
    id: 'round-1',
    parts: [
      { id: 'heat-1', kind: 'heat' as const, durationSeconds: 900, temperatureCTenths: 900 },
      { id: 'cold-1', kind: 'cold' as const, durationSeconds: 120, temperatureCTenths: 110 },
    ],
  }],
};

describe('session save contract', () => {
  test('accepts a normal session and calculates persisted totals', () => {
    const draft = sessionDraftSchema.parse(validDraft);
    expect(calculateSessionTotals(draft)).toMatchObject({
      elapsedSeconds: 1_020,
      activeSeconds: 1_020,
      heatSeconds: 900,
      coldSeconds: 120,
      roundCount: 1,
    });
  });

  test('rejects elapsed time shorter than its saved parts', () => {
    const draft = sessionDraftSchema.parse({ ...validDraft, elapsedSeconds: 1_019 });
    expect(() => calculateSessionTotals(draft))
      .toThrow('Session elapsed time cannot be shorter than active time.');
  });

  test('rejects duplicate part kinds in one round before SQLite is touched', () => {
    const result = sessionDraftSchema.safeParse({
      ...validDraft,
      rounds: [{
        id: 'round-1',
        parts: [validDraft.rounds[0].parts[0], { ...validDraft.rounds[0].parts[0], id: 'heat-2' }],
      }],
    });
    expect(result.success).toBe(false);
  });
});
