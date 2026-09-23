/**
 * OpenAPI document assembly — api_design.docx §1 ("API documentation:
 * Swagger/OpenAPI"), §23 ("Generate and validate Swagger/OpenAPI
 * documentation during CI").
 *
 * Built from the same Zod schemas used for runtime validation via
 * `zod-openapi`'s `createDocument()`, so the published spec cannot drift
 * from actual request handling — there is no hand-maintained YAML/JSON to
 * fall out of sync.
 *
 * This module owns only the document-level shell: info, servers, the
 * standard success/list/error envelope components (§3.1–§3.3), the
 * ErrorCode enum, and the cookie-based security schemes. Each module
 * contributes its own paths via a `*.openapi.ts` file that exports a
 * `ZodOpenApiPathsObject` fragment; buildOpenApiDocument merges them in.
 */
import { z } from 'zod';
import { createDocument, type ZodOpenApiPathsObject } from 'zod-openapi';

import { ErrorCode } from '../core/errors/error-codes.js';

import { env } from './env.js';

/** Standard success envelope — api_design.docx §3.1. */
export function successEnvelope<T extends z.ZodType>(id: string, data: T) {
  return z
    .object({
      success: z.literal(true),
      data,
    })
    .meta({ id });
}

/** Standard paginated list envelope — api_design.docx §3.2. */
export function listEnvelope<T extends z.ZodType>(id: string, item: T) {
  return z
    .object({
      success: z.literal(true),
      data: z.object({
        items: z.array(item),
        pagination: z.object({
          page: z.number().int(),
          limit: z.number().int(),
          totalItems: z.number().int(),
          totalPages: z.number().int(),
        }),
      }),
    })
    .meta({ id });
}

/** Standard error envelope — api_design.docx §3.3. */
export const errorEnvelopeSchema = z
  .object({
    success: z.literal(false),
    error: z.object({
      code: z.enum(ErrorCode),
      message: z.string(),
      details: z.unknown().optional(),
    }),
  })
  .meta({ id: 'ErrorResponse' });

/** Reusable non-2xx response entries, keyed by the status code they describe. */
export const commonErrorResponses = {
  '400': {
    description: 'The request could not be parsed or failed validation.',
    content: { 'application/json': { schema: errorEnvelopeSchema } },
  },
  '401': {
    description: 'Authentication is missing or invalid.',
    content: { 'application/json': { schema: errorEnvelopeSchema } },
  },
  '403': {
    description: 'The caller is authenticated but lacks permission.',
    content: { 'application/json': { schema: errorEnvelopeSchema } },
  },
  '404': {
    description: 'The requested resource does not exist or is inaccessible.',
    content: { 'application/json': { schema: errorEnvelopeSchema } },
  },
  '409': {
    description: 'The request conflicts with an existing resource.',
    content: { 'application/json': { schema: errorEnvelopeSchema } },
  },
  '422': {
    description: 'The request body, query, or params failed schema validation.',
    content: { 'application/json': { schema: errorEnvelopeSchema } },
  },
  '429': {
    description: 'The caller has exceeded a rate limit.',
    content: { 'application/json': { schema: errorEnvelopeSchema } },
  },
} as const;

/**
 * Modules register their paths here. Populated by routes/v1.ts as each
 * module is mounted — see modules/health/health.openapi.ts for the pattern.
 */
export const registeredPaths: ZodOpenApiPathsObject = {};

export function registerModulePaths(paths: ZodOpenApiPathsObject): void {
  Object.assign(registeredPaths, paths);
}

export function buildOpenApiDocument() {
  return createDocument({
    openapi: '3.1.0',
    info: {
      title: 'Make My Wedding Plan API',
      version: '1.0.0',
      description:
        'Private, invitation-only wedding management platform — V1 REST API. ' +
        'Source of truth: doc/prd.md, doc/db_design.docx, doc/api_design.docx, ' +
        'doc/system_design_architecture.pdf.',
    },
    servers: [{ url: `${env.APP_BASE_URL}/api/v1`, description: env.NODE_ENV }],
    paths: registeredPaths,
    components: {
      securitySchemes: {
        accessTokenCookie: {
          type: 'apiKey',
          in: 'cookie',
          name: 'access_token',
          description: 'Short-lived JWT issued to authenticated Admin/Manager users (15 minutes).',
        },
        guestSessionCookie: {
          type: 'apiKey',
          in: 'cookie',
          name: 'guest_session',
          description: 'Short-lived session issued after invitation-token validation.',
        },
      },
    },
  });
}
