/**
 * Maps R2/S3 SDK failures to AppError, so a storage-layer exception never
 * reaches a controller as a raw AWS SDK error (which would leak internal
 * detail through error-mappers.ts's generic fallback — api_design.docx §20:
 * "do not leak stack traces or internal database information").
 */
import { AppError, ErrorCode } from '../../core/errors/index.js';

interface S3ErrorLike {
  name: string;
  $metadata?: { httpStatusCode?: number };
}

function isS3Error(error: unknown): error is S3ErrorLike {
  return typeof error === 'object' && error !== null && 'name' in error && '$metadata' in error;
}

/** Connectivity/throttling — safe to retry, not the caller's fault. */
const RETRYABLE_ERROR_NAMES = new Set([
  'TimeoutError',
  'NetworkingError',
  'RequestTimeout',
  'SlowDown',
]);

export function mapR2Error(error: unknown, context: string): AppError {
  if (isS3Error(error)) {
    if (RETRYABLE_ERROR_NAMES.has(error.name)) {
      return AppError.serviceUnavailable('Photo storage is temporarily unavailable.');
    }

    return new AppError({
      code: ErrorCode.STORAGE_UPLOAD_FAILED,
      httpStatus: 502,
      message: `${context} failed.`,
      isOperational: true,
      cause: error,
    });
  }

  return AppError.internal(`${context} failed unexpectedly.`, error);
}
