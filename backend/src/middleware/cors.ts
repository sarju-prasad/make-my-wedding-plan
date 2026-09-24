/**
 * CORS — api_design.docx §20, system_design_architecture.pdf §4.
 *
 * Strict allowlist from CORS_ALLOWED_ORIGINS, with credentials enabled
 * (required for cookie-based auth to work cross-origin at all). No wildcard:
 * `Access-Control-Allow-Origin: *` is rejected by browsers outright once
 * `credentials: true` is in play, so a wildcard wouldn't even work here.
 *
 * Note what this middleware is NOT: CORS only controls which origins a
 * browser will let its own JavaScript read a response from — it is not a
 * server-side authorization boundary, and a non-browser client can ignore it
 * entirely. The actual CSRF defense for state-changing requests is
 * middleware/origin-check.ts (api_design.docx §5: "Use Origin validation and
 * SameSite controls for CSRF protection").
 */
import cors from 'cors';
import type { RequestHandler } from 'express';

import { env } from '#config/env.js';
import { logger } from '#core/logger/logger.js';

const allowedOrigins = new Set(env.CORS_ALLOWED_ORIGINS);

export const corsMiddleware: RequestHandler = cors({
  credentials: true,
  methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-request-id'],
  exposedHeaders: ['x-request-id'],
  origin: (origin, callback) => {
    // No Origin header — a same-origin request, a server-to-server call, or
    // a non-browser client (curl, a health-check probe). Nothing here to
    // enforce; browsers only send Origin on cross-origin requests.
    if (!origin) {
      callback(null, true);
      return;
    }

    if (allowedOrigins.has(origin)) {
      callback(null, true);
      return;
    }

    // Deliberately does not pass an Error to the callback: doing so would
    // produce a 500 for what is, from the server's perspective, an
    // unremarkable request — the browser is what enforces CORS, by refusing
    // to let its script read a response that lacks the right headers.
    // Logged because a legitimate origin missing from the allowlist is an
    // operational problem worth noticing.
    logger.warn({ origin }, 'Rejected CORS request from a disallowed origin.');
    callback(null, false);
  },
});
