/**
 * The one place `httpOnly` / `secure` / `sameSite` / `path` / `domain` are
 * decided for each of the three cookie types this app issues. Nothing else
 * should call `res.cookie()` / `res.clearCookie()` directly — ad hoc cookie
 * options are exactly how a security decision quietly drifts between routes.
 *
 * api_design.docx §5:
 *   - Access cookie path: /
 *   - Refresh cookie path: /api/v1/auth — exactly what the doc specifies,
 *     verbatim. This is coarser than "least privilege" for the refresh
 *     cookie might suggest: cookie `Path` only does prefix matching, and
 *     every `/auth/*` route (register, login, me, forgot/reset-password)
 *     shares this same prefix, so the browser attaches the refresh cookie
 *     to all of them, not just /auth/refresh and /auth/logout — there's no
 *     narrower Path that still covers just those two without restructuring
 *     the endpoint paths themselves, which the doc fixes. Still meaningfully
 *     narrower than Path=/ (excludes every wedding-scoped and future
 *     non-auth route), just not as narrow as "only refresh/logout".
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

/**
 * The cookie's own maxAge is deliberately the REFRESH TTL, not the access
 * TTL the JWT inside it actually expires on. A browser enforces a cookie's
 * Max-Age itself and simply stops sending it once that's passed — if this
 * matched JWT_ACCESS_TTL, the cookie would vanish from the browser at
 * essentially the same instant the JWT's own `exp` claim lapses, so the
 * backend would see no cookie at all on the next request (AppError.
 * unauthorized(), the "logged out" case) rather than an expired one
 * (AppError.accessTokenExpired() — auth.tokens.ts) — a plain 401 lib/api.ts's
 * apiFetch correctly does NOT retry, since there's nothing to refresh.
 * Verified this isn't just theoretical: both the integration and unit
 * tests for the expired-token path attach an expired JWT as a cookie
 * *directly*, bypassing the browser's own Max-Age enforcement entirely —
 * a real browser would have already discarded that cookie before ever
 * sending the request.
 *
 * Keeping the cookie itself alive past the JWT's own expiry is safe: the
 * JWT's `exp` claim is still checked, cryptographically, on every single
 * request (verifyAccessToken) — only the cookie's own lifetime changes,
 * which exists purely so the browser keeps *transporting* an
 * already-expired token long enough for the backend to tell the client
 * "this specific token expired" (triggering refresh-and-retry) instead of
 * "there's no session here at all". A logged-out visitor still has no
 * cookie regardless of this value, so the shared-IP rate-limit protection
 * (middleware/rate-limit.ts's auth:login-per-email reasoning applies the
 * same way here) is unaffected — and logout (clearAuthCookies below)
 * already removes this cookie outright, independent of any maxAge.
 */
export function setAccessCookie(res: Response, token: string): void {
  res.cookie(COOKIE_NAMES.access, token, {
    ...baseOptions(),
    path: '/',
    maxAge: parseDurationMs(env.JWT_REFRESH_TTL),
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
