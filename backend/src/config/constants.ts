/**
 * Application-wide constants.
 *
 * Responsibility
 * --------------
 * Values that are fixed by the design documents rather than by deployment.
 * Anything that varies per environment belongs in env.ts instead.
 *
 * Every constant here is traceable to a source document. Domain enums (roles,
 * statuses, categories) deliberately live with their owning module, not here.
 */

/** Mounted base path for every versioned route. api_design §1. */
export const API_BASE_PATH = '/api/v1';

/**
 * Photo upload limits. PRD §34, §51.16–§51.18; api_design §13.
 * Enforced server-side before a presigned R2 URL is issued, and re-checked
 * against the stored object's metadata at finalisation.
 */
export const MAX_PHOTOS_PER_UPLOAD = 10;
export const MAX_PHOTO_BYTES = 10 * 1024 * 1024;
export const ALLOWED_PHOTO_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;

/**
 * Pagination ceiling. api_design §17. Defaults (page 1, limit 20) are not
 * duplicated here — they live once, on the schema itself, in
 * core/http/pagination.ts.
 */
export const MAX_PAGE_LIMIT = 100;

/**
 * Request body ceiling. Photo bytes never transit this API — uploads go
 * directly to R2 via presigned URLs (system_design_architecture.pdf §12) — so
 * no endpoint legitimately needs a large JSON body.
 */
export const JSON_BODY_LIMIT = '100kb';

/** Header used to correlate a request across every log line it produces. */
export const REQUEST_ID_HEADER = 'x-request-id';
