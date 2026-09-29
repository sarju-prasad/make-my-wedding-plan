/**
 * Role check against `req.auth` (set by middleware/load-membership.ts on
 * wedding-scoped routes, after authenticate.ts). Must run after
 * load-membership.ts in a route's middleware chain — see routes files for
 * the order.
 */
import type { NextFunction, Request, RequestHandler, Response } from 'express';

import { AppError } from '#core/errors/index.js';

export type MemberRole = 'ADMIN' | 'MANAGER';

export function authorize(...allowedRoles: MemberRole[]): RequestHandler {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (req.auth?.kind !== 'member' || !allowedRoles.includes(req.auth.role)) {
      next(AppError.forbidden());
      return;
    }
    next();
  };
}
