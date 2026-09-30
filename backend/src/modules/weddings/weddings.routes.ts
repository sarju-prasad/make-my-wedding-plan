/**
 * api_design.docx §8.1, §9. Wedding: only create/list/view are implemented —
 * update, archive, and restore are deferred (see doc/project_status.md).
 * Members: full invite/list/update-role/remove — the first real call site
 * for middleware/authorize.ts (backend/CLAUDE.md flagged this as unwired).
 */
import { Router } from 'express';

import { paginationQuerySchema } from '#core/http/pagination.js';
import { authenticate } from '#middleware/authenticate.js';
import { authorize } from '#middleware/authorize.js';
import { loadMembership } from '#middleware/load-membership.js';
import { validate } from '#middleware/validate.js';

import { deleteMember, getMembers, patchMember, postMember } from './members.controller.js';
import {
  addMemberBodySchema,
  memberIdParamsSchema,
  updateMemberBodySchema,
} from './members.validation.js';
import { getMyWeddings, getWeddingById, postCreateWedding } from './weddings.controller.js';
import { createWeddingBodySchema, weddingIdParamsSchema } from './weddings.validation.js';

export const weddingsRouter: Router = Router();

weddingsRouter.post(
  '/weddings',
  authenticate,
  validate({ body: createWeddingBodySchema }),
  postCreateWedding,
);

weddingsRouter.get(
  '/weddings',
  authenticate,
  validate({ query: paginationQuerySchema }),
  getMyWeddings,
);

weddingsRouter.get(
  '/weddings/:weddingId',
  authenticate,
  validate({ params: weddingIdParamsSchema }),
  loadMembership,
  getWeddingById,
);

weddingsRouter.get(
  '/weddings/:weddingId/members',
  authenticate,
  validate({ params: weddingIdParamsSchema, query: paginationQuerySchema }),
  loadMembership,
  getMembers,
);

weddingsRouter.post(
  '/weddings/:weddingId/members',
  authenticate,
  validate({ params: weddingIdParamsSchema, body: addMemberBodySchema }),
  loadMembership,
  authorize('ADMIN'),
  postMember,
);

weddingsRouter.patch(
  '/weddings/:weddingId/members/:memberId',
  authenticate,
  validate({ params: memberIdParamsSchema, body: updateMemberBodySchema }),
  loadMembership,
  authorize('ADMIN'),
  patchMember,
);

weddingsRouter.delete(
  '/weddings/:weddingId/members/:memberId',
  authenticate,
  validate({ params: memberIdParamsSchema }),
  loadMembership,
  authorize('ADMIN'),
  deleteMember,
);
