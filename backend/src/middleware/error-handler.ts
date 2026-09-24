/**
 * Centralized error handler — must be the last middleware mounted, and must
 * keep all four parameters (`err, req, res, next`) or Express will not
 * recognise it as an error handler regardless of position.
 *
 * api_design.docx §3.3 / §19; system_design_architecture.pdf §15:
 *   - Every error becomes the standard { success: false, error: {...} } body.
 *   - Operational errors (AppError with isOperational: true) report their own
 *     message — these are expected outcomes like NOT_FOUND or VALIDATION_ERROR.
 *   - Non-operational errors (programming bugs, unexpected exceptions) are
 *     logged in full, including the stack, but the client only ever sees a
 *     generic message — never a stack trace, driver error, or internal detail.
 *   - `details` is safe-to-expose structured data only (e.g. Zod field
 *     errors); AppError enforces this is set deliberately, never by accident.
 */
import type { NextFunction, Request, Response } from 'express';

import { isProduction } from '#config/env.js';

import { toAppError } from '../core/errors/index.js';
import type { ErrorBody } from '../core/http/response.js';
import { logger } from '../core/logger/logger.js';

// Express identifies an error handler purely by arity (4 formal parameters),
// so `next` must stay declared even on the branch that doesn't call it.
export function errorHandler(err: unknown, req: Request, res: Response, next: NextFunction): void {
  const appError = toAppError(err);

  // req.log is set by httpLogger (middleware/http-logger.ts), which is
  // mounted first in app.ts specifically so it runs before anything capable
  // of throwing. It should therefore always be present — but this handler is
  // the last line of defence, so it falls back to the base logger rather
  // than risk an optional-chained no-op silently dropping an error report.
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- defensive fallback if pino-http was ever bypassed (e.g. a handler-level unit test)
  const log = req.log ?? logger;
  const logPayload = {
    err: appError,
    code: appError.code,
    httpStatus: appError.httpStatus,
    requestId: req.id,
  };

  if (appError.isOperational) {
    log.warn(logPayload, appError.message);
  } else {
    // Non-operational: a real bug or unexpected failure. Always logged in
    // full server-side, regardless of environment.
    log.error(logPayload, appError.message);
  }

  const clientMessage =
    !appError.isOperational && isProduction
      ? 'Something went wrong. Please try again.'
      : appError.message;

  const body: ErrorBody = {
    success: false,
    error: {
      code: appError.code,
      message: clientMessage,
      ...(appError.details !== undefined ? { details: appError.details } : {}),
    },
  };

  if (res.headersSent) {
    // Response already started streaming — delegate to Express's default
    // handler, which closes the connection instead of attempting a second
    // (and now malformed) response.
    next(err);
    return;
  }

  res.status(appError.httpStatus).json(body);
}
