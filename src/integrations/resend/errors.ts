/**
 * Maps Resend SDK failures to AppError.
 *
 * Verified against the installed SDK's types: `resend.emails.send()` does
 * NOT throw for API-level failures — it resolves to `{ data, error }`,
 * where `error` is `null` on success or `{ message, statusCode, name }` on
 * failure. Only a true network-level failure (DNS, connection refused)
 * rejects the promise. Both paths are handled here; the future
 * `sendEmail()` wrapper (see client.ts) must check `result.error` itself —
 * a try/catch alone will not observe an API-level failure.
 */
import { AppError, ErrorCode } from '../../core/errors/index.js';

interface ResendErrorResponse {
  message: string;
  statusCode: number | null;
  name: string;
}

const RATE_LIMITED_ERROR_NAMES = new Set([
  'rate_limit_exceeded',
  'daily_quota_exceeded',
  'monthly_quota_exceeded',
]);

/** For the `{ data: null, error }` result shape — the documented, common case. */
export function mapResendErrorResponse(error: ResendErrorResponse, context: string): AppError {
  if (RATE_LIMITED_ERROR_NAMES.has(error.name)) {
    return AppError.rateLimited('Email sending limit reached. Please try again later.');
  }

  return new AppError({
    code: ErrorCode.EMAIL_SEND_FAILED,
    httpStatus: 502,
    message: `${context} failed: ${error.message}`,
    isOperational: true,
    details: { resendErrorCode: error.name },
  });
}

/** For a rejected promise — network-level failure, not an API response at all. */
export function mapResendException(error: unknown, context: string): AppError {
  return new AppError({
    code: ErrorCode.EMAIL_SEND_FAILED,
    httpStatus: 502,
    message: `${context} failed unexpectedly.`,
    isOperational: true,
    cause: error,
  });
}
