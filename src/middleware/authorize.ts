/**
 * STUB — role authorization is not implemented yet. See authenticate.ts for
 * why this exists in the scaffold and throws rather than no-op'ing.
 *
 * Real implementation checks `req.auth` (set by authenticate.ts) against the
 * roles passed here, per an ADMIN/MANAGER permission matrix that does not
 * exist yet — see CLAUDE.md "Open decisions", G6. Route files can still be
 * written today as `authorize('ADMIN')` / `authorize('ADMIN', 'MANAGER')`;
 * only the middleware body is missing.
 *
 * api_design.docx §6.1: "All wedding access must be checked through
 * wedding_members... enforced in middleware and again in the service layer
 * for sensitive operations" — this covers only the middleware layer. The
 * service-layer re-check is a separate, per-module responsibility.
 */
import type { NextFunction, Request, RequestHandler, Response } from 'express';

import { AppError } from '../core/errors/index.js';

export type MemberRole = 'ADMIN' | 'MANAGER';

export function authorize(..._allowedRoles: MemberRole[]): RequestHandler {
  return (_req: Request, _res: Response, _next: NextFunction): void => {
    throw AppError.internal(
      'authorize() is not implemented yet — this route was wired up before the authorization module.',
    );
  };
}
