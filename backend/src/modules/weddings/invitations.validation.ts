/**
 * Closes backend/CLAUDE.md's open decision G1 — see invitations.model.ts.
 */
import { z } from 'zod';

import { emailSchema, objectIdSchema } from '#core/http/schemas.js';

import { MEMBER_ROLE } from './members.model.js';
import { weddingIdParamsSchema } from './weddings.validation.js';

export const createInvitationBodySchema = z
  .object({
    email: emailSchema,
    role: z.enum(MEMBER_ROLE),
  })
  .strict();

export type CreateInvitationBody = z.infer<typeof createInvitationBodySchema>;

export const invitationIdParamsSchema = weddingIdParamsSchema
  .extend({ invitationId: objectIdSchema })
  .strict();

export type InvitationIdParams = z.infer<typeof invitationIdParamsSchema>;

// 64 lowercase hex characters — 32 raw bytes from invitations.token.ts's
// generateInvitationToken(), not an ObjectId (24 hex chars), so this gets
// its own pattern rather than reusing objectIdSchema.
const INVITATION_TOKEN_PATTERN = /^[0-9a-f]{64}$/;

// Sent in the request body, not a URL param — see weddings.routes.ts for
// why (a token in the URL path ends up verbatim in the access logs; a
// token in the body doesn't, matching /auth/reset-password).
export const invitationTokenBodySchema = z
  .object({
    token: z.string().regex(INVITATION_TOKEN_PATTERN, 'Must be a valid invitation token.'),
  })
  .strict();

export type InvitationTokenBody = z.infer<typeof invitationTokenBodySchema>;
