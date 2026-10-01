import { z } from 'zod';

import {
  commonErrorResponses,
  listEnvelope,
  registerModulePaths,
  successEnvelope,
} from '#config/openapi.js';

import { EVENT_STATUS } from './events.model.js';
// The request body is imported directly from the schema that actually
// validates it, same reasoning as weddings.openapi.ts/auth.openapi.ts —
// two independent copies can only drift.
import { createEventBodySchema } from './events.validation.js';

const eventVenueSchema = z.object({
  name: z.string().optional(),
  address: z.string().optional(),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
  googleMapsUrl: z.string().optional(),
});

const eventLivestreamSchema = z.object({ url: z.string() });

const eventSchema = z.object({
  id: z.string(),
  weddingId: z.string(),
  name: z.string(),
  startsAt: z.iso.datetime(),
  endsAt: z.iso.datetime().optional(),
  timezone: z.string(),
  description: z.string().optional(),
  coverImageKey: z.string().optional(),
  venue: eventVenueSchema.optional(),
  livestream: eventLivestreamSchema.optional(),
  status: z.enum(EVENT_STATUS),
  // From the soft-archive plugin — see weddings.openapi.ts's identical note.
  isArchived: z.boolean(),
  archivedAt: z.iso.datetime().nullable(),
  archivedBy: z.string().nullable(),
  createdBy: z.string(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});

const eventResponse = successEnvelope('EventResponse', z.object({ event: eventSchema }));
const eventListResponse = listEnvelope('EventListResponse', eventSchema);

registerModulePaths({
  '/weddings/{weddingId}/events': {
    post: {
      operationId: 'postEvent',
      summary: 'Create an event',
      tags: ['Events'],
      security: [{ accessTokenCookie: [] }],
      requestBody: { content: { 'application/json': { schema: createEventBodySchema } } },
      responses: {
        '201': {
          description: 'The created event.',
          content: { 'application/json': { schema: eventResponse } },
        },
        '401': commonErrorResponses['401'],
        '404': commonErrorResponses['404'],
        '422': commonErrorResponses['422'],
      },
    },
    get: {
      operationId: 'getEvents',
      summary: 'List a wedding’s events',
      tags: ['Events'],
      security: [{ accessTokenCookie: [] }],
      responses: {
        '200': {
          description: 'Paginated list of the wedding’s events, soonest first.',
          content: { 'application/json': { schema: eventListResponse } },
        },
        '401': commonErrorResponses['401'],
        '404': commonErrorResponses['404'],
        '422': commonErrorResponses['422'],
      },
    },
  },
  '/weddings/{weddingId}/events/{eventId}': {
    get: {
      operationId: 'getEvent',
      summary: 'Get event details',
      tags: ['Events'],
      security: [{ accessTokenCookie: [] }],
      responses: {
        '200': {
          description: 'The event.',
          content: { 'application/json': { schema: eventResponse } },
        },
        '401': commonErrorResponses['401'],
        '404': commonErrorResponses['404'],
        '422': commonErrorResponses['422'],
      },
    },
  },
});
