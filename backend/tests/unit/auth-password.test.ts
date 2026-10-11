import { describe, expect, it } from 'vitest';

import { hashPassword, verifyPassword } from '../../src/modules/auth/auth.password.js';

describe('hashPassword / verifyPassword', () => {
  it('produces a hash that verifyPassword accepts for the original password', async () => {
    const hash = await hashPassword('correct horse battery staple');
    await expect(verifyPassword(hash, 'correct horse battery staple')).resolves.toBe(true);
  });

  it('rejects an incorrect password', async () => {
    const hash = await hashPassword('correct horse battery staple');
    await expect(verifyPassword(hash, 'wrong password')).resolves.toBe(false);
  });

  it('produces a different hash for the same password on each call (random salt)', async () => {
    const [a, b] = await Promise.all([
      hashPassword('same-password'),
      hashPassword('same-password'),
    ]);
    expect(a).not.toBe(b);
  });

  it('encodes as Argon2id', async () => {
    const hash = await hashPassword('correct horse battery staple');
    expect(hash.startsWith('$argon2id$')).toBe(true);
  });
});
