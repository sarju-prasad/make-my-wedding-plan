# Project Status

A running log of what's actually been built, kept separate from the four
source-of-truth design documents in this folder (which describe what's
*intended*, not what exists yet). Update this file whenever a major feature
lands — a new module, a rebuilt page, a significant fix to shared
infrastructure — not for every small commit. Add new entries to the top of
the **Progress Log**, and keep **Current Status** in sync with the latest
entry.

## Current Status (as of 2026-10-01)

- **Backend** (`backend/`): scaffolded and verified (Express + TypeScript +
  MongoDB, npm workspace). Three business modules are mounted: `health`
  (`/healthz`, `/readyz`), `auth` + `weddings`, and `events`. `auth` covers
  register/login/refresh/logout/me and forgot-password/reset-password
  (Argon2id, JWT cookies, single-use hashed reset tokens, generic
  responses that don't reveal account existence). `weddings` covers
  create/list/view/**update** a wedding (creator becomes ADMIN, optional
  description; update is `PATCH`, ADMIN only, a partial update — `slug` is
  immutable, `weddingDate`/`timezone` may be supplied independently of each
  other, protected against a concurrent read-modify-write race via
  Mongoose's `optimisticConcurrency`) and full member management — list,
  add by email (ADMIN only, target must already have an account), change
  role, remove, with at least one active ADMIN always enforced. `events`
  covers create/list/view only (wedding-scoped, any active member) — no
  update/cancel/archive/restore yet. No guest, invitation, RSVP, task,
  vendor, expense, website, or announcement modules yet. See
  [backend/CLAUDE.md](../backend/CLAUDE.md) for stack decisions and open
  product/design questions.
- **Frontend** (`frontend/`): scaffolded (Next.js 16 + Tailwind v4). The
  public homepage (`/`) faithfully matches the real, approved Stitch design
  export. `/sign-up`, `/sign-in`, `/forgot-password`, `/reset-password`, and
  `/weddings` (create + minimal list, no real design reference — styled by
  hand) are wired to the backend's `auth`/`weddings` modules. Each wedding
  card now opens `/weddings/[weddingId]`, an overview/dashboard page
  (couple names, countdown, wedding details, a "Wedding team" members
  section, an events empty state, and a quick-actions grid to the not-yet-
  built modules) transcribed from a real but previously-unused Stitch
  screen, "Wedding Command Center." Still no guest-facing site, and no
  frontend yet for either the Events APIs or the wedding-edit `PATCH`
  endpoint (both backend-only so far). See
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

### 2026-10-01 — Events module (backend) + Edit Wedding Details (backend), review fixes applied

Two backend-only feature slices, built and reviewed together; no frontend
work in either yet.

**Events module** (`modules/events/`) — api_design.docx §10,
db_design.docx §5/§6: `POST`/`GET /weddings/:weddingId/events` and
`GET .../events/:eventId`. Wedding-scoped, open to any active member
(Admin or Manager) — no `authorize()` restriction, matching the PRD's
permission tables. `venue`/`livestream` are optional structured sub-objects
(the latter deliberately an object with a required `url`, not a bare
string, to leave room for a future `recordingUrl` with no migration).
Soft-archive plugin applied to the schema now even though archive/restore
endpoints don't exist yet (schema-ready, matching the `weddings` precedent).
Only create/list/view exist — update/cancel/archive/restore are deferred.
27 new tests (validation, auth/membership 401/404, cross-wedding isolation
checked in both directions for both list and get).

**Edit Wedding Details** — `PATCH /api/v1/weddings/:weddingId`, ADMIN only
(PRD §9/§10: Admin manages wedding information, Manager doesn't). A true
partial update: only supplied top-level fields change; `couple`/`location`,
if supplied, must be given in full (not deep-merged, to avoid stale
lat/long after an address-only edit); `weddingDate`/`timezone` may be
supplied independently of each other — supplying only one reinterprets the
wedding's existing stored value for the other via Luxon, rather than
requiring both together. `slug` is permanently immutable (not accepted by
this endpoint at all) — it's derived from `couple` at creation, not `name`,
and regenerating it on update would break any already-shared guest-facing
`/w/<slug>` link (PRD §19). ~35 new tests (auth, cross-wedding/removed-
member/non-Admin rejection, per-field validation, partial-update-preserves-
the-rest for every field including hand-verified exact timestamps for the
weddingDate-only/timezone-only cases, a 10-payload protected-field-rejection
matrix, slug immutability, persistence).

A review pass over the combined diff found a real concurrency bug and three
smaller issues, all fixed:

- **`updateWedding()`'s weddingDate/timezone reconciliation was an
  unprotected read-modify-write race.** Two concurrent `PATCH` requests
  each supplying only one of the two fields could each compute their result
  from the same stale read of the other, and the second save would
  silently overwrite the first — reproducing the exact "stored instant
  mismatched with its own timezone label" bug this logic exists to
  prevent. Mongoose's default `__v` versioning does *not* guard this (it
  only protects conflicting array operations); fixed by adding
  `optimisticConcurrency: true` to the `Wedding` schema and mapping the
  resulting `VersionError` to a new `409 CONCURRENT_UPDATE` response.
  Added a regression test that fires two genuinely concurrent partial
  updates and asserts exactly one succeeds.
- `wedding.timezone` was being unconditionally reassigned even when only
  `weddingDate` changed — now only reassigned when the request actually
  supplied a new one.
- A comment on `events.service.ts`'s `omitUndefinedValues` claimed a
  runtime necessity (stripping `undefined` out of a partially-filled
  `venue`) that isn't real — Zod never materializes an absent optional key
  as an explicit `undefined` at parse time. Corrected: it's purely a
  `exactOptionalPropertyTypes` type-level fix.
- `listEvents`'s pagination sorted by `startsAt` alone, with no tiebreaker —
  two events sharing a start time would make page boundaries
  nondeterministic. Added an `_id` tiebreaker.

Documented but not fixed: `createEvent` doesn't re-verify the parent
wedding is still active/unarchived (relies entirely on `loadMembership`'s
ACTIVE-membership check) — currently unreachable, since no wedding-archive
endpoint exists yet, but will need the same `excludeArchived()` guard
`weddings.service.ts` already uses once one does.

255 backend tests (up from 192), 15 OpenAPI paths (up from 13).

### 2026-09-30 — Code review pass on Overview/Members/venue-autocomplete, fixes applied

Ran the full review against the accumulated diff (Overview page, sidebar,
venue autocomplete, description field, Members feature). Found and fixed:

- **The Members compound-unique-index duplicate check was dead code.**
  `addMember()`'s concurrent-race catch called
  `isDuplicateKeyError(error, 'weddingId')` / `(error, 'userId')` — checks
  written for a single-field index — against `wedding_members`' actual
  index, the *compound* `{weddingId, userId}`. A real E11000 has a 2-key
  `keyPattern`, so neither call ever matched and the intended friendly
  "This person is already a member of this wedding." message was
  unreachable; a genuine race fell through to the generic mapper's
  "This resource already exists." instead (still a 409, just the wrong
  message). Fixed by teaching `isDuplicateKeyError()` to accept a field
  array for exactly this case. Writing a real concurrent-add regression
  test surfaced a second, more fundamental gap: `db/connection.ts` disables
  `autoIndex` outside development by design (indexes are synced explicitly
  via `npm run db:indexes`, never implicitly), and the test database is no
  exception — the unique index this test needs didn't exist there either,
  so MongoDB silently allowed two "duplicate" inserts instead of rejecting
  the second. No test in this codebase had ever exercised a real
  DB-level unique-index race before. Fixed by explicitly calling
  `WeddingMember.syncIndexes()` in this test file's `beforeAll`.
- **`VenueAddressField` had no failure path once a Google Maps API key was
  configured.** The `<Script>` tag only handled `onLoad`; a failed script
  load (network block, ad-blocker, CSP, bad/restricted key, quota) or a
  failed `importLibrary("places")`/`fetchFields()` call left the widget
  permanently empty with no fallback — silently making the create-wedding
  form unsubmittable, contradicting this component's own doc comment
  claiming the form "stays fully usable in any environment." Fixed: script
  and library-load failures now fall back to the same manual address/
  lat/long fields used when no key is configured at all; a selected place
  with no fetchable location shows an inline retry message instead of
  doing nothing.
- The manual lat/long fallback accepted non-finite values (`Number("1e400")
  === Infinity`, which is `!== null` and so passed the create-form's submit
  guard) — added a `Number.isFinite()` check at the point of parsing.
- **An Admin could remove their own membership from the "Wedding team"
  panel**, which then broke the panel itself (the next member-list fetch
  404s — they're no longer an active member) instead of navigating them
  away cleanly. The Remove control is now hidden for the viewer's own row;
  role changes to your own membership are still allowed.
- `MembersSection`'s per-row pending/error state was a single shared
  scalar, so finishing one member's request could re-enable a *different*
  member's still-in-flight controls, and the Remove control's Confirm/
  Cancel weren't disabled while a request was in flight at all. Fixed with
  a `Set` of pending member ids and consistent disabling. The invite
  form's email/role inputs are now disabled while submitting too (a native
  Enter-key submit doesn't respect a disabled submit *button*).
- Every add/role-change/remove action forced a full member-list refetch
  purely to re-learn data its own mutation response already returned;
  switched to patching local state directly from that response (also
  narrows the double-submit race window from the fix above, since there's
  no longer an async refetch gap after a mutation settles).
- `listMembers()` fetched with no `limit`, defaulting to the backend's
  page-1/20 default — a wedding with 21+ active members would silently
  truncate the team list and could hide an admin's own row (and therefore
  their management controls) if it fell on a later page. Requested the
  backend's real ceiling (100) instead — pagination UI wasn't built, since
  a wedding team realistically isn't going to exceed that in V1.
- `listMembers()`'s `countDocuments` + `find` ran sequentially despite
  neither depending on the other; switched to `Promise.all`.
- `middleware/authorize.ts` declared its own local `MemberRole` type
  instead of importing the real one from `members.model.ts` — a future
  third role would silently not type-check against it. Now imported
  (type-only) from the module's model, re-exported so `middleware/index.ts`
  needed no change.
- `members.validation.ts`'s `memberIdParamsSchema` re-declared `weddingId`
  from scratch instead of extending `weddingIdParamsSchema`, the same
  field's real schema.
- `USER_NOT_FOUND`'s message claimed "they need to sign up", which is
  wrong for an existing-but-SUSPENDED account (`findUserByEmail` treats
  both as not-found, same as `getCurrentUser`) — softened to "No active
  account found with this email."
- Two stale comments fixed: `api.ts` claimed no endpoint returns 204
  (`removeMember()`, in this same diff, does); a `weddings.test.ts` comment
  claimed no "remove member" endpoint existed (one does now, but the state
  that test needs — a wedding's *only* member, removed — is exactly what
  the real endpoint's last-Admin protection refuses to produce, so the
  direct model write it uses is still correct, just no longer for the
  reason the comment gave).
- `doc/project_status.md`'s own bookkeeping was off: the "Wedding Overview
  page" entry's test-count delta didn't reconcile with its neighbors, and
  neither it nor any other entry mentioned the venue-autocomplete/
  description-field work at all. Both corrected (see the dated entries
  below) rather than silently left wrong.
- `daysUntilWedding()`/`countdownLabel()` were defined locally in the
  Overview page instead of `lib/date.ts`, the module this same feature
  created specifically to be the one home for wedding-timezone-aware date
  logic. Moved.

2 new backend tests (the concurrent-add regression test, and a PATCH
ADMIN-only-enforcement test that was the one mutating members route
missing that coverage). **192 backend tests** (up from 190).

### 2026-09-29 — Wedding member management (Admin/Manager)

Closed a real gap: "Admin" was previously just a label stamped on the
wedding creator, with no way to invite a Manager, no member list, and
`middleware/authorize.ts` unused everywhere (flagged in `backend/CLAUDE.md`
as a footgun). This is api_design.docx §9 in full, and resolves open
decision G1.

Backend — `modules/weddings/members.{service,controller,validation}.ts`,
routes added to `weddings.routes.ts`:

- `GET /weddings/:weddingId/members` — any ACTIVE member; paginated.
- `POST /weddings/:weddingId/members` — ADMIN only. Adds an **existing**
  registered user by email (`USER_NOT_FOUND` if they haven't signed up —
  api_design.docx §9's "validate that the target user exists" reads as
  requiring an account already, not a pending-invite-token flow for an
  email with no account; that would be a second token system alongside the
  guest-invitations one this codebase doesn't have yet). Reactivates a
  previously-removed membership in place rather than failing on the
  `{weddingId, userId}` unique index.
- `PATCH .../members/:memberId` — ADMIN only, changes role.
- `DELETE .../members/:memberId` — ADMIN only, soft-removes (`status:
  REMOVED`).
- Both PATCH and DELETE refuse to leave a wedding with zero active ADMINs
  (`CANNOT_REMOVE_LAST_ADMIN`) — extended from api_design.docx's literal
  "prevent removal of the final active ADMIN" to also cover demoting the
  last ADMIN to MANAGER, since that leaves the same bad state.
- First real call site for `authorize()` — `backend/CLAUDE.md` updated,
  the "no call site yet" warning removed.
- Added `auth.service.ts#findUserByEmail` as that module's public entry
  point for the cross-module email lookup, rather than reaching into
  `auth.model.ts` directly.
- 15 new tests (add/list/role-change/remove, ADMIN-only enforcement,
  last-admin protection on both demote and remove, reactivation,
  USER_NOT_FOUND, duplicate-member). Two `it.todo` placeholders in
  `security.todo.test.ts` ("a MANAGER cannot perform an ADMIN-only
  operation", "the final active ADMIN... cannot be removed") are now real
  tests instead. **190 backend tests** (up from 175), 13 OpenAPI paths (up
  from 11).

Frontend — new "Wedding team" section on `/weddings/[weddingId]`
(`components/wedding/MembersSection.tsx`): lists members with role badges;
ADMINs additionally get an add-by-email form, a role `<select>` per member,
and a click-to-confirm remove control. Whether the viewer is an ADMIN is
derived from their own row in the members list itself (no backend response
shape change needed for this).

### 2026-09-29 — Wedding Overview page + GET wedding API

`GET /api/v1/weddings/:weddingId` already existed from the earlier
auth+weddings work (`authenticate` → `loadMembership` → controller →
service), so this landed as a frontend feature plus a few backend test
additions, not new backend logic:

- New `/weddings/[weddingId]` page — the wedding's overview/dashboard.
  Header, hero (couple names, wedding name, date, venue, a countdown
  computed client-side from `weddingDate` + the wedding's own `timezone`),
  a wedding-details card, an events empty state ("No events added yet"),
  and a 6-item quick-actions grid (Events/Guests/Tasks/Vendors/Expenses/
  Wedding Website) — every action shows "Coming soon" rather than a
  broken link or fabricated data, since none of those modules exist yet.
  Visual language transcribed from a real, previously-hidden Stitch screen
  in the same project as the homepage export
  (`7aa0c8f50a5b4fa9818aed91ba712b7f`, "Wedding Command Center"), cut down
  to only the sections backed by real data — its fully-featured mockup
  (task lists, RSVP tallies, vendor/budget breakdowns, a family-team
  roster) was explicitly not transcribed, since building those would mean
  fabricating data for modules this codebase doesn't have yet. After a
  follow-up comparison against the real design, added the missing
  structural chrome from the same screen — a fixed left sidebar listing
  all 12 workspace modules (`components/layout/WeddingSidebar.tsx`; every
  module besides Overview shows "Coming soon" the same honest way the
  quick actions do) and a header search field, present but genuinely
  disabled (no search feature exists), rather than a fake affordance.
- `/weddings` cards are now real links to the overview page instead of
  inert `<div>`s; successful wedding creation redirects there instead of
  leaving the user on the creation form.
- Confirmed a real conflict before touching anything: a since-superseded
  task spec expected `403 FORBIDDEN` for a non-member/removed-member GET;
  the existing `load-membership.ts` deliberately returns `404
  WEDDING_NOT_FOUND` for both, to prevent wedding-id enumeration (matches
  `api_design.docx`'s own error-code table). Raised explicitly and kept
  the existing, more secure behavior rather than changing it.
- Added the two backend test cases that behavior implies but weren't
  covered yet: `GET /weddings/:weddingId` without auth (401), and as a
  since-removed member (404) — the latter needs a direct `wedding_members`
  update in the test itself, since no "remove member" endpoint existed yet
  at the time (it does now — see the member-management entry above — but
  the state this test needs, removing a wedding's only member, is exactly
  what that endpoint's last-active-ADMIN protection refuses to do via the
  API, so the direct update is still the right approach, not a gap).
- A same-day review caught and fixed: an unescaped apostrophe that failed
  `eslint`'s `react/no-unescaped-entities` (a real lint failure, not a
  style nit); `formatWeddingDate()` duplicated verbatim between `/weddings`
  and the new page, now extracted to `frontend/src/lib/date.ts`; and the
  create-wedding button's `submitting` state no longer has a code path
  where it can get stuck disabled if the post-create redirect doesn't
  complete synchronously.
- Separately the same day (reviewing the wedding-creation API against its
  own spec, before the Overview page work above): a 9-field `it.each`
  matrix asserting every required `POST /weddings` field individually
  rejects when missing, an invalid-input-types test, a test confirming
  client-supplied `createdBy`/`status`/`role` are rejected outright by the
  `.strict()` schema rather than silently ignored, and a transaction-
  rollback regression test (mocks the second write of the wedding+
  membership transaction to fail, asserts no orphaned wedding is left
  behind). 170 backend tests at that point (up from 158), then 172 with
  the two GET-wedding-access tests above.

### 2026-09-29 — Venue address autocomplete + wedding description field

- Replaced raw manual latitude/longitude entry on the create-wedding form
  with Google Places autocomplete (`components/wedding/VenueAddressField.tsx`)
  — typing an address shows live suggestions; picking one fills address and
  coordinates automatically. Falls back to the original manual address +
  lat/long fields when `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` isn't configured
  (true in this environment — nobody has supplied a real key), so the form
  stays fully usable either way. Requires (dev-only) `@types/google.maps`.
- Added an optional wedding `description` field end to end: Mongoose schema,
  Zod validation (2000-char max), OpenAPI docs, a textarea on the create
  form, and display on the Overview page's hero card when present — an
  additive field beyond `db_design.docx`'s list, same category as `slug`
  (G5). 3 new backend tests (accept/round-trip, genuinely absent — not
  `null`/`""` — when omitted, rejected past 2000 characters). 175 backend
  tests (up from 172).
- Required-field markers (`*`) added to every required form field via the
  shared `TextField` component, so the change applies across every page
  that uses it (sign-up, sign-in, forgot/reset-password, create-wedding),
  not just the wedding form.

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
