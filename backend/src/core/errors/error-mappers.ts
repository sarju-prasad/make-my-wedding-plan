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

  // Duplicate-key violations (E11000) surface unique-index conflicts, such as
  // one active invitation per guest per wedding — see db_design.docx §7.
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
