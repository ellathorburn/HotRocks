import { describe, expect, jest, test } from '@jest/globals';
import { isValid } from 'ulid';

import { createId } from '../src/lib/ids';

describe('application identifiers', () => {
  test('creates valid, unique ULIDs through the Expo Crypto adapter', () => {
    const ids = Array.from({ length: 100 }, () => createId());

    expect(ids.every(isValid)).toBe(true);
    expect(new Set(ids).size).toBe(ids.length);
  });

  test('preserves monotonic ordering within the same millisecond', () => {
    jest.spyOn(Date, 'now').mockReturnValue(1_800_000_000_000);

    const first = createId();
    const second = createId();

    expect(second > first).toBe(true);
    jest.restoreAllMocks();
  });
});
