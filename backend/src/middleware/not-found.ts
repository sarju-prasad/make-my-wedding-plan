/**
 * Catch-all for requests that matched no route. Mounted after /api/v1 and
 * before the centralized error handler.
 */
import type { NextFunction, Request, Response } from 'express';

import { AppError } from '#core/errors/index.js';

export function notFound(req: Request, _res: Response, next: NextFunction): void {
  next(AppError.notFound(`No route matches ${req.method} ${req.originalUrl}.`));
}
