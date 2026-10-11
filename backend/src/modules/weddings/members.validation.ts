/**
 * api_design.docx §9: invite/add, list, update role, remove wedding members.
 */
import { z } from 'zod';

import { emailSchema, objectIdSchema } from '#core/http/schemas.js';

import { MEMBER_ROLE } from './members.model.js';
import { weddingIdParamsSchema } from './weddings.validation.js';

export const addMemberBodySchema = z
  .object({
    email: emailSchema,
    role: z.enum(MEMBER_ROLE),
  })
  .strict();

export type AddMemberBody = z.infer<typeof addMemberBodySchema>;

export const updateMemberBodySchema = z
  .object({
    role: z.enum(MEMBER_ROLE),
  })
  .strict();

export type UpdateMemberBody = z.infer<typeof updateMemberBodySchema>;

export const memberIdParamsSchema = weddingIdParamsSchema
  .extend({
    memberId: objectIdSchema,
  })
  .strict();

export type MemberIdParams = z.infer<typeof memberIdParamsSchema>;
