/**
 * Stable API error codes.
 *
 * Seeded with the exact set from api_design.docx §19. Extend this enum as
 * modules are built — never invent an ad-hoc string code inline at a throw
 * site, or the error contract silently fragments across the codebase.
 */
export const ErrorCode = {
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  NOT_FOUND: 'NOT_FOUND',
  WEDDING_NOT_FOUND: 'WEDDING_NOT_FOUND',
  EVENT_NOT_FOUND: 'EVENT_NOT_FOUND',
  INVITATION_EXPIRED: 'INVITATION_EXPIRED',
  INVITATION_REVOKED: 'INVITATION_REVOKED',
  DUPLICATE_RESOURCE: 'DUPLICATE_RESOURCE',
  RATE_LIMITED: 'RATE_LIMITED',
  STORAGE_UPLOAD_FAILED: 'STORAGE_UPLOAD_FAILED',
  EMAIL_SEND_FAILED: 'EMAIL_SEND_FAILED',
  SERVICE_UNAVAILABLE: 'SERVICE_UNAVAILABLE',
  INTERNAL_SERVER_ERROR: 'INTERNAL_SERVER_ERROR',
} as const;

export type ErrorCode = (typeof ErrorCode)[keyof typeof ErrorCode];
