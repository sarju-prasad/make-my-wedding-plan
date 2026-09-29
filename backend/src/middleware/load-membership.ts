/**
 * Resolves `req.auth` for a wedding-scoped route (`/weddings/:weddingId/...`)
 * from an ACTIVE `wedding_members` record — api_design.docx §6.1: "All
 * wedding access must be checked through wedding_members." Must run after
 * authenticate.ts (needs `req.userId`) and before authorize.ts (needs
 * `req.auth`).
 *
 * Returns WEDDING_NOT_FOUND rather than FORBIDDEN for a wedding that exists
 * but the caller isn't a member of — api_design.docx's own definition of the
 * code ("does not exist or is inaccessible") deliberately doesn't
 * distinguish the two, so a non-member can't use the error code to probe
 * for which weddingIds are real.
 *
 * Re-validates `req.params.weddingId` itself with the same `objectIdSchema`
 * the route's `validate({ params: weddingIdParamsSchema })` already ran —
 * genuinely redundant for the one current call site (weddings.routes.ts),
 * but this is a shared, security-critical, reusable middleware: trusting
 * that some future route always mounts `validate()` first, rather than
 * checking, is the wrong trade for an authorization boundary. Left as
 * deliberate defense in depth, not an oversight.
 */
import type { NextFunction, Request, RequestHandler, Response } from 'express';

import { AppError, ErrorCode } from '#core/errors/index.js';
import { objectIdSchema } from '#core/http/schemas.js';

import { findActiveMembership } from '../modules/weddings/weddings.service.js';

export const loadMembership: RequestHandler = (
  req: Request,
  _res: Response,
  next: NextFunction,
): void => {
  // authenticate.ts always runs first on every route that mounts this
  // middleware (see modules/weddings/weddings.routes.ts) and either sets
  // req.userId or forwards an error that short-circuits the chain — this is
  // just narrowing `string | undefined` to `string` for the query below.
  const userId = req.userId;
  if (!userId) {
    next(AppError.unauthorized());
    return;
  }

  const parsedWeddingId = objectIdSchema.safeParse(req.params.weddingId);
  if (!parsedWeddingId.success) {
    next(AppError.notFound('Wedding not found.', ErrorCode.WEDDING_NOT_FOUND));
    return;
  }

  findActiveMembership(userId, parsedWeddingId.data)
    .then((membership) => {
      if (!membership) {
        next(AppError.notFound('Wedding not found.', ErrorCode.WEDDING_NOT_FOUND));
        return;
      }

      req.auth = { kind: 'member', userId, weddingId: membership.weddingId, role: membership.role };
      next();
    })
    .catch((error: unknown) => {
      next(error);
    });
};
