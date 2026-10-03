import { z } from 'zod';

import {
  commonErrorResponses,
  listEnvelope,
  registerModulePaths,
  successEnvelope,
} from '#config/openapi.js';

import { INVITATION_STATUS } from './invitations.model.js';
import { createInvitationBodySchema, invitationTokenBodySchema } from './invitations.validation.js';
import { MEMBER_ROLE } from './members.model.js';
import { addMemberBodySchema, updateMemberBodySchema } from './members.validation.js';
import { WEDDING_STATUS } from './weddings.model.js';
// The request body is imported directly from the schema that actually
// validates it — see auth.openapi.ts for why (two independent copies can
// only drift). zod-openapi documents a `.transform()`-ed schema's *input*
// shape for a requestBody (verified directly against the installed
// version), so createWeddingBodySchema's weddingDate stays documented as
// the date-only string clients actually send, not the Date it transforms
// into internally.
import { createWeddingBodySchema, updateWeddingBodySchema } from './weddings.validation.js';

const weddingSchema = z.object({
  id: z.string(),
  name: z.string(),
  slug: z.string(),
  couple: z.object({ partnerOneName: z.string(), partnerTwoName: z.string() }),
  weddingDate: z.iso.datetime(),
  timezone: z.string(),
  location: z.object({ address: z.string(), latitude: z.number(), longitude: z.number() }),
  // Optional and unset by default — Mongoose omits the key entirely rather
  // than storing null when a non-required field was never set, so this is
  // `.optional()` (key may be absent), not `.nullable()` (see archivedAt/
  // archivedBy above for the contrasting case, which do default to null).
  description: z.string().optional(),
  language: z.string(),
  status: z.enum(WEDDING_STATUS),
  // From the soft-archive plugin (db/plugins/soft-archive.ts) — weddings.model.ts
  // applies it, and toJsonPlugin has no `hide` list for this model, so all
  // three are genuinely present on every response. Documented here for
  // exactly that reason: leaving them out (as this file previously did)
  // made `additionalProperties: false` reject the server's actual output.
  isArchived: z.boolean(),
  archivedAt: z.iso.datetime().nullable(),
  archivedBy: z.string().nullable(),
  createdBy: z.string(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});

const weddingResponse = successEnvelope('WeddingResponse', z.object({ wedding: weddingSchema }));
const weddingListResponse = listEnvelope('WeddingListResponse', weddingSchema);

const memberSchema = z.object({
  id: z.string(),
  userId: z.string(),
  name: z.string(),
  email: z.string(),
  role: z.enum(MEMBER_ROLE),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});

const memberResponse = successEnvelope('MemberResponse', z.object({ member: memberSchema }));
const memberListResponse = listEnvelope('MemberListResponse', memberSchema);

const invitationSchema = z.object({
  id: z.string(),
  email: z.string(),
  role: z.enum(MEMBER_ROLE),
  status: z.enum(INVITATION_STATUS),
  isExpired: z.boolean(),
  expiresAt: z.iso.datetime(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});

// `devInviteUrl` is only ever present outside production, when no email
// provider is configured — same non-production dev fallback as
// auth.openapi.ts's forgot-password response.
const invitationActionResponse = successEnvelope(
  'InvitationActionResponse',
  z.object({
    invitation: invitationSchema,
    emailSent: z.boolean(),
    devInviteUrl: z.url().optional(),
  }),
);
const invitationListResponse = listEnvelope('InvitationListResponse', invitationSchema);

const invitationPreviewSchema = z.object({
  email: z.string(),
  role: z.enum(MEMBER_ROLE),
  status: z.enum(INVITATION_STATUS),
  isExpired: z.boolean(),
  weddingId: z.string(),
  weddingName: z.string(),
  couple: z.object({ partnerOneName: z.string(), partnerTwoName: z.string() }),
  invitedByName: z.string(),
});
const invitationPreviewResponse = successEnvelope(
  'InvitationPreviewResponse',
  z.object({ invitation: invitationPreviewSchema }),
);

const invitationAcceptResponse = successEnvelope(
  'InvitationAcceptResponse',
  z.object({ wedding: weddingSchema, role: z.enum(MEMBER_ROLE) }),
);

registerModulePaths({
  '/weddings': {
    post: {
      operationId: 'postWedding',
      summary: 'Create a wedding',
      description: 'The creator becomes the wedding’s initial ADMIN.',
      tags: ['Weddings'],
      security: [{ accessTokenCookie: [] }],
      requestBody: { content: { 'application/json': { schema: createWeddingBodySchema } } },
      responses: {
        '201': {
          description: 'The created wedding.',
          content: { 'application/json': { schema: weddingResponse } },
        },
        ...commonErrorResponses,
      },
    },
    get: {
      operationId: 'getWeddings',
      summary: 'List weddings the current user belongs to',
      tags: ['Weddings'],
      security: [{ accessTokenCookie: [] }],
      responses: {
        '200': {
          description: 'Paginated list of the caller’s weddings.',
          content: { 'application/json': { schema: weddingListResponse } },
        },
        '401': commonErrorResponses['401'],
      },
    },
  },
  '/weddings/{weddingId}': {
    get: {
      operationId: 'getWedding',
      summary: 'Get wedding details',
      tags: ['Weddings'],
      security: [{ accessTokenCookie: [] }],
      responses: {
        '200': {
          description: 'The wedding.',
          content: { 'application/json': { schema: weddingResponse } },
        },
        '401': commonErrorResponses['401'],
        '404': commonErrorResponses['404'],
      },
    },
    patch: {
      operationId: 'patchWedding',
      summary: 'Update wedding details',
      description:
        'ADMIN only (PRD §9/§10: Admin manages wedding information, Manager does not). Partial update — only supplied top-level fields change. `couple`/`location`, if supplied, must be given in full (not merged field-by-field). `weddingDate`/`timezone` may be supplied independently — supplying only one reinterprets the wedding’s existing value for the other. `slug` is immutable and not accepted here.',
      tags: ['Weddings'],
      security: [{ accessTokenCookie: [] }],
      requestBody: { content: { 'application/json': { schema: updateWeddingBodySchema } } },
      responses: {
        '200': {
          description: 'The updated wedding.',
          content: { 'application/json': { schema: weddingResponse } },
        },
        '401': commonErrorResponses['401'],
        '403': commonErrorResponses['403'],
        '404': commonErrorResponses['404'],
        '422': commonErrorResponses['422'],
      },
    },
  },
  '/weddings/{weddingId}/members': {
    get: {
      operationId: 'getWeddingMembers',
      summary: 'List a wedding’s active members',
      tags: ['Members'],
      security: [{ accessTokenCookie: [] }],
      responses: {
        '200': {
          description: 'Paginated list of the wedding’s active members.',
          content: { 'application/json': { schema: memberListResponse } },
        },
        '401': commonErrorResponses['401'],
        '404': commonErrorResponses['404'],
        '422': commonErrorResponses['422'],
      },
    },
    post: {
      operationId: 'postWeddingMember',
      summary: 'Add an existing user as a member by email',
      description:
        'ADMIN only. Adds an already-registered user immediately — no email, no pending state. For someone without an account yet, use POST /weddings/{weddingId}/invitations instead.',
      tags: ['Members'],
      security: [{ accessTokenCookie: [] }],
      requestBody: { content: { 'application/json': { schema: addMemberBodySchema } } },
      responses: {
        '201': {
          description: 'The added (or reactivated) member.',
          content: { 'application/json': { schema: memberResponse } },
        },
        '401': commonErrorResponses['401'],
        '403': commonErrorResponses['403'],
        '404': commonErrorResponses['404'],
        '409': commonErrorResponses['409'],
        '422': commonErrorResponses['422'],
      },
    },
  },
  '/weddings/{weddingId}/members/{memberId}': {
    patch: {
      operationId: 'patchWeddingMember',
      summary: 'Change a member’s role',
      description: 'ADMIN only. Cannot demote the wedding’s only active Admin.',
      tags: ['Members'],
      security: [{ accessTokenCookie: [] }],
      requestBody: { content: { 'application/json': { schema: updateMemberBodySchema } } },
      responses: {
        '200': {
          description: 'The updated member.',
          content: { 'application/json': { schema: memberResponse } },
        },
        '401': commonErrorResponses['401'],
        '403': commonErrorResponses['403'],
        '404': commonErrorResponses['404'],
        '409': commonErrorResponses['409'],
        '422': commonErrorResponses['422'],
      },
    },
    delete: {
      operationId: 'deleteWeddingMember',
      summary: 'Remove a member',
      description: 'ADMIN only. Cannot remove the wedding’s only active Admin.',
      tags: ['Members'],
      security: [{ accessTokenCookie: [] }],
      responses: {
        '204': { description: 'The member was removed.' },
        '401': commonErrorResponses['401'],
        '403': commonErrorResponses['403'],
        '404': commonErrorResponses['404'],
        '409': commonErrorResponses['409'],
        '422': commonErrorResponses['422'],
      },
    },
  },
  '/weddings/{weddingId}/invitations': {
    post: {
      operationId: 'postWeddingInvitation',
      summary: 'Invite someone to join by email',
      description:
        'ADMIN only. Works for an email with no account yet, unlike POST /weddings/{weddingId}/members — sends an email with a single-use link via Resend. `emailSent: false` (with `devInviteUrl` outside production) means no email provider is configured; the invitation itself was still created and can be resent once one is.',
      tags: ['Invitations'],
      security: [{ accessTokenCookie: [] }],
      requestBody: { content: { 'application/json': { schema: createInvitationBodySchema } } },
      responses: {
        '201': {
          description: 'The created invitation.',
          content: { 'application/json': { schema: invitationActionResponse } },
        },
        '401': commonErrorResponses['401'],
        '403': commonErrorResponses['403'],
        '404': commonErrorResponses['404'],
        '409': commonErrorResponses['409'],
        '422': commonErrorResponses['422'],
      },
    },
    get: {
      operationId: 'getWeddingInvitations',
      summary: 'List a wedding’s pending invitations',
      description:
        'ADMIN only. Only PENDING invitations — an accepted one is reflected in the members list instead, and a revoked one is simply gone.',
      tags: ['Invitations'],
      security: [{ accessTokenCookie: [] }],
      responses: {
        '200': {
          description: 'Paginated list of the wedding’s pending invitations.',
          content: { 'application/json': { schema: invitationListResponse } },
        },
        '401': commonErrorResponses['401'],
        '403': commonErrorResponses['403'],
        '404': commonErrorResponses['404'],
        '422': commonErrorResponses['422'],
      },
    },
  },
  '/weddings/{weddingId}/invitations/{invitationId}': {
    delete: {
      operationId: 'deleteWeddingInvitation',
      summary: 'Revoke a pending invitation',
      description: 'ADMIN only. Only a PENDING invitation can be revoked.',
      tags: ['Invitations'],
      security: [{ accessTokenCookie: [] }],
      responses: {
        '204': { description: 'The invitation was revoked.' },
        '401': commonErrorResponses['401'],
        '403': commonErrorResponses['403'],
        '404': commonErrorResponses['404'],
        '422': commonErrorResponses['422'],
      },
    },
  },
  '/weddings/{weddingId}/invitations/{invitationId}/resend': {
    post: {
      operationId: 'postResendWeddingInvitation',
      summary: 'Resend a pending invitation',
      description:
        'ADMIN only. Regenerates the token and expiry (so an expired invitation becomes usable again) and re-sends the email. Only a PENDING invitation can be resent.',
      tags: ['Invitations'],
      security: [{ accessTokenCookie: [] }],
      responses: {
        '200': {
          description: 'The invitation, with a fresh token and expiry.',
          content: { 'application/json': { schema: invitationActionResponse } },
        },
        '401': commonErrorResponses['401'],
        '403': commonErrorResponses['403'],
        '404': commonErrorResponses['404'],
        '422': commonErrorResponses['422'],
      },
    },
  },
  '/invitations/preview': {
    post: {
      operationId: 'postInvitationPreview',
      summary: 'Preview an invitation by its token',
      description:
        'Public — no auth required, the same way /auth/reset-password works from a token alone. The token travels in the request body rather than the URL (unlike a typical "preview by ID" GET) so it never ends up written to access logs. Used to render the Accept Invitation page’s context (who invited you, to what wedding, as what role) before the visitor has necessarily signed in. Returns the invitation’s current status (including an already-expired/revoked/accepted one) rather than erroring — only a token matching no invitation at all is a 404.',
      tags: ['Invitations'],
      requestBody: { content: { 'application/json': { schema: invitationTokenBodySchema } } },
      responses: {
        '200': {
          description: 'The invitation’s context.',
          content: { 'application/json': { schema: invitationPreviewResponse } },
        },
        '404': commonErrorResponses['404'],
        '422': commonErrorResponses['422'],
      },
    },
  },
  '/invitations/accept': {
    post: {
      operationId: 'postAcceptInvitation',
      summary: 'Accept an invitation',
      description:
        'Requires auth — the caller must already be signed in (or have just registered) with the exact email the invitation was addressed to, or this returns EMAIL_MISMATCH. The token travels in the request body, same reasoning as POST /invitations/preview. Only a PENDING invitation can be accepted — an already-accepted one returns 409 INVITATION_ALREADY_ACCEPTED even if its membership was since removed, so getting back in always needs a fresh invite.',
      tags: ['Invitations'],
      security: [{ accessTokenCookie: [] }],
      requestBody: { content: { 'application/json': { schema: invitationTokenBodySchema } } },
      responses: {
        '200': {
          description: 'The wedding joined, and the role granted.',
          content: { 'application/json': { schema: invitationAcceptResponse } },
        },
        '401': commonErrorResponses['401'],
        '403': commonErrorResponses['403'],
        '404': commonErrorResponses['404'],
        '409': commonErrorResponses['409'],
        '422': commonErrorResponses['422'],
      },
    },
  },
});
