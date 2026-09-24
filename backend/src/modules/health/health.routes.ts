/**
 * Public — no authentication. Infra (Vercel, uptime monitors, load
 * balancers) must be able to reach these without a session.
 */
import { Router } from 'express';

import { getHealthz, getReadyz } from './health.controller.js';

export const healthRouter: Router = Router();

healthRouter.get('/healthz', getHealthz);
healthRouter.get('/readyz', getReadyz);
