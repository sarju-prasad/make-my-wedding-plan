/**
 * Regression tests for the superRefine checks in config/env.ts that have no
 * other coverage — env.ts parses process.env once at import time and
 * process.exit(1)s on failure, so these exercise envSchema.safeParse()
 * directly against a constructed object instead, independent of the real
 * process.env and without triggering that exit path.
 */
import { describe, expect, it } from 'vitest';

import { envSchema } from '../../src/config/env.js';

const VALID_ENV = {
  NODE_ENV: 'development',
  APP_BASE_URL: 'http://localhost:4000',
  WEB_BASE_URL: 'http://localhost:3000',
  MONGODB_URI: 'mongodb://localhost:27017',
  MONGODB_DB_NAME: 'test_db',
  JWT_ACCESS_SECRET: 'a'.repeat(32),
  JWT_REFRESH_SECRET: 'b'.repeat(32),
};

describe('envSchema', () => {
  it('accepts a minimal valid configuration', () => {
    const result = envSchema.safeParse(VALID_ENV);
    expect(result.success).toBe(true);
  });

  it('rejects JWT_ACCESS_SECRET and JWT_REFRESH_SECRET being the same value', () => {
    const result = envSchema.safeParse({
      ...VALID_ENV,
      JWT_REFRESH_SECRET: VALID_ENV.JWT_ACCESS_SECRET,
    });

    expect(result.success).toBe(false);
    expect(result.error?.issues.some((i) => i.path.includes('JWT_REFRESH_SECRET'))).toBe(true);
  });

  it.each(['15m', '7d', '2h', '30s'])('accepts a well-formed TTL: "%s"', (ttl) => {
    const result = envSchema.safeParse({ ...VALID_ENV, JWT_ACCESS_TTL: ttl });
    expect(result.success).toBe(true);
  });

  // A bare number ("900", meaning seconds in many other systems' convention)
  // is one realistic misconfiguration; "2 hours"/"1w" are another, more
  // subtle one — jose's own setExpirationTime() would accept both of those,
  // but middleware/cookies.ts separately parses this same env value with
  // utils/duration.ts's stricter parseDurationMs() (no spaces, no "w"/"y")
  // when computing the cookie's maxAge. Validating here against jose's
  // rules alone once let a value like "2 hours" pass at boot and then throw
  // at the first login/refresh, when parseDurationMs() actually ran.
  it.each(['900', '2 hours', '1w', '0s', '0m', 'fifteen minutes', '15 minuts', '', 'tomorrow'])(
    'rejects a malformed TTL: "%s"',
    (ttl) => {
      const result = envSchema.safeParse({ ...VALID_ENV, JWT_ACCESS_TTL: ttl });

      expect(result.success).toBe(false);
      expect(result.error?.issues.some((i) => i.path.includes('JWT_ACCESS_TTL'))).toBe(true);
    },
  );

  it('rejects a malformed JWT_REFRESH_TTL independently of JWT_ACCESS_TTL', () => {
    const result = envSchema.safeParse({ ...VALID_ENV, JWT_REFRESH_TTL: 'not-a-duration' });

    expect(result.success).toBe(false);
    expect(result.error?.issues.some((i) => i.path.includes('JWT_REFRESH_TTL'))).toBe(true);
  });

  it('normalizes CORS_ALLOWED_ORIGINS entries to their origin, stripping a trailing slash', () => {
    const result = envSchema.safeParse({
      ...VALID_ENV,
      CORS_ALLOWED_ORIGINS: 'https://example.com/, https://app.example.com',
    });

    expect(result.success).toBe(true);
    expect(result.data?.CORS_ALLOWED_ORIGINS).toEqual([
      'https://example.com',
      'https://app.example.com',
    ]);
  });

  it('rejects an unparseable entry in CORS_ALLOWED_ORIGINS', () => {
    const result = envSchema.safeParse({ ...VALID_ENV, CORS_ALLOWED_ORIGINS: 'not a url' });

    expect(result.success).toBe(false);
    expect(result.error?.issues.some((i) => i.path.includes('CORS_ALLOWED_ORIGINS'))).toBe(true);
  });

  // A scheme-less entry doesn't throw when parsed — `new URL('localhost:3000')`
  // reads "localhost" itself as the scheme and produces an origin of the
  // literal string "null" (verified directly). Before this schema existed,
  // a typo like that simply never matched a real Origin header; accepting
  // it unchanged would instead add the literal "null" to the allowlist,
  // which matches the real `Origin: null` header a browser sends from a
  // sandboxed iframe or a data: URL.
  it.each(['localhost:3000', 'ftp://example.com', 'ws://example.com'])(
    'rejects a non-http(s) CORS_ALLOWED_ORIGINS entry: "%s"',
    (entry) => {
      const result = envSchema.safeParse({ ...VALID_ENV, CORS_ALLOWED_ORIGINS: entry });

      expect(result.success).toBe(false);
      expect(result.error?.issues.some((i) => i.path.includes('CORS_ALLOWED_ORIGINS'))).toBe(true);
    },
  );

  it('never produces the literal string "null" as an allowed origin', () => {
    const result = envSchema.safeParse({
      ...VALID_ENV,
      CORS_ALLOWED_ORIGINS: 'localhost:3000,https://example.com',
    });

    expect(result.success).toBe(false);
  });
});
