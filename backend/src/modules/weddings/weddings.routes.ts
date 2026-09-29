/**
 * api_design.docx §8.1. Only create/list/view are implemented — update,
 * archive, and restore are deferred (see doc/project_status.md).
 */
import { Router } from 'express';

import { paginationQuerySchema } from '#core/http/pagination.js';
import { authenticate } from '#middleware/authenticate.js';
import { loadMembership } from '#middleware/load-membership.js';
import { validate } from '#middleware/validate.js';

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
