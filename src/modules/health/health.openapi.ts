/**
 * Registers this module's paths into the shared OpenAPI document. Imported
 * (for its side effect) alongside health.routes.ts in routes/v1.ts, so
 * mounting a module and documenting it happen in one place — see
 * config/openapi.ts.
 */
import { z } from 'zod';

import { registerModulePaths, successEnvelope } from '../../config/openapi.js';

const livenessResponse = successEnvelope(
  'LivenessResponse',
  z.object({ status: z.literal('ok'), uptimeSeconds: z.number().int() }),
);

const readinessResponse = successEnvelope(
  'ReadinessResponse',
  z.object({
    status: z.enum(['ok', 'not_ready']),
    db: z.enum(['connected', 'disconnected']),
    uptimeSeconds: z.number().int(),
  }),
);

registerModulePaths({
  '/healthz': {
    get: {
      operationId: 'getHealthz',
      summary: 'Liveness probe',
      description: 'Returns 200 whenever the process is up. Never touches the database.',
      tags: ['Health'],
      security: [],
      responses: {
        '200': {
          description: 'The process is alive.',
          content: { 'application/json': { schema: livenessResponse } },
        },
      },
    },
  },
  '/readyz': {
    get: {
      operationId: 'getReadyz',
      summary: 'Readiness probe',
      description:
        'Returns 200 when the app can serve real traffic, 503 otherwise (e.g. DB not yet connected).',
      tags: ['Health'],
      security: [],
      responses: {
        '200': {
          description: 'The app is ready to serve traffic.',
          content: { 'application/json': { schema: readinessResponse } },
        },
        '503': {
          description: 'A dependency (e.g. the database) is not yet available.',
          content: { 'application/json': { schema: readinessResponse } },
        },
      },
    },
  },
});
