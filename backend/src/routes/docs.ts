/**
 * API documentation — api_design.docx §1 ("API documentation:
 * Swagger/OpenAPI"), §23 ("Generate and validate Swagger/OpenAPI
 * documentation during CI").
 *
 * Two routes:
 *   GET /api/v1/docs/openapi.json  — the generated document as raw JSON
 *   GET /api/v1/docs               — Scalar's interactive UI, reading the JSON above
 *
 * Mounted only outside production (see app.ts) — this is a private,
 * invitation-only platform, and the spec enumerates every endpoint the
 * backend exposes.
 */
import { apiReference } from '@scalar/express-api-reference';
import { Router } from 'express';

import { buildOpenApiDocument } from '../config/openapi.js';

export const docsRouter: Router = Router();

docsRouter.get('/docs/openapi.json', (_req, res) => {
  res.json(buildOpenApiDocument());
});

docsRouter.get(
  '/docs',
  apiReference({
    url: '/api/v1/docs/openapi.json',
    pageTitle: 'Make My Wedding Plan API',
  }),
);
