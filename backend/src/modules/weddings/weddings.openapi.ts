import { z } from 'zod';

import {
  commonErrorResponses,
  listEnvelope,
  registerModulePaths,
  successEnvelope,
} from '#config/openapi.js';

import { WEDDING_STATUS } from './weddings.model.js';
// The request body is imported directly from the schema that actually
// validates it — see auth.openapi.ts for why (two independent copies can
// only drift). zod-openapi documents a `.transform()`-ed schema's *input*
// shape for a requestBody (verified directly against the installed
// version), so createWeddingBodySchema's weddingDate stays documented as
// the date-only string clients actually send, not the Date it transforms
// into internally.
import { createWeddingBodySchema } from './weddings.validation.js';

const weddingSchema = z.object({
  id: z.string(),
  name: z.string(),
  slug: z.string(),
  couple: z.object({ partnerOneName: z.string(), partnerTwoName: z.string() }),
  weddingDate: z.iso.datetime(),
  timezone: z.string(),
  location: z.object({ address: z.string(), latitude: z.number(), longitude: z.number() }),
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
  },
});
