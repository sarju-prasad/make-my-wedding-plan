/**
 * Zod request validation — api_design.docx §18.
 *
 * Validates body/query/params against caller-supplied schemas and writes the
 * parsed, coerced, normalised result to `req.validated` (see
 * core/http/validated-request.ts for why it doesn't write back to req.query).
 *
 * Unknown top-level fields are rejected by default for bodies (via each
 * schema's own `.strict()`), per api_design.docx §18. Parse failures throw a
 * ZodError, which core/errors/error-mappers.ts converts to a 422
 * VALIDATION_ERROR — this middleware does not catch it; Express 5 forwards a
 * thrown/rejected error to the centralized handler automatically.
 */
import type { NextFunction, Request, RequestHandler, Response } from 'express';
import type { ZodType } from 'zod';

import type { Validated } from '../core/types/express.js';

export interface ValidationSchemas<Body = unknown, Query = unknown, Params = unknown> {
  body?: ZodType<Body>;
  query?: ZodType<Query>;
  params?: ZodType<Params>;
}

export function validate<Body = unknown, Query = unknown, Params = unknown>(
  schemas: ValidationSchemas<Body, Query, Params>,
): RequestHandler {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const validated: Validated<Body, Query, Params> = {
      body: schemas.body ? schemas.body.parse(req.body) : (req.body as Body),
      query: schemas.query ? schemas.query.parse(req.query) : (req.query as Query),
      params: schemas.params ? schemas.params.parse(req.params) : (req.params as Params),
    };

    req.validated = validated;
    next();
  };
}
