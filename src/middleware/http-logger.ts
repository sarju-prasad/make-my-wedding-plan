/**
 * Per-request logging — wraps the shared pino instance with pino-http.
 *
 * Reuses `req.id` set by request-id.ts rather than generating its own, so
 * both the response header and every log line for a request carry the same
 * identifier.
 *
 * Request/response serialisation is intentionally minimal: method, url and
 * status code only. Raw headers are never serialised, so cookies and
 * Authorization headers never reach the logger in the first place — the
 * deep-redact formatter (see core/logger/redaction.ts) is defence in depth,
 * not the only line of protection.
 */
import type { IncomingMessage, ServerResponse } from 'node:http';

import { pinoHttp } from 'pino-http';

import { logger } from '#core/logger/logger.js';

export const httpLogger = pinoHttp({
  logger,
  genReqId: (req: IncomingMessage) => req.id,
  customProps: () => ({}),
  serializers: {
    req: (req: IncomingMessage) => ({ id: req.id, method: req.method, url: req.url }),
    res: (res: ServerResponse) => ({ statusCode: res.statusCode }),
  },
});
