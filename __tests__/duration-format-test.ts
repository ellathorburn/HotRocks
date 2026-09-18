import { describe, expect, test } from '@jest/globals';

import { formatStepDuration, formatStepDurationCompact } from '../src/lib/format';

describe('step duration formatting', () => {
  test.each([
    [0, '0 min', '0′'],
    [30, '30 sec', '30″'],
    [44, '30 sec', '30″'],
    [45, '1 min', '1′'],
    [89, '1 min', '1′'],
    [90, '2 min', '2′'],
    [149, '2 min', '2′'],
    [150, '3 min', '3′'],
    [900, '15 min', '15′'],
  ])('%i seconds reads as %s', (seconds, full, compact) => {
    expect(formatStepDuration(seconds)).toBe(full);
    expect(formatStepDurationCompact(seconds)).toBe(compact);
  });
});
