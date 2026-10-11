/**
 * api_design.docx §8.1, §9. Wedding: create/list/view/update are
 * implemented — archive and restore are deferred (see
 * doc/project_status.md). PATCH is ADMIN-only: PRD §9 lists "manage wedding
 * information" under Admin's permissions and conspicuously not under
 * Manager's (§10), unlike create/list/view, which stay open to any ACTIVE
 * member.
 * Members: full invite/list/update-role/remove — the first real call site
 * for middleware/authorize.ts (backend/CLAUDE.md flagged this as unwired).
 * Invitations: closes open decision G1 — ADMIN-only create/list/revoke/
 * resend are wedding-scoped like Members; the preview/accept pair is
 * token-scoped instead (no :weddingId in the URL, since the token itself
 * determines the wedding), and accept is the only one requiring auth
 * without loadMembership — there's no membership yet to load.
 */
import { Router } from 'express';

import { paginationQuerySchema } from '#core/http/pagination.js';
import { authenticate } from '#middleware/authenticate.js';
import { authorize } from '#middleware/authorize.js';
import { loadMembership } from '#middleware/load-membership.js';
import { rateLimit } from '#middleware/rate-limit.js';
import { validate } from '#middleware/validate.js';

import {
  deleteInvitation,
  getInvitations,
  postAcceptInvitation,
  postInvitation,
  postInvitationPreview,
  postResendInvitation,
} from './invitations.controller.js';
import {
  createInvitationBodySchema,
  invitationIdParamsSchema,
  invitationTokenBodySchema,
} from './invitations.validation.js';
import { deleteMember, getMembers, patchMember, postMember } from './members.controller.js';
import {
  addMemberBodySchema,
  memberIdParamsSchema,
  updateMemberBodySchema,
} from './members.validation.js';
import {
  getMyWeddings,
  getWeddingById,
  patchWedding,
  postCreateWedding,
} from './weddings.controller.js';
import {
  createWeddingBodySchema,
  updateWeddingBodySchema,
  weddingIdParamsSchema,
} from './weddings.validation.js';

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

weddingsRouter.patch(
  '/weddings/:weddingId',
  authenticate,
  validate({ params: weddingIdParamsSchema, body: updateWeddingBodySchema }),
  loadMembership,
  authorize('ADMIN'),
  patchWedding,
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
  rateLimit('member:add'),
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

weddingsRouter.post(
  '/weddings/:weddingId/invitations',
  authenticate,
  rateLimit('invitation:create'),
  validate({ params: weddingIdParamsSchema, body: createInvitationBodySchema }),
  loadMembership,
  authorize('ADMIN'),
  postInvitation,
);

weddingsRouter.get(
  '/weddings/:weddingId/invitations',
  authenticate,
  validate({ params: weddingIdParamsSchema, query: paginationQuerySchema }),
  loadMembership,
  authorize('ADMIN'),
  getInvitations,
);

weddingsRouter.delete(
  '/weddings/:weddingId/invitations/:invitationId',
  authenticate,
  validate({ params: invitationIdParamsSchema }),
  loadMembership,
  authorize('ADMIN'),
  deleteInvitation,
);

weddingsRouter.post(
  '/weddings/:weddingId/invitations/:invitationId/resend',
  authenticate,
  rateLimit('invitation:resend'),
  validate({ params: invitationIdParamsSchema }),
  loadMembership,
  authorize('ADMIN'),
  postResendInvitation,
);

// Public/token-based — not wedding-scoped in the URL (the token itself
// determines the wedding), same shape as /auth/reset-password. POST with
// the token in the body rather than GET with it in the URL path, same
// reason /auth/reset-password does: a token in the URL path is written
// verbatim to the access logs (http-logger.ts logs req.url, and the
// redaction formatter only scrubs object keys, not substrings inside a URL
// string), a token in the body isn't. No loadMembership on either: the
// whole point is that no membership exists yet.
weddingsRouter.post(
  '/invitations/preview',
  validate({ body: invitationTokenBodySchema }),
  postInvitationPreview,
);

weddingsRouter.post(
  '/invitations/accept',
  authenticate,
  validate({ body: invitationTokenBodySchema }),
  postAcceptInvitation,
);
