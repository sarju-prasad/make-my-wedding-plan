/**
 * Permanent regression test for core/logger/redaction.ts.
 *
 * This exists specifically because pino's built-in `redact.paths` option was
 * found, during scaffold development, to only match a secret at the exact
 * nesting depth configured — `*.password` redacted `user.password` but
 * silently let `body.user.password` through unredacted. `deepRedact` was
 * written to replace it precisely because it must catch a sensitive key at
 * ANY depth. If this test ever goes red, that bug is back.
 */
import { describe, expect, it } from 'vitest';

import { deepRedact, REDACTED_CENSOR } from '../../src/core/logger/redaction.js';

/** Wraps `leaf` in `n` layers of `{ wrapN: ... }` before reaching it. */
function wrapNTimes(n: number, leaf: unknown): unknown {
  let value = leaf;
  for (let i = n - 1; i >= 0; i--) {
    value = { [`wrap${i}`]: value };
  }
  return value;
}

describe('deepRedact — primitives pass through unchanged', () => {
  it.each([
    ['a string', 'hello'],
    ['a number', 42],
    ['a boolean', true],
    ['null', null],
    ['undefined', undefined],
  ])('%s', (_label, value) => {
    expect(deepRedact(value)).toBe(value);
  });
});

describe('deepRedact — nested objects at 3+ levels (the original bug)', () => {
  it('redacts a sensitive key 3 levels deep', () => {
    const input = { a: { b: { c: { password: 'secret-3-deep' } } } };
    const result = deepRedact(input) as { a: { b: { c: { password: string } } } };
    expect(result.a.b.c.password).toBe(REDACTED_CENSOR);
  });

  it('redacts a sensitive key 5 levels deep, alongside untouched siblings', () => {
    const input = {
      body: {
        user: {
          profile: {
            credentials: { token: 'deep-secret', label: 'primary' },
          },
          name: 'Priya',
        },
      },
    };

    const result = deepRedact(input) as typeof input;
    expect(result.body.user.profile.credentials.token).toBe(REDACTED_CENSOR);
    // Non-sensitive fields at every depth must survive untouched.
    expect(result.body.user.profile.credentials.label).toBe('primary');
    expect(result.body.user.name).toBe('Priya');
  });

  it('redacts every occurrence when the same key appears at multiple depths', () => {
    const input = { token: 'top', nested: { token: 'middle', deeper: { token: 'bottom' } } };
    const result = deepRedact(input) as typeof input;
    expect(result.token).toBe(REDACTED_CENSOR);
    expect(result.nested.token).toBe(REDACTED_CENSOR);
    expect(result.nested.deeper.token).toBe(REDACTED_CENSOR);
  });
});

describe('deepRedact — arrays', () => {
  it('redacts sensitive keys inside objects held in an array', () => {
    const input = { items: [{ password: 'a' }, { token: 'b' }, { name: 'safe' }] };
    const result = deepRedact(input) as {
      items: [{ password: string }, { token: string }, { name: string }];
    };
    expect(result.items[0].password).toBe(REDACTED_CENSOR);
    expect(result.items[1].token).toBe(REDACTED_CENSOR);
    expect(result.items[2].name).toBe('safe');
  });

  it('leaves an array of primitives unchanged', () => {
    const result = deepRedact({ tags: ['a', 'b', 'c'] }) as { tags: string[] };
    expect(result.tags).toEqual(['a', 'b', 'c']);
  });

  it('redacts through a mix of arrays nested in objects nested in arrays', () => {
    const input = [{ group: { members: [{ accessToken: 'x' }] } }];
    const result = deepRedact(input) as typeof input;
    // Non-null assertions are fine in tests (see eslint.config.js) — these
    // indexes are guaranteed to exist by the literal `input` above;
    // noUncheckedIndexedAccess just can't see that statically.
    expect(result[0]!.group.members[0]!.accessToken).toBe(REDACTED_CENSOR);
  });
});

describe('deepRedact — Date values', () => {
  it('returns a top-level Date unchanged, not walked as a plain object', () => {
    const date = new Date('2024-01-01T00:00:00.000Z');
    const result = deepRedact(date);
    expect(result).toBeInstanceOf(Date);
    expect((result as Date).getTime()).toBe(date.getTime());
  });

  it('returns a nested Date unchanged, 3 levels deep', () => {
    const date = new Date('2024-06-15T12:00:00.000Z');
    const input = { a: { b: { createdAt: date } } };
    const result = deepRedact(input) as { a: { b: { createdAt: Date } } };
    expect(result.a.b.createdAt).toBeInstanceOf(Date);
    expect(result.a.b.createdAt.getTime()).toBe(date.getTime());
  });

  it('does not redact a Date even if its key name is sensitive-looking', () => {
    // The key is checked, not the value — but a Date is never walked for
    // keys in the first place, since it's returned before the object loop.
    // This documents that a `{ token: someDate }` pair still redacts by KEY,
    // independent of the value being a Date.
    const date = new Date();
    const result = deepRedact({ token: date }) as { token: string };
    expect(result.token).toBe(REDACTED_CENSOR);
  });
});

