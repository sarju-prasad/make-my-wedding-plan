/**
 * Role check against `req.auth` (set by middleware/load-membership.ts on
 * wedding-scoped routes, after authenticate.ts). Must run after
 * load-membership.ts in a route's middleware chain — see routes files for
 * the order.
 */
import type { NextFunction, Request, RequestHandler, Response } from 'express';

import { AppError } from '#core/errors/index.js';

// Relative import, not the `#modules/weddings/...` alias — same documented
// lint-boundary exception load-membership.ts uses (backend/CLAUDE.md:
// "Modules talk through their public entry point"). Type-only, so there's
// no risk of reaching into the module's runtime internals; this just keeps
// MemberRole itself from being redeclared and drifting from the real
// wedding_members role enum (members.model.ts's MEMBER_ROLE).
import type { MemberRole } from '../modules/weddings/members.model.js';

// Re-exported (not just imported) so middleware/index.ts's existing
// `export { authorize, type MemberRole } from './authorize.js'` keeps
// working unchanged.
export type { MemberRole };

export function authorize(...allowedRoles: MemberRole[]): RequestHandler {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (req.auth?.kind !== 'member' || !allowedRoles.includes(req.auth.role)) {
      next(AppError.forbidden());
      return;
    }
    next();
  };
}
