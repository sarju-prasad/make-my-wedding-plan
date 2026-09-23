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
 * Populated by middleware/authenticate.ts once the auth module exists
 * (Phase 5+). Declared here now so the shape is visible from day one, even
 * though nothing assigns it yet — see middleware/authenticate.ts.
 */
export type AuthContext =
  | { kind: 'member'; userId: string; weddingId: string; role: 'ADMIN' | 'MANAGER' }
  | { kind: 'guest'; invitationId: string; weddingId: string };

declare module 'express-serve-static-core' {
  interface Request {
    auth?: AuthContext;
  }
}