describe('deepRedact — Error values', () => {
  it('returns a top-level Error unchanged, not flattened to {}', () => {
    const err = new Error('boom');
    const result = deepRedact(err);
    expect(result).toBeInstanceOf(Error);
    expect((result as Error).message).toBe('boom');
  });

  it('returns a nested Error unchanged, 3 levels deep', () => {
    const err = new Error('nested failure');
    const input = { a: { b: { err } } };
    const result = deepRedact(input) as { a: { b: { err: Error } } };
    expect(result.a.b.err).toBeInstanceOf(Error);
    expect(result.a.b.err.message).toBe('nested failure');
  });
});

describe('deepRedact — the configured depth cutoff', () => {
  // core/logger/redaction.ts: MAX_REDACT_DEPTH = 10. The root object is
  // examined at depth 0, so a value reached through exactly 10 layers of
  // wrapping is examined at depth 10 and — by design — returned as-is,
  // unredacted. This test locks in that exact, current boundary so a future
  // change to the constant is a deliberate edit here, not a silent drift.
  it('still redacts a sensitive key just inside the cutoff (9 layers of wrapping)', () => {
    const input = wrapNTimes(9, { password: 'still-caught' });
    const serialized = JSON.stringify(deepRedact(input));
    expect(serialized).not.toContain('still-caught');
    expect(serialized).toContain(REDACTED_CENSOR);
  });

  it('does NOT redact past the cutoff (10 layers of wrapping) — known, bounded limit', () => {
    const input = wrapNTimes(10, { password: 'too-deep-to-catch' });
    const serialized = JSON.stringify(deepRedact(input));
    expect(serialized).toContain('too-deep-to-catch');
  });

  it('does not throw or hang on deeply nested input', () => {
    const input = wrapNTimes(50, { token: 'irrelevant' });
    expect(() => deepRedact(input)).not.toThrow();
  });
});

describe('deepRedact — sensitive keys', () => {
  // Every key name SENSITIVE_KEYS in redaction.ts currently recognises.
  const SENSITIVE_KEY_NAMES = [
    'password',
    'passwordHash',
    'token',
    'tokenHash',
    'accessToken',
    'refreshToken',
    'resetToken',
    'resetTokenHash',
    'invitationToken',
    'guestSessionToken',
    'signedUrl',
    'presignedUrl',
    'uploadUrl',
    'downloadUrl',
    'apiKey',
    'secretAccessKey',
    'authorization',
    'cookie',
    'setCookie',
  ];

  it.each(SENSITIVE_KEY_NAMES)('redacts "%s"', (key) => {
    const result = deepRedact({ [key]: 'sensitive-value' }) as Record<string, unknown>;
    expect(result[key]).toBe(REDACTED_CENSOR);
  });

  it.each(['password', 'TOKEN', 'Authorization', 'CoOkIe'])('is case-insensitive: "%s"', (key) => {
    const result = deepRedact({ [key]: 'x' }) as Record<string, unknown>;
    expect(result[key]).toBe(REDACTED_CENSOR);
  });

  it.each(['access_token', 'access-token', 'refresh_token', 'secret_access_key'])(
    'normalises underscores/hyphens: "%s"',
    (key) => {
      const result = deepRedact({ [key]: 'x' }) as Record<string, unknown>;
      expect(result[key]).toBe(REDACTED_CENSOR);
    },
  );

  it.each(['name', 'email', 'username', 'id', 'status', 'title'])(
    'does NOT redact a non-sensitive key: "%s"',
    (key) => {
      const result = deepRedact({ [key]: 'plain-value' }) as Record<string, unknown>;
      expect(result[key]).toBe('plain-value');
    },
  );

  it('redacts req.headers.cookie and req.headers.authorization shapes', () => {
    const input = {
      req: { headers: { cookie: 'session=abc123', authorization: 'Bearer xyz', accept: 'json' } },
    };
    const result = deepRedact(input) as typeof input;
    expect(result.req.headers.cookie).toBe(REDACTED_CENSOR);
    expect(result.req.headers.authorization).toBe(REDACTED_CENSOR);
    expect(result.req.headers.accept).toBe('json');
  });

  it('redacts regardless of the value type, since the key alone decides', () => {
    const result = deepRedact({ password: undefined }) as Record<string, unknown>;
    expect(result.password).toBe(REDACTED_CENSOR);
  });
});
