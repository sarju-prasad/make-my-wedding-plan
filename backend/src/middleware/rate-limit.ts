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
  // Generous relative to login/register: a legitimate client calls this
  // routinely (access tokens expire every 15 min, and multiple tabs/devices
  // for one user each refresh independently), but it still does a real
  // User.findById() per call and had no throttling at all before this.
  'auth:refresh': { points: 20, duration: 60, blockDuration: 300 },
  'auth:register': { points: 5, duration: 60, blockDuration: 300 },
  'auth:forgot-password': { points: 5, duration: 300, blockDuration: 900 },
  'auth:reset-password': { points: 10, duration: 300, blockDuration: 900 },
  'guest:validate': { points: 20, duration: 60, blockDuration: 300 },
  'photo:upload-urls': { points: 30, duration: 60, blockDuration: 120 },
  'email:send': { points: 20, duration: 60, blockDuration: 300 },
  // Generous enough for an Admin genuinely bulk-inviting family/vendors in
  // one sitting, but still a real ceiling — each call sends a real email
  // through Resend, and unlike the auth routes above, the target address is
  // someone else entirely, so an uncapped version becomes a tool for
  // spamming arbitrary inboxes from this app's sending domain.
  'invitation:create': { points: 10, duration: 60, blockDuration: 300 },
  'invitation:resend': { points: 10, duration: 60, blockDuration: 300 },
  // addMember() looks a registered email up and reports back whether it
  // found one — an unavoidable part of "add an existing user by email"
  // working at all, but with no limit at all it's a fast account-enumeration
  // oracle (any Admin of any wedding, including one they just created
  // themselves, can probe arbitrary emails). Same shape as the invitation
  // policies above, not just login's: this is still an email-guessing loop,
  // just reached through a different route.
  'member:add': { points: 10, duration: 60, blockDuration: 300 },
  // Layered alongside auth:login's per-IP limit, not instead of it — an
  // attacker distributing login attempts across many IPs (or, once a
  // frontend proxy means many legitimate users share one IP, a single
  // attacker hiding among them) would otherwise never trip a per-IP-only
  // limit no matter how many guesses they make against one target account.
  //
  // Conscious trade-off, not an oversight: this also means anyone who knows
  // a user's email can lock that account out of login indefinitely, just by
  // re-triggering the block (10 attempts/60s, then a 5-minute block,
  // repeatable forever) — the same trade-off most apps with a per-account
  // lockout make. Mitigating it would need something this app doesn't have
  // yet (CAPTCHA, a progressively increasing block, or alerting the account
  // owner) — accepted for now rather than left unconsidered.
  'auth:login-per-email': { points: 10, duration: 60, blockDuration: 300 },
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
 */
function defaultKey(req: Request): string {
  return req.ip ?? 'unknown';
}

/**
 * Keys by the submitted email instead of IP — layered onto auth:login
 * alongside the default per-IP policy (see RATE_LIMIT_POLICIES'
 * auth:login-per-email). Reads the raw request body directly rather than
 * `req.validated`, since this middleware runs before validate() — a
 * missing/malformed email just becomes a single shared "unknown" bucket,
 * which is no worse than no per-email limit at all.
 */
export function emailKey(req: Request): string {
  const email: unknown = (req.body as Record<string, unknown> | undefined)?.email;
  return typeof email === 'string' ? email.trim().toLowerCase() : 'unknown';
}

export function rateLimit(
  policyName: RateLimitPolicyName,
  keyFn: (req: Request) => string = defaultKey,
): RequestHandler {
  return (req: Request, res: Response, next: NextFunction): void => {
    getLimiter(policyName)
      .then((limiter) => limiter.consume(keyFn(req)))
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
