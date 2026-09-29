# Project Status

A running log of what's actually been built, kept separate from the four
source-of-truth design documents in this folder (which describe what's
*intended*, not what exists yet). Update this file whenever a major feature
lands — a new module, a rebuilt page, a significant fix to shared
infrastructure — not for every small commit. Add new entries to the top of
the **Progress Log**, and keep **Current Status** in sync with the latest
entry.

## Current Status (as of 2026-09-29)

- **Backend** (`backend/`): scaffolded and verified (Express + TypeScript +
  MongoDB, npm workspace). Two business modules are mounted: `health`
  (`/healthz`, `/readyz`) and `auth` + `weddings`. `auth` covers
  register/login/refresh/logout/me and forgot-password/reset-password
  (Argon2id, JWT cookies, single-use hashed reset tokens, generic
  responses that don't reveal account existence). `weddings` covers
  create/list/view a wedding — creator becomes ADMIN. No guest, invitation,
  event, RSVP, task, vendor, expense, website, or announcement modules yet.
  See [backend/CLAUDE.md](../backend/CLAUDE.md) for stack decisions and
  open product/design questions.
- **Frontend** (`frontend/`): scaffolded (Next.js 16 + Tailwind v4). The
  public homepage (`/`) faithfully matches the real, approved Stitch design
  export. `/sign-up`, `/sign-in`, `/forgot-password`, `/reset-password`, and
  `/weddings` (create + minimal list, no real design reference — styled by
  hand) are wired to the backend's `auth`/`weddings` modules. Still no
  dashboard or guest-facing site. See
  [frontend/CLAUDE.md](../frontend/CLAUDE.md).
- **Repo tooling**: npm-workspaces monorepo, shared git hooks
  (`.husky/` + `lint-staged.config.mjs`) confirmed working end-to-end, CI
  configured for both workspaces.
- **Resolved**: creating a wedding uses a MongoDB transaction
  (`weddings.service.ts`, per `db_design.docx` §9 / `api_design.docx` §22),
  which requires a replica set — a local standalone `mongod` (no
  `--replSet`) fails it with "this MongoDB deployment does not support
  retryable writes." Not a bug in this codebase: real Atlas (even the free
  M0 tier, the actual target deployment) is always a replica set. `.env` now
  points at a real Atlas cluster and wedding creation was verified working
  end-to-end against it. A related gotcha — the same error can also appear
  against a real, working replica set if the dev server's connection has
  been idle a while — is documented in
  [backend/CLAUDE.md](../backend/CLAUDE.md#things-that-will-bite) ("restart
  the dev server before assuming it's a code bug").

## Progress Log

### 2026-09-29 — Second code-review pass, fixes applied

Re-ran the full review against the fixed diff to check the first pass's
fixes for correctness and hunt for anything missed. Found and fixed:

- **Reset-password wasn't actually atomic/single-use under concurrency** —
  the most serious finding. `resetPassword()` used a `findOne` then a
  separate `save()`; two requests racing on the same still-valid token
  could both pass validation and both succeed before either save landed.
  Fixed with an atomic `findOneAndUpdate` that validates and consumes the
  token in one operation. Verified against the real backend by firing two
  genuinely concurrent requests with the same token: exactly one now
  succeeds (200), the other correctly gets 401 — previously both would
  have returned 200.
- **`/auth/refresh` had no rate limit**, unlike every other auth endpoint —
  added `auth:refresh` (20/60s) and verified live (21st call in a minute
  now gets 429).
- **`weddings.model.ts`'s API responses were undocumented in three real
  fields** (`createdBy`, `archivedAt`, `archivedBy`) that every response
  actually includes — the OpenAPI schema's `additionalProperties: false`
  was silently wrong. Added the missing fields instead of hiding the data
  (unlike `passwordHash` on `User`, these are legitimate, intended-to-be-visible
  fields — `createdBy` is explicitly in `db_design.docx`'s own schema, and
  archive audit fields are a normal thing to expose).
- **`weddings.openapi.ts`'s request schema was still hand-duplicated**
  from the real validation schema (the exact drift the previous pass fixed
  for all 4 `auth` endpoints, not carried through here) — now imports
  `createWeddingBodySchema` directly. Verified `zod-openapi` documents a
  `.transform()`-ed schema's pre-transform input shape for a request body,
  not its output, so `weddingDate` still shows as the date-only string
  clients send, not the `Date` it becomes internally.
- The dummy-password-hash cache (added in the previous pass for
  login-timing safety) could permanently cache a **rejected** promise on a
  transient hashing failure, breaking login for every nonexistent-email
  attempt for the rest of the process's life. Fixed to clear itself and
  retry on the next call instead.
- `registerUser()`'s existence-check and password-hash now run
  concurrently instead of in series (the hash doesn't depend on the
  exists() result, and a fresh registration — not a duplicate-email retry
  — is the common case for this endpoint).
- The sparse index on `users.passwordResetTokenHash` was defeated by a
  schema-level `default: null` (a sparse index only excludes *absent*
  fields, not ones explicitly set to `null` — every user had the field
  set, so every user was in the index). Removed the default; combined
  with the atomic `findOneAndUpdate` fix now using `$unset`, the field is
  genuinely absent except for users with an active pending reset.
- Corrected an inaccurate comment on the refresh cookie's `Path` — it
  claims "least privilege, only refresh/logout see it," but cookie `Path`
  only does prefix matching and every `/auth/*` route shares that prefix,
  so every auth endpoint actually receives it. The path itself is exactly
  what `api_design.docx` §5 specifies and wasn't changed; only the
  misleading rationale in the comment was.
- Removed `AppError.registrationFailed()`/`AUTH_REGISTRATION_FAILED` —
  dead code flagged in three separate review passes, never thrown
  anywhere.
- Documented (not "fixed" — no safe automated fix exists) that the
  module-boundary lint rule can be bypassed by a relative import, and
  can't be tightened without also blocking the legitimate public-entry-point
  import pattern this codebase already relies on. See
  [backend/CLAUDE.md](../backend/CLAUDE.md#architecture-rules).
- Fixed a stale test count in `backend/README.md` (said 153, actually 158).

158 backend tests (up from 156), including new regression coverage for
the reset-password concurrency fix (two genuinely concurrent requests,
asserting exactly one succeeds) and the refresh rate limit.

### 2026-09-28 — Code review pass on the auth + weddings feature, fixes applied

Ran the full `/code-review` skill (9 parallel review passes: efficiency,
architecture, reuse, security/correctness x2, simplification, CLAUDE.md
conventions, language pitfalls, wrapper correctness) against the entire
auth + weddings diff. Fixed everything confirmed real:

- **Login timing side-channel**: `loginUser()` now always runs the Argon2id
  comparison (against a cached dummy hash when no user is found), so
  response time can no longer reveal whether an email is registered —
  verified by timing both paths directly (~130–165ms either way, both
  dominated by the hash comparison; previously the no-such-user path
  returned near-instantly).
- **`/auth/reset-password` had no rate limit** despite its sibling
  endpoints all having one — added the missing `auth:reset-password`
  policy and wired it in; verified live (11th attempt in 5 minutes now
  gets a real 429).
- **Forgot-password could leak account existence during an email-provider
  outage** — a Resend failure now degrades to the same generic response
  instead of propagating as a distinguishable error.
- **Wedding date/timezone drift, on both write and read**: `weddingDate`
  was being coerced straight to a UTC `Date` with no reference to the
  sibling `timezone` field (a date-only string could land on the wrong
  calendar day depending on the venue's zone); now combined via Luxon.
  Display formatting was defaulting to the viewer's timezone instead of
  the wedding's own. Both fixed and verified live against the real
  backend (Dec 25 midnight Pacific now correctly stores as
  `2026-12-25T08:00:00.000Z`, not the old, wrong
  `2026-12-25T00:00:00.000Z`).
- `/weddings` no longer force-redirects to `/sign-in` on every load
  error — only on an actual `UNAUTHORIZED`; anything else shows a retry
  state instead of silently logging out an authenticated user.
- `load-membership.ts` now goes through a new `weddings.service.ts`
  export (`findActiveMembership`) instead of importing another module's
  model file directly, per this repo's own "modules talk through a
  public entry point" rule.
- The email-duplicate-key translation moved out of the shared
  `error-mappers.ts` (which has no way to know which collection raised a
  given field-name collision) into `auth.service.ts`, which does.
  `error-mappers.ts` now exports a reusable `isDuplicateKeyError()`
  instead of special-casing `"email"` for every model.
  `weddings.service.ts`'s `createWedding()` switched from a hand-rolled
  transaction (start/commit/abort/end) back to `session.withTransaction()`
  — the TypeScript-narrowing concern that motivated the manual version was
  based on a misdiagnosis, confirmed by testing the actual pattern under
  `--strict`; `withTransaction()` also retries automatically on
  transient errors, which the manual version didn't.
- `reserveUniqueSlug()`'s up-to-20-round-trip collision loop is now one
  batched query; its post-20-collision fallback no longer skips the
  uniqueness invariant every other candidate gets.
- `listMyWeddings()`'s pagination count could diverge from its returned
  items once archived weddings exist (latent — no archive endpoint ships
  yet); fixed by deriving both from the same filtered list.
- `apiFetch()` (frontend) now handles an empty/204 body and a malformed
  error envelope without crashing, and no longer conflates a mid-stream
  network failure with a malformed response.
- Removed ~30 lines of duplicated `err instanceof ApiError ? ... : "..."`
  boilerplate across all 5 new pages via a shared `toErrorMessage()`
  helper; moved 4 of `auth.openapi.ts`'s hand-duplicated request schemas
  to import the actual validation schemas instead (closing a real
  drift — the generated docs were previously missing constraints, like
  the name field's minimum length, that the server actually enforces).

One finding flagged but not "fixed" — `authorize()` is fully implemented
but not yet called from any route (harmless today; noted in
[backend/CLAUDE.md](../backend/CLAUDE.md#things-that-will-bite) as a
footgun for the next restricted route). One shared-model-registration
helper was attempted and reverted: making it generic enough for all three
models' differing shapes required `any`, which the linter correctly
flagged as unsafe — not a good trade for a 3-line dedup.

156 backend tests (up from 153), including new regression coverage for
the timezone fix and the reset-password rate limit.

### 2026-09-28 — Forgot/reset password, password show/hide toggle

Backend: `POST /auth/forgot-password` and `POST /auth/reset-password`
(api_design.docx §5.5) — single-use, 1-hour, SHA-256-hashed reset tokens
(`users.passwordResetTokenHash`/`passwordResetExpiresAt`, a schema addition
closing another db_design.docx gap, same category as `weddings.slug`);
generic response either way, so the endpoint never reveals whether an
email is registered; a successful reset bumps `tokenVersion`, invalidating
every outstanding session. Email sending goes through Resend when
`RESEND_API_KEY` is configured; when it isn't (true for local dev right
now), the reset link is returned directly in the response body instead —
but only outside production, and never logged, since api_design.docx §5.5
explicitly forbids logging reset tokens. 153 backend tests (up from 142),
11 paths in the OpenAPI spec (up from 9).

Frontend: `/forgot-password` and `/reset-password` pages, a "Forgot
password?" link on `/sign-in`, and a show/hide toggle on password fields
(`TextField`) — the last two in response to user testing in a real
browser, which also caught a real bug: `TextField` wrapped its `<input>`
in an implicit `<label>`, and clicking directly into the password field
did nothing. Fixed with explicit `htmlFor`/`id` association instead.
Also added `suppressHydrationWarning` to `<html>`/`<body>` in the root
layout — a recurring, harmless hydration warning turned out to be a
browser extension injecting `data-ember-extension`/`cz-shortcut-listen`
attributes before React hydrates, unrelated to this app's code.

### 2026-09-28 — Authentication + Create Your Wedding

Backend: `auth` module (register/login/refresh/logout/me — Argon2id
password hashing per the user's explicit choice over PRD §8's passwordless
spec, JWT access/refresh in HttpOnly cookies, generic invalid-credentials
responses, rate-limited register/login) and `weddings` module (create —
transactional wedding + creator's ADMIN `wedding_members` row — list mine,
view one). Closed db_design.docx gap G5 by adding an auto-generated unique
`weddings.slug`. New `authenticate`/`load-membership`/`authorize` middleware
replace the earlier throw-on-call stubs. 142 backend tests (up from 103),
OpenAPI spec regenerated (9 paths). `backend/CLAUDE.md`'s open-decisions
table updated: C1 resolved (password chosen), G5 resolved (slug added).

Frontend: `/sign-up`, `/sign-in`, `/weddings` pages and `src/lib/api.ts` (the
one place that calls the backend — cookie-based, unwraps the standard
envelope). The homepage's "Plan your wedding"/"Sign in" CTAs now link to
real routes instead of `#`.

### 2026-09-25 — Frontend scaffold + homepage rebuilt from the real Stitch design

Scaffolded `frontend/` as a Next.js 16 / TypeScript / Tailwind v4 app.
The homepage was first drafted from `doc/prd.md` under the mistaken belief
that the real Stitch export was behind an unreachable auth wall; once that
turned out to be wrong (the Stitch MCP tools' download URLs work with a
plain unauthenticated fetch), the homepage was rebuilt to transcribe that
real export directly — design tokens, structure, copy, and sample data all
sourced from its actual HTML/Tailwind config, including product surfaces
(e.g. a "Smart Stay & Travel Desk" module) not yet in backend scope, per
explicit direction to match the approved design as-is.

### 2026-09-25 — Fixed the lint-staged pre-commit hook

The shared pre-commit hook had been silently linting/formatting nothing for
every commit since the monorepo restructure, due to two compounding bugs
(an absolute-vs-relative path assumption, and lint-staged v17 dropping shell
support for `cd &&` chaining). Both root-caused and fixed; verified
end-to-end with a real test commit before landing.

### 2026-09-24 — Restructured into an npm-workspaces monorepo

Deliberately deviated from `system_design_architecture.pdf` (which calls for
two separate repos) at the user's request — `backend/` and `frontend/` live
in one repo as npm workspaces, sharing git hooks, commit lint, and CI.

### 2026-09-24 — Backend scaffold

Full Express + TypeScript + MongoDB Atlas foundation: config, core
utilities (logger with depth-agnostic redaction, error handling), db
connection, middleware, routing, and the `health` module. JWT auth,
rate limiting, R2 photo storage, and email are wired for later but not yet
implemented as business logic. Verified: typecheck/lint/format/test/build
all clean.

### 2026-09-23 — Source-of-truth design documents added

`doc/prd.md`, `doc/db_design.docx`, `doc/api_design.docx`,
`doc/system_design_architecture.pdf` — the four documents both workspaces
answer to.
