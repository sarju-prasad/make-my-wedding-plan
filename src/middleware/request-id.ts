/**
 * Request ID assignment — first middleware in the chain (api_design.docx §4).
 *
 * Reuses an inbound `x-request-id` header when the caller supplied a
 * reasonable one (useful for correlating across the frontend and this API),
 * otherwise generates a UUID. Sets it on `req.id` — which pino-http's
 * `genReqId` then reads (see middleware/http-logger.ts) — and echoes it back
 * on the response header immediately, before any handler runs, so it is
 * present even if something later throws.
 */
import { randomUUID } from 'node:crypto';

import type { NextFunction, Request, Response } from 'express';

import { REQUEST_ID_HEADER } from '#config/constants.js';

/** Conservative allowlist: long enough to be a UUID, short enough to not be abused as a log-injection vector. */
const VALID_INBOUND_ID = /^[a-zA-Z0-9_-]{8,64}$/;

export function requestId(req: Request, res: Response, next: NextFunction): void {
  const inbound = req.headers[REQUEST_ID_HEADER];
  const candidate = Array.isArray(inbound) ? inbound[0] : inbound;

  const id = candidate && VALID_INBOUND_ID.test(candidate) ? candidate : randomUUID();

  req.id = id;
  res.setHeader(REQUEST_ID_HEADER, id);
  next();
}
