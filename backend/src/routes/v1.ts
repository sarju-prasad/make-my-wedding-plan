/**
 * Versioned API router — mounts every module under /api/v1 in one place, so
 * the public surface of the API can be read off this single file.
 *
 * Each module is added as two lines: mount its router, import its
 * `*.openapi.ts` for the side effect of registering its paths into the
 * shared OpenAPI document (config/openapi.ts) — keeping "add a route" and
 * "document that route" a single atomic step, so one can't be done without
 * the other.
 *
 * Modules are added in the order given by api_design.docx §25. The scaffold
 * mounts only `health`.
 */
import { Router } from 'express';

import { healthRouter } from '../modules/health/health.routes.js';
import '../modules/health/health.openapi.js';

export const v1Router: Router = Router();

v1Router.use(healthRouter);
