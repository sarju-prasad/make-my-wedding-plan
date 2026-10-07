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

  // Matches DURATION_PATTERN fine, but a zero-length TTL issues a cookie or
  // token that's already expired the instant it's created — never a
  // meaningful value for any of this function's actual callers.
  it.each(['0s', '0m', '0h', '0d'])('rejects a zero-length duration "%s"', (input) => {
    expect(() => parseDurationMs(input)).toThrow(/Invalid duration/);
  });
});
