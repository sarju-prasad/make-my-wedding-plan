import { SignJWT } from 'jose';
import { describe, expect, it } from 'vitest';

import { env } from '../../src/config/env.js';
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

  // Distinct from every other rejection above: lib/api.ts's refresh-and-retry
  // only fires for this exact code, not a generic UNAUTHORIZED — an expired
  // token (unlike a malformed/tampered one) is the one case a refresh can
  // actually fix.
  it('rejects an expired token with ACCESS_TOKEN_EXPIRED, not a generic UNAUTHORIZED', async () => {
    const secret = new TextEncoder().encode(env.JWT_ACCESS_SECRET);
    const expiredToken = await new SignJWT({ sub: '507f1f77bcf86cd799439011' })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime('-10s')
      .sign(secret);

    await expect(verifyAccessToken(expiredToken)).rejects.toMatchObject({
      code: 'ACCESS_TOKEN_EXPIRED',
    });
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
