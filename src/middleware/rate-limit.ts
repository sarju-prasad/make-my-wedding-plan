/**
 * MongoDB-backed rate limiting — system_design_architecture.pdf §10
 * ("MongoDB-backed atomic counters with expiry"), api_design.docx §20
 * ("Apply rate limiting to login, password reset, guest validation, email
 * actions, and upload URL generation").
 *
 * Backed by rate-limiter-flexible's RateLimiterMongo, which was verified
 * (against a real mongodb-memory-server replica set) to accept a Mongoose
 * connection directly as `storeClient` — no separate native driver client
 * is needed.
 *
 * Limiters are created lazily and memoized per policy name, on first use —
 * never at module load — because construction needs an active DB
 * connection, and module evaluation can happen before connectDb() resolves
 * on a cold serverless start.
 *
 * POLICIES lists the named limits api_design.docx §20 calls for by name.
 * The point/duration/blockDuration numbers are scaffold placeholders — the
 * source documents specify *which* endpoints must be limited but not the
 * exact thresholds, so these are reasonable starting values to tune once
 * real usage patterns exist, not a considered decision.
 */
import type { NextFunction, Request, RequestHandler, Response } from 'express';
import { RateLimiterMongo, type IRateLimiterMongoOptions } from 'rate-limiter-flexible';

import { connectDb } from '#db/connection.js';

import { AppError } from '../core/errors/index.js';

export interface RateLimitPolicy {
  points: number;
  /** Window length, in seconds. */
  duration: number;
  /** How long a key stays blocked after exceeding `points`, in seconds. */
  blockDuration: number;
}

export const RATE_LIMIT_POLICIES = {
  'auth:login': { points: 10, duration: 60, blockDuration: 300 },
  'auth:register': { points: 5, duration: 60, blockDuration: 300 },
  'auth:forgot-password': { points: 5, duration: 300, blockDuration: 900 },
  'guest:validate': { points: 20, duration: 60, blockDuration: 300 },
  'photo:upload-urls': { points: 30, duration: 60, blockDuration: 120 },
  'email:send': { points: 20, duration: 60, blockDuration: 300 },
} as const satisfies Record<string, RateLimitPolicy>;

export type RateLimitPolicyName = keyof typeof RATE_LIMIT_POLICIES;

const limiters = new Map<RateLimitPolicyName, RateLimiterMongo>();

async function getLimiter(name: RateLimitPolicyName): Promise<RateLimiterMongo> {
  const existing = limiters.get(name);
  if (existing) return existing;

  const mongoose = await connectDb();
  const policy = RATE_LIMIT_POLICIES[name];

  const options: IRateLimiterMongoOptions = {
    storeClient: mongoose.connection,
    keyPrefix: `ratelimit:${name}`,
    points: policy.points,
    duration: policy.duration,
    blockDuration: policy.blockDuration,
  };

  const limiter = new RateLimiterMongo(options);
  limiters.set(name, limiter);
  return limiter;
}

/**
 * Keys by client IP. Requires `app.set('trust proxy', ...)` (set in app.ts)
 * so `req.ip` reflects the real client behind Vercel's proxy rather than
 * the proxy's own address — without it, every request shares one key.
 *
 * A future authenticated-context limiter (e.g. per-user rather than per-IP)
 * can layer a different key function once the auth module exists; nothing
 * here presumes IP is the only valid key.
 */
function defaultKey(req: Request): string {
  return req.ip ?? 'unknown';
}

export function rateLimit(policyName: RateLimitPolicyName): RequestHandler {
  return (req: Request, res: Response, next: NextFunction): void => {
    getLimiter(policyName)
      .then((limiter) => limiter.consume(defaultKey(req)))
      .then(() => {
        next();
      })
      .catch((rejection: unknown) => {
        // rate-limiter-flexible rejects with a RateLimiterRes on a normal
        // block (not an Error) — anything else is a real failure (e.g. the
        // DB was unreachable) and should not silently allow the request
        // through, but also should not be misreported as "rate limited".
        if (rejection && typeof rejection === 'object' && 'msBeforeNext' in rejection) {
          const { msBeforeNext } = rejection as { msBeforeNext: number };
          res.setHeader('Retry-After', Math.ceil(msBeforeNext / 1000).toString());
          next(AppError.rateLimited());
          return;
        }

        next(rejection);
      });
  };
}
