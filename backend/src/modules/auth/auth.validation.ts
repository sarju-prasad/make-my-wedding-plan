/**
 * api_design.docx §5.2–§5.3, §5.5: register/login/forgot-password/
 * reset-password request bodies. `.strict()` on each — api_design.docx §18
 * ("Reject unknown fields where appropriate").
 */
import { z } from 'zod';

import { emailSchema, nonEmptyTrimmedString } from '#core/http/schemas.js';

/**
 * Minimum length only — a full complexity/strength policy isn't specified by
 * any source document. 8 is a reasonable scaffold default (like
 * middleware/rate-limit.ts's policy numbers), not a considered product
 * decision; revisit if/when one is made.
 */
const passwordSchema = z.string().min(8, 'Password must be at least 8 characters.');

export const registerBodySchema = z
  .object({
    name: nonEmptyTrimmedString,
    email: emailSchema,
    password: passwordSchema,
  })
  .strict();

export type RegisterBody = z.infer<typeof registerBodySchema>;

export const loginBodySchema = z
  .object({
    email: emailSchema,
    // Deliberately not re-validated against passwordSchema's min length: a
    // stored hash predates any future password-policy change, and a generic
    // "invalid credentials" response is required either way (api_design.docx
    // §5.3) — the comparison itself is what should reject a short password,
    // not a schema check that would leak which login field failed.
    password: nonEmptyTrimmedString,
  })
  .strict();

export type LoginBody = z.infer<typeof loginBodySchema>;

export const forgotPasswordBodySchema = z
  .object({
    email: emailSchema,
  })
  .strict();

export type ForgotPasswordBody = z.infer<typeof forgotPasswordBodySchema>;

export const resetPasswordBodySchema = z
  .object({
    token: nonEmptyTrimmedString,
    password: passwordSchema,
  })
  .strict();

export type ResetPasswordBody = z.infer<typeof resetPasswordBodySchema>;
