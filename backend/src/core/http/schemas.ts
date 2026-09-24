/**
 * Shared Zod primitives, reused across every module's validation schemas so
 * the same rule (and the same OpenAPI shape) is never redefined twice.
 *
 * api_design.docx §18: validate ObjectId-like route params before hitting the
 * database, trim and normalise emails, validate timezones and URLs.
 */
import { z } from 'zod';

/** Matches a MongoDB ObjectId's 24-character hex representation exactly. */
const OBJECT_ID_PATTERN = /^[0-9a-fA-F]{24}$/;

export const objectIdSchema = z.string().regex(OBJECT_ID_PATTERN, 'Must be a valid identifier.');

/** Trims and lowercases before validating — the same normalisation applied at write time. */
export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(z.email('Must be a valid email address.'));

/**
 * Validated by attempting to construct an Intl.DateTimeFormat rather than by
 * checking membership in Intl.supportedValuesOf('timeZone').
 *
 * That list is ICU-build-dependent and was found, on the Node version this
 * project targets, to contain the legacy alias "Asia/Calcutta" but not the
 * canonical "Asia/Kolkata" — the exact identifier api_design.docx §8.2 uses
 * as its own example. The formatter constructor resolves both correctly.
 */
function isConstructibleTimeZone(value: string): boolean {
  try {
    Intl.DateTimeFormat(undefined, { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

export const ianaTimezoneSchema = z.string().superRefine((value, ctx) => {
  if (!isConstructibleTimeZone(value)) {
    ctx.addIssue({ code: 'custom', message: `"${value}" is not a recognised IANA timezone.` });
  }
});

export const httpsUrlSchema = z
  .string()
  .trim()
  .pipe(z.url({ protocol: /^https$/, message: 'Must be a valid HTTPS URL.' }));

/** Money is stored as an integer count of paise — db_design.docx §5 (expenses). */
export const amountPaiseSchema = z.number().int().nonnegative();

export const nonEmptyTrimmedString = z.string().trim().min(1, 'This field is required.');
