import { describe, expect, it } from 'vitest';

import {
  signAccessToken,
  signRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
} from '../../src/modules/auth/auth.tokens.js';

describe('access tokens', () => {
  it('round-trips the userId', async () => {
    const token = await signAccessToken('507f1f77bcf86cd799439011');
    const payload = await verifyAccessToken(token);
    expect(payload.userId).toBe('507f1f77bcf86cd799439011');
  });

  it('rejects a malformed token', async () => {
    await expect(verifyAccessToken('not-a-jwt')).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
  });

  it('rejects a refresh token presented as an access token (different secrets)', async () => {
    const refreshToken = await signRefreshToken('507f1f77bcf86cd799439011', 0);
    await expect(verifyAccessToken(refreshToken)).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
  });

  it('rejects a token with a tampered payload', async () => {
    const token = await signAccessToken('507f1f77bcf86cd799439011');
    const [header, , signature] = token.split('.');
    const forgedPayload = Buffer.from(JSON.stringify({ sub: 'attacker-controlled-id' })).toString(
      'base64url',
    );
    await expect(
      verifyAccessToken(`${header}.${forgedPayload}.${signature}`),
    ).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
  });
});

describe('refresh tokens', () => {
  it('round-trips the userId and tokenVersion', async () => {
    const token = await signRefreshToken('507f1f77bcf86cd799439011', 3);
    const payload = await verifyRefreshToken(token);
    expect(payload).toEqual({ userId: '507f1f77bcf86cd799439011', tokenVersion: 3 });
  });

  it('rejects an access token presented as a refresh token (different secrets)', async () => {
    const accessToken = await signAccessToken('507f1f77bcf86cd799439011');
    await expect(verifyRefreshToken(accessToken)).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
  });
});
