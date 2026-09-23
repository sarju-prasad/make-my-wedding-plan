/**
 * STUB — authentication is not implemented yet.
 *
 * This exists so route files for future modules can be written against the
 * final signature and import path today (`authenticate` then `authorize(...)`
 * ahead of a controller, per system_design_architecture.pdf §8's request
 * flow), without silently no-op'ing security. Calling it throws loudly
 * rather than letting a request through unauthenticated.
 *
 * Real implementation (Decision D2 dependent — see CLAUDE.md "Open
 * decisions", C1) reads the access-token cookie (middleware/cookies.ts),
 * verifies the JWT, checks the user's status and tokenVersion, and sets
 * `req.auth` to the `{ kind: 'member', ... }` variant of AuthContext
 * (core/types/express.ts). A parallel guest path verifies the guest-session
 * cookie and sets the `{ kind: 'guest', ... }` variant.
 */
import type { NextFunction, Request, RequestHandler, Response } from 'express';

import { AppError } from '../core/errors/index.js';

export const authenticate: RequestHandler = (
  _req: Request,
  _res: Response,
  _next: NextFunction,
): void => {
  throw AppError.internal(
    'authenticate() is not implemented yet — this route was wired up before the auth module.',
  );
};
