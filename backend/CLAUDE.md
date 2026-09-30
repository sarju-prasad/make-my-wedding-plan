# CLAUDE.md

Guidance for Claude Code when working in this repository.

## What this is

The backend REST API for **Make My Wedding Plan** — a private, invitation-only
wedding management platform for Indian weddings. This is the `backend/`
workspace of the monorepo; the Next.js frontend lives alongside it at
[`../frontend`](../frontend).

The scaffold is complete: runtime foundation, security middleware, the
database layer, integration shells, OpenAPI generation, and the test harness
are all built and passing `npm run verify`. Two business modules exist so
far — `health` (scaffold) and `auth` + `weddings` (register/login/refresh/
logout/me; create/list/view a wedding, creator becomes ADMIN) — see
[doc/project_status.md](../doc/project_status.md) for what's built and
[README.md](README.md#current-state) for the detailed file-level breakdown.

## Source of truth

The four documents in `../doc/` (repo root) define the product and the system:

| File                             | Authority over                                 |
| -------------------------------- | ---------------------------------------------- |
| `prd.md`                         | Product requirements, business rules, V1 scope |
| `db_design.docx`                 | Collections, fields, indexes, archive policy   |
| `api_design.docx`                | Endpoints, envelopes, error codes, validation  |
| `system_design_architecture.pdf` | Architecture, deployment, security, non-goals  |

**Read the relevant document before implementing a feature.** Where the code and
a document disagree, the document wins until it is formally amended. Where two
documents disagree, stop and raise it — do not pick one silently. Known
disagreements are listed under [Open decisions](#open-decisions).

Do not edit, rename or reformat anything in `../doc/`. These files are kept
byte-for-byte as authored and are excluded from Prettier.

## Stack and fixed decisions

These are settled. Do not substitute alternatives without asking.

- Node.js 20+, Express 5, TypeScript, ESM (`"type": "module"`, `module: NodeNext`)
- MongoDB Atlas + Mongoose; REST + JSON under `/api/v1`
- Modular monolith; the backend is **stateless**
- JWT access (15 min) and refresh (7 days) in secure HttpOnly cookies
- Refresh tokens are stateless — no refresh-token records in MongoDB
- Argon2id password hashing via `@node-rs/argon2`
- Zod validation at the API boundary; Mongoose validation as defence in depth
- Cloudflare R2 for private photos, presigned URLs, no image processing
- Resend for email, called directly from the backend
- MongoDB-backed rate limiting via `rate-limiter-flexible`
- Deployment: Vercel

Explicit V1 non-goals — **do not introduce these**: Redis, queues, background
workers, microservices, an image-processing pipeline, guest accounts or guest
passwords, public wedding search, custom domains, a full website builder.

## Architecture rules

- **Module-first.** A feature lives in one folder under `src/modules/<name>/`
  containing its routes, controller, service, model, validation and OpenAPI
  registration. Do not scatter a feature across layer-named top-level folders.
- **Modules talk through their public entry point.** Deep imports into another
  module's internals are blocked by lint and should stay blocked — **but only
  partially, in practice.** `eslint.config.js`'s `no-restricted-imports` rule
  only matches the literal `#modules/*/*` subpath-alias specifier, not a
  relative import — and it can't be tightened to catch relative imports
  either, because the _legitimate_ public entry point
  (`#modules/weddings/weddings.service.js`) sits at the exact same path depth
  as a truly internal file (`#modules/weddings/members.model.js`); a pattern
  broad enough to block the latter blocks the former too. `middleware/authenticate.ts`
  and `middleware/load-membership.ts` both reach into `modules/auth/` and
  `modules/weddings/` via relative imports specifically because of this gap
  (see their own docblocks) — lint-silent, not a loophole to copy for reaching
  into a module's actual internals (e.g. a `*.model.ts` file). Review by
  reading, not by trusting a clean lint run, until this has a real fix
  (e.g. per-module barrel `index.ts` files whitelisted by the rule).
- **Thin controllers.** Controllers translate HTTP to a service call and back.
  Business rules, ownership checks and transactions belong in services.
- **The backend is the security boundary.** Authorisation is enforced in
  middleware and re-checked in the service layer for sensitive operations.
  Never trust a client-supplied `weddingId`, `userId`, `invitationId` or `role`.
- **Soft archive, never destructive delete** for business resources.
- **Every wedding-scoped query is filtered by `weddingId`.** It is the tenant
  boundary; a missing filter is a cross-wedding data leak, not a bug.
- **Path aliases** use Node subpath imports (`#config/env.js`), not
  `tsconfig.paths`. They resolve natively; keep it that way.
- Only `src/config/env.ts` reads `process.env`. Only the pino logger writes
  output — no `console.*`. Both are lint-enforced.

## Things that will bite

- **Express 5 makes `req.query` a getter.** Assigning to it throws at runtime.
  Validated data goes on `req.validated`, never back onto `req.query`.
- **Serverless connection reuse.** Cache the Mongoose connection promise on
  `globalThis`, use `bufferCommands: false` and a small pool, and never close
  the connection at the end of a request.
- **Never log** passwords, JWTs, invitation tokens, reset tokens, presigned URLs
  or API keys. The pino redaction config exists for this — extend it when a new
  sensitive field appears.
- **Cookie `SameSite`.** `lax` only works behind the shared-domain rewrite. Local
  dev and Vercel previews are cross-site and need `none; Secure`. This is why
  `COOKIE_SAMESITE` is environment-driven.
- **Timezones.** Reminders are "24 hours before, in the event's own timezone".
  Use Luxon with the stored IANA zone; native `Date` arithmetic will be wrong.
- **Transactions need a real replica set — a local standalone `mongod` fails
  with "This MongoDB deployment does not support retryable writes."**
  `modules/weddings/weddings.service.ts`'s `createWedding()` (and future
  transactional workflows — api_design.docx §22) will hit this against a
  bare local `mongod` with no `--replSet`. Real Atlas (even the free M0
  tier) is always a replica set, so this doesn't happen there — but also
  seen once against a real, working Atlas cluster on a dev server process
  that had been running ~30 minutes with long idle gaps (`minPoolSize: 0`
  lets pooled connections close when idle); a plain `mongosh` connection and
  a fresh `mongoose.connect()` in an isolated script both succeeded
  immediately against the exact same cluster/connection string, and
  restarting the dev server made the app succeed too. If this error shows up
  against a cluster you've otherwise confirmed supports transactions,
  restart the dev server before assuming it's a code bug.
- **Money** is stored as integer paise, currency INR.
- **`authorize()` now has real call sites** — every mutating members route
  (`POST/PATCH/DELETE /weddings/:weddingId/members...`) mounts
  `authorize('ADMIN')` after `loadMembership`. Copy that pattern for the next
  ADMIN-only route rather than reinventing it. The three original wedding
  endpoints (create/list/view) stay open to any ACTIVE member, ADMIN or
  MANAGER alike, which is still correct for those.

## Workflow

- Run `npm run verify` (typecheck + lint + format + test) before considering work
  done. CI runs the same thing.
- Keep the OpenAPI spec generated from the Zod schemas, never hand-written.
- Write the authorisation tests alongside the feature: cross-wedding access,
  expired and revoked invitations, duplicate RSVP, and ADMIN vs MANAGER
  restrictions are required cases (`api_design` §23).
- Do not install new dependencies or add infrastructure without asking.

## Open decisions

Blocking items that must be resolved before the affected feature is built.
Recorded here so they are not silently decided in code.

| Ref | Issue                                                                                             |
| --- | ------------------------------------------------------------------------------------------------- |
| G2  | Guest **groups** and group-level RSVP rollup are required by PRD §12/§16, absent from DB and API  |
| C2  | PRD §29 requires planned **and** actual expense amounts; the schema stores a single `amountPaise` |
| G3  | `tasks` has no `eventId` or `vendorId`, contradicting PRD §26/§28                                 |
| G4  | Missing fields: `vendors.eventId`, `photos.eventId`, `announcements.expiresAt`                    |
| G6  | The ADMIN/MANAGER permission matrix does not exist; the docs already contradict each other on it  |
| G7  | Six time-driven behaviours (reminders, expiry, archive) with no scheduler decided                 |
| G9  | The guest-facing API surface beyond RSVP is undefined                                             |
| G10 | The Family Activity Feed (PRD §42) has no backing collection                                      |
| C4  | `DELETE` endpoints in `api_design` §13–14 contradict the archive-only policy                      |
| C5  | Synchronous bulk ZIP download has no stated bound and conflicts with serverless limits            |

If a task requires one of these, raise it rather than choosing an interpretation.

### Resolved

| Ref | Issue                                                                                               | Resolution                                                                                                                                                                                                                                                                                                                                                                                              |
| --- | --------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| C1  | PRD §8 mandates **passwordless** auth; DB, API and architecture docs all specify Argon2id passwords | Raised to the user (2026-09-27); decided **password (Argon2id)**, matching DB/API/architecture docs over the PRD. Implemented in `modules/auth/`.                                                                                                                                                                                                                                                       |
| G5  | No wedding **slug**, so the `/w/couple-name` URL in PRD §19 cannot be served                        | Added `weddings.slug` (unique-indexed, auto-generated from partner names with collision suffixing — see `utils/slug.ts` and `modules/weddings/weddings.service.ts`) in the auth+wedding-creation feature.                                                                                                                                                                                               |
| G1  | The Manager invite-by-email flow has no token, collection or endpoint anywhere                      | Built as `POST /weddings/:weddingId/members` — adds an existing registered user by email (api_design.docx §9: "Validate that the target user exists"), not a pending-invite-token flow for an email with no account, since C1 already chose password accounts over PRD §8's passwordless design. ADMIN-only; enforces at least one active ADMIN per wedding. See `modules/weddings/members.service.ts`. |
