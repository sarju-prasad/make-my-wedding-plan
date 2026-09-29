/**
 * Verifies the access-token cookie and sets `req.userId`. Deliberately
 * stateless — no DB round trip on every request (see modules/auth/auth.tokens.ts):
 * the access token is short-lived (15 min) and a tokenVersion bump takes
 * effect the next time the client refreshes, per api_design.docx §5.4.
 *
 * Resolving wedding membership (`req.auth` — weddingId/role) is a separate
 * step, done by middleware/load-membership.ts on wedding-scoped routes only
 * — see core/types/express.ts for why the two are split.
 */
import type { NextFunction, Request, RequestHandler, Response } from 'express';

import { AppError } from '#core/errors/index.js';

import { verifyAccessToken } from '../modules/auth/auth.tokens.js';

import { COOKIE_NAMES } from './cookies.js';

export const authenticate: RequestHandler = (
  req: Request,
  _res: Response,
  next: NextFunction,
): void => {
  const token = req.cookies[COOKIE_NAMES.access] as string | undefined;
  if (!token) {
    next(AppError.unauthorized());
    return;
  }

  verifyAccessToken(token)
    .then(({ userId }) => {
      req.userId = userId;
      next();
    })
    .catch((error: unknown) => {
      next(error);
    });
};
