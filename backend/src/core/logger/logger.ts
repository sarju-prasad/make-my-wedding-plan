/**
 * Application logger — basic structured logging via pino, matching
 * system_design_architecture.pdf §15 ("simple structured application logs").
 *
 * This is the one pino instance for the whole process. `middleware/request-id.ts`
 * and `middleware/http-logger.ts` build a per-request child logger from it
 * (via pino-http), which inherits `formatters` and therefore the redaction
 * behaviour automatically — there is exactly one place secret-scrubbing is
 * implemented (see redaction.ts).
 *
 * `no-console` is enforced by ESLint everywhere except this file: this is the
 * only sanctioned way to produce output.
 */
import pino, { type LoggerOptions } from 'pino';

import { env, isDevelopment } from '#config/env.js';

import { deepRedact } from './redaction.js';

// Built up rather than inlined as one object literal: under
// exactOptionalPropertyTypes, `transport: isDevelopment ? {...} : undefined`
// explicitly sets the key to undefined, which pino's LoggerOptions type
// rejects (it distinguishes "absent" from "present but undefined"). Spreading
// conditionally omits the key entirely in production instead.
const options: LoggerOptions = {
  // tests/setup/global-setup.ts sets LOG_LEVEL=silent by default, which is
  // pino's own built-in "log nothing" level — the standard way to keep
  // `npm test` output free of request-log noise, and overridable per run
  // (LOG_LEVEL=debug npm test) without touching this file.
  level: env.LOG_LEVEL,
  base: { service: 'make-my-wedding-plan-api' },
  timestamp: pino.stdTimeFunctions.isoTime,
  formatters: {
    level: (label) => ({ level: label }),
    // Runs on every log object before serialisation — see redaction.ts for
    // why this replaces pino's built-in path-based `redact` option.
    log: (object) => deepRedact(object) as Record<string, unknown>,
  },
  ...(isDevelopment
    ? {
        transport: {
          target: 'pino-pretty',
          options: { colorize: true, translateTime: 'HH:MM:ss', ignore: 'pid,hostname,service' },
        },
      }
    : {}),
};

export const logger = pino(options);

export type Logger = typeof logger;
