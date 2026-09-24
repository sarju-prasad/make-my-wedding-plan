/**
 * CSRF defense via Origin validation — api_design.docx §5 ("Use Origin
 * validation and SameSite controls for CSRF protection; reassess explicit
 * CSRF tokens if the deployment requires them").
 *
 * Every wedding-member AND guest session is a cookie (api_design.docx §6.2:
 * the guest invitation token "is exchanged for a short-lived guest HttpOnly
 * cookie"), so both authentication paths carry the same forged-request risk
 * this middleware defends against — it applies uniformly to both, with no
 * per-route opt-in required. Mounted globally in app.ts so a new route can
 * never simply forget to add it.
 *
 * Only state-changing methods are checked; GET/HEAD/OPTIONS cannot mutate
 * state and are exempt by definition.
 *
 * A state-changing request with neither an Origin nor a Referer header is
 * rejected. Modern browsers send Origin on every fetch/XHR state-changing
 * request, so the only callers this excludes are non-browser clients acting
 * on a cookie they should not possess in the first place. If a legitimate
 * non-browser integration is added later (none exists in V1), it should
 * authenticate some other way rather than loosening this default.
 */
import type { NextFunction, Request, RequestHandler, Response } from 'express';

import { env } from '#config/env.js';
import { AppError } from '#core/errors/index.js';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

const allowedOrigins = new Set(env.CORS_ALLOWED_ORIGINS);

function extractOrigin(value: string): string | null {
  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
}

export const originCheck: RequestHandler = (
  req: Request,
  _res: Response,
  next: NextFunction,
): void => {
  if (SAFE_METHODS.has(req.method)) {
    next();
    return;
  }

  const originHeader = req.headers.origin;
  const refererHeader = req.headers.referer;

  const candidate = originHeader ?? (refererHeader ? extractOrigin(refererHeader) : null);

  if (candidate && allowedOrigins.has(candidate)) {
    next();
    return;
  }

  next(AppError.forbidden('This request could not be verified as coming from an allowed origin.'));
};
