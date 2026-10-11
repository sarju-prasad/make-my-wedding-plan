/**
 * Express application assembly.
 *
 * `createApp()` builds and wires the app without ever calling `listen()` or
 * connecting to MongoDB, so the exact same app instance can be served by the
 * Vercel entry point (api/index.ts), the local dev server (src/server.ts),
 * and supertest in integration tests.
 *
 * Middleware order (a correction of an earlier draft of this plan, which had
 * pino-http running *after* body parsing — meaning a malformed-JSON request
 * would throw before req.id/req.log existed, and error-handler.ts would have
 * nothing to log against):
 *
 *   trust proxy
 *     -> requestId                (assigns req.id before anything can throw)
 *     -> httpLogger                (pino-http — must also run before anything can throw)
 *     -> securityHeaders           (helmet)
 *     -> corsMiddleware
 *     -> originCheck               (CSRF defense — api_design.docx §5)
 *     -> cookieParser
 *     -> express.json + urlencoded
 *     -> /api/v1 router
 *     -> /api/v1/docs (non-production only)
 *     -> notFound
 *     -> errorHandler              (last, 4-arity)
 */
import cookieParser from 'cookie-parser';
import express, { type Express } from 'express';

import { API_BASE_PATH, JSON_BODY_LIMIT } from './config/constants.js';
import { isProduction } from './config/env.js';
import {
  corsMiddleware,
  errorHandler,
  httpLogger,
  notFound,
  originCheck,
  requestId,
  securityHeaders,
} from './middleware/index.js';
import { docsRouter } from './routes/docs.js';
import { v1Router } from './routes/v1.js';

export function createApp(): Express {
  const app = express();

  // Vercel (and most PaaS) put the app behind a reverse proxy. Without this,
  // req.ip is the proxy's address for every request — rate limiting and any
  // IP-based logic would key on one value for all traffic.
  app.set('trust proxy', 1);
  app.disable('x-powered-by');

  app.use(requestId);
  app.use(httpLogger);
  app.use(securityHeaders);
  app.use(corsMiddleware);
  app.use(originCheck);
  app.use(cookieParser());
  app.use(express.json({ limit: JSON_BODY_LIMIT }));
  app.use(express.urlencoded({ extended: true, limit: JSON_BODY_LIMIT }));

  app.use(API_BASE_PATH, v1Router);

  // This is a private, invitation-only platform — the spec enumerates every
  // endpoint the backend exposes, so it is not served in production.
  if (!isProduction) {
    app.use(API_BASE_PATH, docsRouter);
  }

  app.use(notFound);
  app.use(errorHandler);

  return app;
}
