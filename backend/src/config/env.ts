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

// Vercel injects environment variables directly; a missing .env file locally is
// not an error, so dotenv's own failure is deliberately ignored.
loadDotenv({ quiet: true });

/** Parses "true"/"false" strings, since every env value arrives as a string. */
const envBoolean = (fallback: 'true' | 'false'): z.ZodType<boolean> =>
  z
    .string()
    .default(fallback)
    .transform((value) => value.trim().toLowerCase() === 'true');

/** Splits a comma-separated list into trimmed, non-empty entries. */
const envList = z
  .string()
  .default('')
  .transform((value) =>
    value
      .split(',')
      .map((entry) => entry.trim())
      .filter((entry) => entry.length > 0),
  );

const envSchema = z
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
    CORS_ALLOWED_ORIGINS: envList,

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
