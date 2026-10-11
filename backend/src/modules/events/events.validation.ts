/**
 * api_design.docx §10: name/startsAt/timezone required; validate
 * startsAt/endsAt ordering; store event timezone explicitly; venue may
 * contain name/address/coordinates/Maps URL; livestream URL must be
 * validated.
 */
import { z } from 'zod';

import {
  httpsUrlSchema,
  ianaTimezoneSchema,
  nonEmptyTrimmedString,
  objectIdSchema,
} from '#core/http/schemas.js';

// A full ISO 8601 date-time with an explicit offset (or "Z") — unlike
// weddings' bare date-only `weddingDate`, the request here already carries
// an unambiguous instant; `timezone` below is stored separately for
// display/reminder purposes (backend/CLAUDE.md: "reminders... in the
// event's own timezone"), not to disambiguate this string.
const eventDateTimeSchema = z.iso.datetime({
  offset: true,
  message: 'Must be a valid ISO 8601 date-time (e.g. 2026-10-20T10:00:00+05:30).',
});

export const createEventBodySchema = z
  .object({
    name: nonEmptyTrimmedString,
    startsAt: eventDateTimeSchema,
    endsAt: eventDateTimeSchema.optional(),
    timezone: ianaTimezoneSchema,
    description: z.string().trim().max(2000).optional(),
    venue: z
      .object({
        name: nonEmptyTrimmedString.optional(),
        address: nonEmptyTrimmedString.optional(),
        latitude: z.number().min(-90).max(90).optional(),
        longitude: z.number().min(-180).max(180).optional(),
        googleMapsUrl: httpsUrlSchema.optional(),
      })
      .strict()
      .optional(),
    livestream: z
      .object({
        url: httpsUrlSchema,
      })
      .strict()
      .optional(),
  })
  .strict()
  .transform((data, ctx) => {
    const startsAt = new Date(data.startsAt);
    const endsAt = data.endsAt ? new Date(data.endsAt) : undefined;
    if (endsAt && endsAt <= startsAt) {
      ctx.addIssue({
        code: 'custom',
        path: ['endsAt'],
        message: 'endsAt must be after startsAt.',
      });
      return z.NEVER;
    }
    return { ...data, startsAt, endsAt };
  });

export type CreateEventBody = z.infer<typeof createEventBodySchema>;

// Re-declared from the same shared `objectIdSchema` primitive rather than
// importing weddings.validation.ts's own weddingIdParamsSchema — Events is
// a separate top-level module (backend/CLAUDE.md: "modules talk through
// their public entry point"), and a validation schema isn't that module's
// designated entry point (weddings.service.ts's exported functions are).
export const weddingIdParamsSchema = z.object({ weddingId: objectIdSchema }).strict();

export type WeddingIdParams = z.infer<typeof weddingIdParamsSchema>;

export const eventIdParamsSchema = weddingIdParamsSchema
  .extend({ eventId: objectIdSchema })
  .strict();

export type EventIdParams = z.infer<typeof eventIdParamsSchema>;
