/**
 * JWT signing and verification — api_design.docx §5: separate access and
 * refresh secrets (so a refresh token can never be replayed as an access
 * token), access token carries only `sub` (kept minimal and stateless —
 * verified on every request with no DB round trip), refresh token also
 * carries the `tokenVersion` it was issued with, so /auth/refresh can detect
 * a password-reset/security-event bump by comparing it against the user's
 * *current* tokenVersion — the actual revocation mechanism, since refresh
 * tokens are otherwise stateless in V1 (no stored token record).
 *
 * This file is this module's intended entry point for other layers —
 * middleware/authenticate.ts imports `verifyAccessToken` from here (a
 * relative import, not the `#modules/*` alias `no-restricted-imports`
 * blocks) rather than reaching into auth.service.ts or auth.model.ts.
 */
import { errors as joseErrors, jwtVerify, SignJWT } from 'jose';

import { env } from '#config/env.js';
import { AppError } from '#core/errors/index.js';

const accessSecret = new TextEncoder().encode(env.JWT_ACCESS_SECRET);
const refreshSecret = new TextEncoder().encode(env.JWT_REFRESH_SECRET);

const ALG = 'HS256';

export interface AccessTokenPayload {
  userId: string;
}

export interface RefreshTokenPayload {
  userId: string;
  tokenVersion: number;
}

export async function signAccessToken(userId: string): Promise<string> {
  return await new SignJWT({ sub: userId })
    .setProtectedHeader({ alg: ALG })
    .setIssuedAt()
    .setExpirationTime(env.JWT_ACCESS_TTL)
    .sign(accessSecret);
}

export async function signRefreshToken(userId: string, tokenVersion: number): Promise<string> {
  return await new SignJWT({ sub: userId, tokenVersion })
    .setProtectedHeader({ alg: ALG })
    .setIssuedAt()
    .setExpirationTime(env.JWT_REFRESH_TTL)
    .sign(refreshSecret);
}

/**
 * Throws AppError.accessTokenExpired() specifically for an expired token
 * (jose's own errors.JWTExpired — verified directly it's thrown exactly for
 * a lapsed `exp` claim, not any other verification failure), and
 * AppError.unauthorized() for anything else (malformed, mis-signed,
 * tampered) — never a raw jose error. The distinction matters to the one
 * caller that needs it: middleware/authenticate.ts forwards whichever one
 * this throws, and the frontend's apiFetch (lib/api.ts) only attempts a
 * refresh-and-retry on the expired case specifically, not on every 401.
 */
export async function verifyAccessToken(token: string): Promise<AccessTokenPayload> {
  try {
    const { payload } = await jwtVerify(token, accessSecret, { algorithms: [ALG] });
    if (typeof payload.sub !== 'string') {
      throw AppError.unauthorized();
    }
    return { userId: payload.sub };
  } catch (error) {
    if (error instanceof AppError) throw error;
    if (error instanceof joseErrors.JWTExpired) throw AppError.accessTokenExpired();
    throw AppError.unauthorized();
  }
}

export async function verifyRefreshToken(token: string): Promise<RefreshTokenPayload> {
  try {
    const { payload } = await jwtVerify(token, refreshSecret, { algorithms: [ALG] });
    if (typeof payload.sub !== 'string' || typeof payload.tokenVersion !== 'number') {
      throw AppError.unauthorized();
    }
    return { userId: payload.sub, tokenVersion: payload.tokenVersion };
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw AppError.unauthorized();
  }
}
