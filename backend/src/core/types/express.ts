/**
 * Express `Request`/`Response` augmentations shared across the app.
 *
 * Kept separate from core/http (which holds runtime helpers) because these
 * are pure type-level declarations with no executable code.
 */

/**
 * Result of running a request through middleware/validate.ts.
 *
 * Express 5 makes `req.query` a getter-only accessor, so validated output
 * cannot be written back onto `req.query`/`req.params`/`req.body` (the
 * common Express 4 pattern throws `TypeError` at runtime). Controllers read
 * from `req.validated` instead and never read the raw request properties.
 */
export interface Validated<Body = unknown, Query = unknown, Params = unknown> {
  body: Body;
  query: Query;
  params: Params;
}

declare module 'express-serve-static-core' {
  interface Request {
    validated?: Validated;
  }
}

/**
 * Populated by middleware/authenticate.ts for every authenticated request —
 * "who made this request", independent of any wedding. Wedding-scoped routes
 * additionally get `req.auth` (below) once membership has been resolved.
 */
declare module 'express-serve-static-core' {
  interface Request {
    userId?: string;
  }
}

/**
 * Populated by middleware/load-membership.ts on wedding-scoped routes
 * (`/weddings/:weddingId/...`), after authenticate.ts has set `req.userId`.
 * Deliberately a *separate* step from authenticate.ts: authenticate.ts only
 * proves identity from the access token (no DB round trip — see
 * auth.tokens.ts), while resolving `weddingId`/`role` requires a
 * wedding_members lookup keyed on a route param that only wedding-scoped
 * routes have. api_design.docx §6.1: "All wedding access must be checked
 * through wedding_members." A parallel guest path verifies the
 * guest-session cookie and sets the `{ kind: 'guest', ... }` variant once the
 * guest-access module exists.
 */
export type AuthContext =
  | { kind: 'member'; userId: string; weddingId: string; role: 'ADMIN' | 'MANAGER' }
  | { kind: 'guest'; invitationId: string; weddingId: string };

declare module 'express-serve-static-core' {
  interface Request {
    auth?: AuthContext;
  }
}
