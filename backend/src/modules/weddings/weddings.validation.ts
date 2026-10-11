/**
 * api_design.docx §8.2: name required; wedding date, timezone, and location
 * required; location must include address/latitude/longitude; timezone must
 * be a real IANA zone.
 */
import { DateTime } from 'luxon';
import { z } from 'zod';

import { ianaTimezoneSchema, nonEmptyTrimmedString, objectIdSchema } from '#core/http/schemas.js';

const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export const createWeddingBodySchema = z
  .object({
    name: nonEmptyTrimmedString,
    couple: z
      .object({
        partnerOneName: nonEmptyTrimmedString,
        partnerTwoName: nonEmptyTrimmedString,
      })
      .strict(),
    // A date-only string (matches <input type="date">, e.g. "2026-12-25"),
    // not `z.coerce.date()`: that would hand the string straight to `new
    // Date()`, which parses a bare date-only string as UTC midnight —
    // silently wrong for any wedding not in a UTC+0-ish zone (e.g.
    // "2026-12-25" in America/Los_Angeles becomes 2026-12-24T16:00 local,
    // the previous calendar day). Combined with `timezone` below, in the
    // transform, using Luxon — already a dependency — to interpret it as
    // midnight *in the wedding's own timezone* instead.
    weddingDate: z.string().regex(DATE_ONLY_PATTERN, 'Must be a date in YYYY-MM-DD format.'),
    timezone: ianaTimezoneSchema,
    location: z
      .object({
        address: nonEmptyTrimmedString,
        latitude: z.number().min(-90).max(90),
        longitude: z.number().min(-180).max(180),
      })
      .strict(),
    description: z.string().trim().max(2000).optional(),
    language: z.string().trim().min(1).optional(),
  })
  .strict()
  .transform((data, ctx) => {
    const weddingDate = DateTime.fromISO(data.weddingDate, { zone: data.timezone });
    if (!weddingDate.isValid) {
      ctx.addIssue({
        code: 'custom',
        path: ['weddingDate'],
        message: `Invalid date "${data.weddingDate}" for timezone "${data.timezone}".`,
      });
      return z.NEVER;
    }
    return { ...data, weddingDate: weddingDate.toJSDate() };
  });

export type CreateWeddingBody = z.infer<typeof createWeddingBodySchema>;

export const weddingIdParamsSchema = z.object({ weddingId: objectIdSchema }).strict();

export type WeddingIdParams = z.infer<typeof weddingIdParamsSchema>;

/**
 * PATCH /weddings/:weddingId — every top-level field is independently
 * optional (true partial update: supplying `timezone` alone must not touch
 * `location`, and is itself expected to produce a sensible result on its
 * own — "PATCH { timezone } -> only timezone changes"), but `couple`/
 * `location`, if supplied at all, must be given in full, exactly as
 * strictly as at creation — not deep-merged field-by-field. This isn't
 * just a simplification: a partial `location` (e.g. address only) would
 * leave latitude/longitude silently stale and potentially inconsistent
 * with the new address, which is worse than requiring the whole object.
 * `name`/`language`/`slug`/every system-controlled field are deliberately
 * absent from this schema (not merely optional) — `.strict()` rejects them
 * outright rather than silently ignoring them, same as create.
 *
 * Unlike createWeddingBodySchema, `weddingDate`/`timezone` are NOT combined
 * here: each is validated independently for its own shape only (a real
 * date-only string; a real IANA zone), with no cross-field transform. The
 * combination into a single absolute instant happens in
 * weddings.service.ts#updateWedding instead, because supplying only one of
 * the two needs the wedding's *existing* value for the other — reinterpret
 * the current calendar date in a newly-supplied timezone, or combine a
 * newly-supplied date with the existing timezone — and only the service
 * layer has the existing document loaded to do that combination correctly.
 */
export const updateWeddingBodySchema = z
  .object({
    name: nonEmptyTrimmedString.optional(),
    description: z.string().trim().max(2000).optional(),
    couple: z
      .object({
        partnerOneName: nonEmptyTrimmedString,
        partnerTwoName: nonEmptyTrimmedString,
      })
      .strict()
      .optional(),
    weddingDate: z
      .string()
      .regex(DATE_ONLY_PATTERN, 'Must be a date in YYYY-MM-DD format.')
      .optional(),
    timezone: ianaTimezoneSchema.optional(),
    location: z
      .object({
        address: nonEmptyTrimmedString,
        latitude: z.number().min(-90).max(90),
        longitude: z.number().min(-180).max(180),
      })
      .strict()
      .optional(),
  })
  .strict()
  .refine((data) => Object.keys(data).length > 0, {
    message: 'At least one field must be provided.',
  });

export type UpdateWeddingBody = z.infer<typeof updateWeddingBodySchema>;
