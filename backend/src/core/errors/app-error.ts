/**
 * AppError — the one error type every layer of the application is allowed to
 * throw intentionally. Anything else (a driver exception, a programming bug)
 * is caught by the mappers in error-mappers.ts and converted at the boundary.
 */
import { ErrorCode } from './error-codes.js';

export interface AppErrorOptions {
  code: ErrorCode;
  httpStatus: number;
  message: string;
  /**
   * Safe-to-expose structured detail (e.g. Zod field errors). Never put a
   * stack trace, token, or raw driver error here — it goes straight into the
   * HTTP response body.
   */
  details?: unknown;
  /**
   * Operational errors are expected failure modes (not found, validation,
   * conflict) and are safe to report with their own message. Non-operational
   * errors are programming bugs or unexpected exceptions — the centralized
   * handler logs them in full but reports a generic message to the client.
   */
  isOperational?: boolean;
  cause?: unknown;
}

export class AppError extends Error {
  readonly code: ErrorCode;
  readonly httpStatus: number;
  readonly details?: unknown;
  readonly isOperational: boolean;

  constructor(options: AppErrorOptions) {
    super(options.message, { cause: options.cause });
    this.name = 'AppError';
    this.code = options.code;
    this.httpStatus = options.httpStatus;
    this.details = options.details;
    this.isOperational = options.isOperational ?? true;

    Error.captureStackTrace(this, AppError);
  }

  static validation(message: string, details?: unknown): AppError {
    return new AppError({
      code: ErrorCode.VALIDATION_ERROR,
      httpStatus: 422,
      message,
      details,
    });
  }

  static unauthorized(message = 'Authentication is required.'): AppError {
    return new AppError({ code: ErrorCode.UNAUTHORIZED, httpStatus: 401, message });
  }

  static forbidden(message = 'You do not have permission to perform this action.'): AppError {
    return new AppError({ code: ErrorCode.FORBIDDEN, httpStatus: 403, message });
  }

  static notFound(
    message = 'Resource not found.',
    code: ErrorCode = ErrorCode.NOT_FOUND,
  ): AppError {
    return new AppError({ code, httpStatus: 404, message });
  }

  static duplicate(message = 'This resource already exists.', details?: unknown): AppError {
    return new AppError({
      code: ErrorCode.DUPLICATE_RESOURCE,
      httpStatus: 409,
      message,
      details,
    });
  }

  /** A 409 for a state conflict that isn't a duplicate-resource case (e.g. CANNOT_REMOVE_LAST_ADMIN). */
  static conflict(message: string, code: ErrorCode, details?: unknown): AppError {
    return new AppError({ code, httpStatus: 409, message, details });
  }

  /** api_design.docx §5.2 — a more specific 409 than duplicate() for the one endpoint that names it. */
  static emailAlreadyExists(message = 'An account with this email already exists.'): AppError {
    return new AppError({ code: ErrorCode.EMAIL_ALREADY_EXISTS, httpStatus: 409, message });
  }

  /** 403 — the authenticated caller's own email doesn't match who an invitation was addressed to. Not FORBIDDEN's generic "no permission" code: the caller is a real, valid account, just the wrong one for this specific invitation. */
  static emailMismatch(
    message = 'This invitation was sent to a different email address.',
  ): AppError {
    return new AppError({ code: ErrorCode.EMAIL_MISMATCH, httpStatus: 403, message });
  }

  static rateLimited(message = 'Too many requests. Please try again later.'): AppError {
    return new AppError({ code: ErrorCode.RATE_LIMITED, httpStatus: 429, message });
  }

  static serviceUnavailable(message = 'A required service is temporarily unavailable.'): AppError {
    return new AppError({
      code: ErrorCode.SERVICE_UNAVAILABLE,
      httpStatus: 503,
      message,
      isOperational: true,
    });
  }

  /** For unexpected, non-operational failures — logged in full, reported generically. */
  static internal(message = 'Something went wrong.', cause?: unknown): AppError {
    return new AppError({
      code: ErrorCode.INTERNAL_SERVER_ERROR,
      httpStatus: 500,
      message,
      isOperational: false,
      cause,
    });
  }
}
