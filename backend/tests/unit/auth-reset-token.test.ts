import { describe, expect, it } from 'vitest';

import {
  generatePasswordResetToken,
  hashPasswordResetToken,
} from '../../src/modules/auth/auth.reset-token.js';

describe('generatePasswordResetToken', () => {
  it('generates a high-entropy hex string', () => {
    const token = generatePasswordResetToken();
    expect(token).toMatch(/^[0-9a-f]{64}$/);
  });

  it('generates a different token on each call', () => {
    expect(generatePasswordResetToken()).not.toBe(generatePasswordResetToken());
  });
});

describe('hashPasswordResetToken', () => {
  it('is deterministic for the same input', () => {
    const token = generatePasswordResetToken();
    expect(hashPasswordResetToken(token)).toBe(hashPasswordResetToken(token));
  });

  it('produces a different hash for a different token', () => {
    expect(hashPasswordResetToken(generatePasswordResetToken())).not.toBe(
      hashPasswordResetToken(generatePasswordResetToken()),
    );
  });

  it('never returns the raw token itself', () => {
    const token = generatePasswordResetToken();
    expect(hashPasswordResetToken(token)).not.toBe(token);
  });
});
