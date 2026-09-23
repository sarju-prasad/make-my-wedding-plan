import { describe, expect, it } from 'vitest';

import { parseDurationMs } from '../../src/utils/duration.js';

describe('parseDurationMs', () => {
  it.each([
    ['15m', 15 * 60 * 1000],
    ['7d', 7 * 24 * 60 * 60 * 1000],
    ['2h', 2 * 60 * 60 * 1000],
    ['30s', 30 * 1000],
  ])('parses "%s" as %i ms', (input, expected) => {
    expect(parseDurationMs(input)).toBe(expected);
  });

  it.each(['', 'bogus', '15', 'm', '15x', '-5m', '15 m'])('rejects invalid input "%s"', (input) => {
    expect(() => parseDurationMs(input)).toThrow(/Invalid duration/);
  });
});
