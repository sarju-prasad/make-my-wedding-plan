/* eslint-disable no-restricted-properties -- this module is the single sanctioned reader of process.env */
/**
 * Validated environment configuration.
 *
 * Parses `process.env` through a Zod schema exactly once, at import time, and
 * exports a frozen typed config object. A missing or malformed variable throws
 * here — at boot — rather than surfacing as `undefined` deep inside a request.
 *
 * This is the ONLY module permitted to read `process.env`; an ESLint rule
 * enforces that everywhere else.
 *
 * See .env.example for the annotated variable list.
 */
import { config as loadDotenv } from 'dotenv';
import { z } from 'zod';

import { parseDurationMs } from '#utils/duration.js';

// Vercel injects environment variables directly; a missing .env file locally is
// not an error, so dotenv's own failure is deliberately ignored.
loadDotenv({ quiet: true });

/** Parses "true"/"false" strings, since every env value arrives as a string. */
const envBoolean = (fallback: 'true' | 'false'): z.ZodType<boolean> =>
  z
    .string()
    .default(fallback)
    .transform((value) => value.trim().toLowerCase() === 'true');

/**
 * Splits a comma-separated list into trimmed, non-empty entries, each
 * normalized to its origin (scheme + host + port) via the URL parser, not
 * kept as a raw string. A browser's Origin header is always exactly that —
 * never a path, and never a trailing slash — but a human pasting a URL into
 * this env var easily adds one ("https://example.com/"). cors.ts/
 * origin-check.ts both do exact Set.has() lookups against this list, so an
 * un-normalized trailing slash silently never matches a real request's
 * Origin header, and every state-changing request gets rejected with 403
 * for a typo that looks harmless.
 */
const corsOriginListSchema = z
  .string()
  .default('')
  .transform((value, ctx) => {
    const entries = value
      .split(',')
      .map((entry) => entry.trim())
      .filter((entry) => entry.length > 0);

    const origins: string[] = [];
    for (const entry of entries) {
      let url: URL;
      try {
        url = new URL(entry);
      } catch {
        ctx.addIssue({
          code: 'custom',
          message: `"${entry}" in CORS_ALLOWED_ORIGINS is not a valid URL.`,
        });
        continue;
      }

      // A scheme-less entry ("localhost:3000", meant as host:port) doesn't
      // throw — the URL parser reads "localhost" itself as the *scheme* and
      // "3000" as an opaque path, and a non-special scheme's `.origin` is
      // the literal string "null" (verified directly: `new
      // URL('localhost:3000').origin === 'null'`). Before this schema
      // normalized anything, a typo like that just never matched a real
      // Origin header and was silently harmless. Now that it's added to the
      // allowlist Set verbatim, it would match the literal `Origin: null`
      // header a browser sends from a sandboxed iframe or a data: URL —
      // exactly the untrusted context CORS/CSRF are supposed to keep out —
      // so both this and a non-http(s) scheme must be rejected outright
      // rather than silently normalized.
      if ((url.protocol !== 'http:' && url.protocol !== 'https:') || url.origin === 'null') {
        ctx.addIssue({
          code: 'custom',
          message: `"${entry}" in CORS_ALLOWED_ORIGINS must be a full http(s):// origin.`,
        });
        continue;
      }

      origins.push(url.origin);
    }
    return origins;
  });

/**
 * JWT_ACCESS_TTL/JWT_REFRESH_TTL/GUEST_SESSION_TTL are each parsed by TWO
 * different, independent parsers downstream: jose's SignJWT.setExpirationTime()
 * (auth.tokens.ts, signing the token itself) and this codebase's own
 * hand-rolled parseDurationMs() (middleware/cookies.ts, computing the
 * cookie's maxAge in milliseconds). jose's grammar is lenient ("2 hours",
 * "1w", a bare number of seconds); parseDurationMs() is strict — exactly
 * `\d+` immediately followed by a single s/m/h/d, nothing else (utils/
 * duration.ts's own regex). A value like "1w" or "2 hours" passes jose fine
 * but throws in parseDurationMs(), so validating against jose's rules alone
 * (an earlier version of this check did exactly that) still let a TTL
 * through that would 500 on the very first login or refresh, once the
 * cookie-setting code tried to parse it.
 *
 * Validating with parseDurationMs() instead closes this: verified directly
 * that everything its regex accepts ("15m", "7d", "2h", "30s", …) jose also
 * accepts, so this is the strictly more conservative — and sufficient —
 * check for both consumers at once, not just a different one.
 */
function isValidDuration(value: string): boolean {
  try {
    parseDurationMs(value);
    return true;
  } catch {
    return false;
  }
}

