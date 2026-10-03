/**
 * Catch-all for requests that matched no route. Mounted after /api/v1 and
 * before the centralized error handler.
 */
import type { NextFunction, Request, Response } from 'express';

import { AppError } from '#core/errors/index.js';

export function notFound(req: Request, _res: Response, next: NextFunction): void {
  // req.path, not req.originalUrl — the latter includes the query string,
  // which this message would otherwise carry straight into the log (and the
  // client response) unredacted. deepRedact (core/logger/redaction.ts) only
  // scrubs sensitive data by object key, not by scanning arbitrary string
  // values, so a token accidentally pasted into a mistyped URL's query
  // string (e.g. the old GET /invitations/:token shape this app used to
  // have, or simply a fat-fingered path) would otherwise end up written to
  // the logs verbatim every time it 404s.
  next(AppError.notFound(`No route matches ${req.method} ${req.path}.`));
}
