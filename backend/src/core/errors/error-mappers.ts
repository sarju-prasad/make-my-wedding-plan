/**
 * Converts exceptions thrown by third-party layers (Zod, Mongoose, the MongoDB
 * driver) into AppError, so the centralized handler only ever has to deal with
 * one error shape. See api_design.docx §22 — duplicate-key errors in
 * particular must become a stable DUPLICATE_RESOURCE response, not a 500.
 */
import { Error as MongooseError } from 'mongoose';
import { ZodError } from 'zod';

import { AppError } from './app-error.js';
import { ErrorCode } from './error-codes.js';

/** `ZodError['issues'][number]` avoids the deprecated standalone `ZodIssue` export. */
type ZodIssue = ZodError['issues'][number];

interface MongoServerErrorLike {
  name: string;
  code?: number;
  keyPattern?: Record<string, unknown>;
  keyValue?: Record<string, unknown>;
}

function isMongoServerError(error: unknown): error is MongoServerErrorLike {
  return (
    typeof error === 'object' &&
    error !== null &&
    'name' in error &&
    error.name === 'MongoServerError'
  );
}

/**
 * True when `error` is a duplicate-key violation (E11000) on exactly the
 * given field (or, for a compound unique index, exactly the given set of
 * fields — e.g. wedding_members' `{weddingId, userId}` index). For a
 * module-specific translation (e.g. auth.service.ts turning a `users.email`
 * collision into EMAIL_ALREADY_EXISTS) — this mapper deliberately does NOT
 * special-case field names itself, since it's shared by every model in the
 * app and a field name alone doesn't say which collection raised it (a
 * future model with its own unrelated single-field `email` index would
 * otherwise get mislabeled here too). Matching is exact and order-
 * independent: a 2-field compound index never matches a 1-field call and
 * vice versa, since a partial match would misidentify which constraint was
 * actually violated.
 */
export function isDuplicateKeyError(error: unknown, field: string | string[]): boolean {
  if (!isMongoServerError(error) || error.code !== 11000) return false;
  const violatedFields = Object.keys(error.keyPattern ?? {});
  const expectedFields = Array.isArray(field) ? field : [field];
  return (
    violatedFields.length === expectedFields.length &&
    expectedFields.every((f) => violatedFields.includes(f))
  );
}

/**
 * Connectivity failures, not data errors — the driver couldn't reach a
 * server at all. Detected by name rather than `instanceof` so this module
 * doesn't need a direct dependency on the `mongodb` driver package purely
 * for its error classes; mongoose re-exports the driver, and its errors are
 * unambiguous by name.
 */
const MONGO_CONNECTIVITY_ERROR_NAMES = new Set([
  'MongoNetworkError',
  'MongoServerSelectionError',
  'MongoNotConnectedError',
  'MongoTimeoutError',
]);

function isMongoConnectivityError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'name' in error &&
    MONGO_CONNECTIVITY_ERROR_NAMES.has(error.name as string)
  );
}

/**
 * express.json()/express.urlencoded() (both backed by body-parser, which
 * builds every error it throws via the `http-errors` package) throw before
 * any route handler — and therefore before `validate()` ever runs — gets a
 * chance to see the request: a malformed body, one over
 * config/constants.ts's JSON_BODY_LIMIT, an unsupported charset/content
 * encoding, or the client aborting mid-upload all take this path. Without
 * this, every one of them came back as a generic 500 (an unrecognised Error
 * falls through to AppError.internal()) instead of the 4xx they actually
 * are, and got logged as server bugs rather than ordinary client-request
 * problems.
 *
 * Keyed on `status`/`expose` — the fields http-errors always sets, verified
 * directly against the installed version — rather than on body-parser's own
 * per-case `type` strings (`entity.parse.failed`, `entity.too.large`,
 * `charset.unsupported`, …). Enumerating each `type` individually means a
 * case this file's author didn't think of (or a future body-parser version
 * adding a new one) silently falls through to the generic 500 this exists
 * to avoid; `status`/`expose` cover all of them at once, including ones
 * from any other http-errors-based middleware, not just this one.
 * `expose` is http-errors' own signal for whether `.message` is safe to
 * show a client (true for 4xx, false for 5xx) — reused here rather than
 * re-deciding that per error.
 */