// Exported solely so tests/unit/env.test.ts can exercise the superRefine
// checks below (secrets must differ, TTL format, CORS origin normalization)
// directly via envSchema.safeParse(), without going through this module's
// own process.env-reading, process.exit(1)-on-failure side effects.
export const envSchema = z
  .object({
    // --- Application ---------------------------------------------------------
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().int().positive().max(65535).default(4000),
    APP_BASE_URL: z.url(),
    WEB_BASE_URL: z.url(),
    LOG_LEVEL: z
      .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'])
      .default('info'),

    // --- Database ------------------------------------------------------------
    MONGODB_URI: z.string().min(1, 'MONGODB_URI is required'),
    MONGODB_DB_NAME: z.string().min(1, 'MONGODB_DB_NAME is required'),

    // --- Authentication ------------------------------------------------------
    // Two distinct secrets: sharing one lets a refresh token be replayed as an
    // access token. 32 chars is the floor for HS256.
    JWT_ACCESS_SECRET: z.string().min(32, 'JWT_ACCESS_SECRET must be at least 32 characters'),
    JWT_REFRESH_SECRET: z.string().min(32, 'JWT_REFRESH_SECRET must be at least 32 characters'),
    JWT_ACCESS_TTL: z.string().default('15m'),
    JWT_REFRESH_TTL: z.string().default('7d'),
    GUEST_SESSION_TTL: z.string().default('2h'),
    INVITATION_TOKEN_BYTES: z.coerce.number().int().min(16).max(64).default(32),

    // --- Cookies -------------------------------------------------------------
    COOKIE_SECURE: envBoolean('false'),
    COOKIE_SAMESITE: z.enum(['lax', 'strict', 'none']).default('lax'),
    COOKIE_DOMAIN: z.string().optional(),

    // --- CORS ----------------------------------------------------------------
    CORS_ALLOWED_ORIGINS: corsOriginListSchema,

    // --- Cloudflare R2 -------------------------------------------------------
    R2_ACCOUNT_ID: z.string().optional(),
    R2_ACCESS_KEY_ID: z.string().optional(),
    R2_SECRET_ACCESS_KEY: z.string().optional(),
    R2_BUCKET: z.string().optional(),
    R2_ENDPOINT: z.url().optional().or(z.literal('')),
    R2_PRESIGN_UPLOAD_TTL: z.coerce.number().int().positive().default(300),
    R2_PRESIGN_DOWNLOAD_TTL: z.coerce.number().int().positive().default(300),

    // --- Email ---------------------------------------------------------------
    RESEND_API_KEY: z.string().optional(),
    EMAIL_FROM: z.string().optional(),
    EMAIL_REPLY_TO: z.string().optional(),

    // --- Scheduled jobs ------------------------------------------------------
    CRON_SECRET: z.string().optional(),

    // --- Limits --------------------------------------------------------------
    MAX_UPLOAD_PHOTOS: z.coerce.number().int().positive().default(10),
    MAX_UPLOAD_BYTES: z.coerce
      .number()
      .int()
      .positive()
      .default(10 * 1024 * 1024),
    MAX_PAGE_LIMIT: z.coerce.number().int().positive().default(100),
  })
  .superRefine((env, ctx) => {
    // Browsers reject SameSite=None without Secure, so the pair is invalid in
    // any environment. Catching it here beats debugging vanished cookies.
    if (env.COOKIE_SAMESITE === 'none' && !env.COOKIE_SECURE) {
      ctx.addIssue({
        code: 'custom',
        path: ['COOKIE_SECURE'],
        message: 'COOKIE_SECURE must be true when COOKIE_SAMESITE is "none" — browsers reject it.',
      });
    }

    // Sharing one secret between access and refresh tokens lets a refresh
    // token be replayed as an access token (auth.tokens.ts) — the comment on
    // JWT_ACCESS_SECRET above documents this, but nothing previously
    // enforced it.
    if (env.JWT_ACCESS_SECRET === env.JWT_REFRESH_SECRET) {
      ctx.addIssue({
        code: 'custom',
        path: ['JWT_REFRESH_SECRET'],
        message: 'JWT_REFRESH_SECRET must be different from JWT_ACCESS_SECRET.',
      });
    }

    // Every environment, not just production — a malformed TTL is a bug
    // regardless, and this is where it should fail: at boot, not on the
    // first login/refresh that tries to sign a token with it.
    for (const key of ['JWT_ACCESS_TTL', 'JWT_REFRESH_TTL', 'GUEST_SESSION_TTL'] as const) {
      if (!isValidDuration(env[key])) {
        ctx.addIssue({
          code: 'custom',
          path: [key],
          message: `${key}="${env[key]}" is not a valid duration (e.g. "15m", "7d", "2h", "30s").`,
        });
      }
    }

    if (env.NODE_ENV !== 'production') return;

    if (!env.COOKIE_SECURE) {
      ctx.addIssue({
        code: 'custom',
        path: ['COOKIE_SECURE'],
        message: 'COOKIE_SECURE must be true in production.',
      });
    }

    if (env.CORS_ALLOWED_ORIGINS.length === 0) {
      ctx.addIssue({
        code: 'custom',
        path: ['CORS_ALLOWED_ORIGINS'],
        message: 'At least one allowed origin must be configured in production.',
      });
    }

    // Optional locally so the app boots without third-party credentials, but
    // mandatory once deployed — a missing key must not degrade silently.
    const requiredInProduction = [
      'R2_ACCOUNT_ID',
      'R2_ACCESS_KEY_ID',
      'R2_SECRET_ACCESS_KEY',
      'R2_BUCKET',
      'R2_ENDPOINT',
      'RESEND_API_KEY',
      'EMAIL_FROM',
      'CRON_SECRET',
    ] as const;

    for (const key of requiredInProduction) {
      if (!env[key]) {
        ctx.addIssue({
          code: 'custom',
          path: [key],
          message: `${key} is required in production.`,
        });
      }
    }
  });

export type Env = z.infer<typeof envSchema>;

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  const issues = parsed.error.issues
    .map((issue) => `  - ${issue.path.join('.') || '(root)'}: ${issue.message}`)
    .join('\n');

  // The logger depends on this module, so it cannot be used here.
  process.stderr.write(`\nInvalid environment configuration:\n${issues}\n\n`);
  process.exit(1);
}

export const env: Readonly<Env> = Object.freeze(parsed.data);

export const isProduction = env.NODE_ENV === 'production';
export const isTest = env.NODE_ENV === 'test';
export const isDevelopment = env.NODE_ENV === 'development';
