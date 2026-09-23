/**
 * The one place `httpOnly` / `secure` / `sameSite` / `path` / `domain` are
 * decided for each of the three cookie types this app issues. Nothing else
 * should call `res.cookie()` / `res.clearCookie()` directly — ad hoc cookie
 * options are exactly how a security decision quietly drifts between routes.
 *
 * api_design.docx §5:
 *   - Access cookie path: /
 *   - Refresh cookie path: /api/v1/auth   (least privilege — only the
 *     refresh/logout endpoints ever need to see this cookie)
 *   - SameSite: Lax initially; Secure: true in production; Domain omitted
 *     for host-only cookies.
 * api_design.docx §6.2: the guest invitation token is exchanged for a
 * short-lived guest HttpOnly cookie — same handling as the access cookie.
 */
import type { CookieOptions, Response } from 'express';

import { API_BASE_PATH } from '#config/constants.js';
import { env } from '#config/env.js';
import { parseDurationMs } from '#utils/duration.js';

export const COOKIE_NAMES = {
  access: 'access_token',
  refresh: 'refresh_token',
  guest: 'guest_session',
} as const;

function baseOptions(): Pick<CookieOptions, 'httpOnly' | 'secure' | 'sameSite' | 'domain'> {
  return {
    httpOnly: true,
    secure: env.COOKIE_SECURE,
    sameSite: env.COOKIE_SAMESITE,
    // Omitted (not empty-string) when unset, so the cookie stays host-only
    // rather than Express writing a `Domain=` attribute browsers may reject.
    ...(env.COOKIE_DOMAIN ? { domain: env.COOKIE_DOMAIN } : {}),
  };
}

export function setAccessCookie(res: Response, token: string): void {
  res.cookie(COOKIE_NAMES.access, token, {
    ...baseOptions(),
    path: '/',
    maxAge: parseDurationMs(env.JWT_ACCESS_TTL),
  });
}

export function setRefreshCookie(res: Response, token: string): void {
  res.cookie(COOKIE_NAMES.refresh, token, {
    ...baseOptions(),
    path: `${API_BASE_PATH}/auth`,
    maxAge: parseDurationMs(env.JWT_REFRESH_TTL),
  });
}

export function setGuestCookie(res: Response, token: string): void {
  res.cookie(COOKIE_NAMES.guest, token, {
    ...baseOptions(),
    path: '/',
    maxAge: parseDurationMs(env.GUEST_SESSION_TTL),
  });
}

/**
 * `clearCookie` must be called with the *same* path/domain/sameSite the
 * cookie was set with, or the browser treats it as a different cookie and
 * silently fails to remove it — a very easy way to ship a logout button
 * that doesn't log out.
 */
export function clearAuthCookies(res: Response): void {
  res.clearCookie(COOKIE_NAMES.access, { ...baseOptions(), path: '/' });
  res.clearCookie(COOKIE_NAMES.refresh, { ...baseOptions(), path: `${API_BASE_PATH}/auth` });
}

export function clearGuestCookie(res: Response): void {
  res.clearCookie(COOKIE_NAMES.guest, { ...baseOptions(), path: '/' });
}