interface HttpErrorLike {
  status: number;
  expose: boolean;
  message: string;
}

function isHttpError(error: unknown): error is HttpErrorLike {
  if (typeof error !== 'object' || error === null) return false;
  const { status, expose } = error as Record<string, unknown>;
  return typeof status === 'number' && status >= 400 && status < 500 && typeof expose === 'boolean';
}

function formatZodIssues(issues: ZodIssue[]): { path: string; message: string }[] {
  return issues.map((issue) => ({
    path: issue.path.join('.') || '(root)',
    message: issue.message,
  }));
}

/**
 * Maps a known exception type to AppError. Returns null when the error is
 * not one of the recognised types, so the caller can fall back to
 * AppError.internal() with the original error preserved as `cause`.
 */
export function mapKnownError(error: unknown): AppError | null {
  if (error instanceof AppError) {
    return error;
  }

  if (error instanceof ZodError) {
    return AppError.validation('Request validation failed.', formatZodIssues(error.issues));
  }

  if (isHttpError(error)) {
    const code = error.status === 413 ? ErrorCode.PAYLOAD_TOO_LARGE : ErrorCode.MALFORMED_REQUEST;
    return new AppError({
      code,
      httpStatus: error.status,
      message: error.expose ? error.message : 'The request could not be processed.',
    });
  }

  if (error instanceof MongooseError.CastError) {
    return AppError.validation(`Invalid value for field "${error.path}".`, {
      path: error.path,
    });
  }

  if (error instanceof MongooseError.ValidationError) {
    const details = Object.values(error.errors).map((fieldError) => ({
      path: fieldError.path,
      message: fieldError.message,
    }));
    return AppError.validation('Document failed schema validation.', details);
  }

  // Thrown by `.save()` on a document whose schema has `optimisticConcurrency:
  // true` (weddings.model.ts) when another write landed first — e.g. two
  // concurrent PATCH requests, each computed from the same stale read of a
  // field neither of them was actually changing (weddings.service.ts's
  // updateWedding() reconciling weddingDate/timezone when only one was
  // supplied). A 409 telling the client to refresh and retry is correct
  // here; silently letting the second save win would reintroduce exactly
  // the "stored value mismatched with what it was derived from" bug that
  // logic exists to prevent.
  if (error instanceof MongooseError.VersionError) {
    return AppError.conflict(
      'This record was changed by someone else. Please refresh and try again.',
      ErrorCode.CONCURRENT_UPDATE,
    );
  }

  // Duplicate-key violations (E11000) surface unique-index conflicts, such as
  // one active invitation per guest per wedding — see db_design.docx §7.
  // Module-specific translations (e.g. users.email -> EMAIL_ALREADY_EXISTS)
  // happen at the call site via isDuplicateKeyError() above, not here — this
  // mapper is shared by every model and has no way to know which collection
  // raised a given field-name collision.
  if (isMongoServerError(error) && error.code === 11000) {
    const fields = Object.keys(error.keyPattern ?? {});
    return AppError.duplicate('This resource already exists.', { fields });
  }

  // Atlas unreachable / selection timeout — a dependency outage, not a bug in
  // this codebase. system_design_architecture.pdf §15 asks for a controlled
  // 503 here rather than a generic 500.
  if (isMongoConnectivityError(error)) {
    return AppError.serviceUnavailable('The database is temporarily unavailable.');
  }

  return null;
}

/** Always returns an AppError — the terminal step before the response is sent. */
export function toAppError(error: unknown): AppError {
  const known = mapKnownError(error);
  if (known) return known;

  if (error instanceof Error) {
    return AppError.internal(error.message, error);
  }

  return AppError.internal('An unknown error occurred.', error);
}

export { ErrorCode };
