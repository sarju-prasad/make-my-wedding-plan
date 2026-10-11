/**
 * api_design.docx §10. Only create/list/view are implemented — update,
 * cancel, archive, and restore are deferred (see doc/project_status.md).
 *
 * Every route: authenticate -> validate -> loadMembership. No
 * authorize('ADMIN') anywhere yet — create/list/view are open to any
 * ACTIVE member (PRD §9/§10: both Admin and Manager can create/edit
 * events), matching how weddings.routes.ts's own create/list/view are
 * unrestricted by role.
 */
import { Router } from 'express';

import { paginationQuerySchema } from '#core/http/pagination.js';
import { authenticate } from '#middleware/authenticate.js';
import { loadMembership } from '#middleware/load-membership.js';
import { validate } from '#middleware/validate.js';

import { getEventById, getEvents, postCreateEvent } from './events.controller.js';
import {
  createEventBodySchema,
  eventIdParamsSchema,
  weddingIdParamsSchema,
} from './events.validation.js';

export const eventsRouter: Router = Router();

eventsRouter.post(
  '/weddings/:weddingId/events',
  authenticate,
  validate({ params: weddingIdParamsSchema, body: createEventBodySchema }),
  loadMembership,
  postCreateEvent,
);

eventsRouter.get(
  '/weddings/:weddingId/events',
  authenticate,
  validate({ params: weddingIdParamsSchema, query: paginationQuerySchema }),
  loadMembership,
  getEvents,
);

eventsRouter.get(
  '/weddings/:weddingId/events/:eventId',
  authenticate,
  validate({ params: eventIdParamsSchema }),
  loadMembership,
  getEventById,
);
