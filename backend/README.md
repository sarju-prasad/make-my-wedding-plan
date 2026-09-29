# Make My Wedding Plan — Backend

Backend REST API for **Make My Wedding Plan**, a private, invitation-only wedding
management platform for Indian weddings.

> **Status: scaffold complete, two business modules built.** Runtime
> foundation, security middleware, database layer, integration shells,
> OpenAPI generation, and the test harness are all in place and passing
> `npm run verify`. `auth` (register/login/refresh/logout/me) and `weddings`
> (create/list/view) are implemented; everything else is still scaffold-only.
> See [Current state](#current-state) and
> [doc/project_status.md](../doc/project_status.md).

---

## Stack

| Concern          | Choice                                          |
| ---------------- | ----------------------------------------------- |
| Runtime          | Node.js 20+                                     |
| Framework        | Express 5 + TypeScript (ESM)                    |
| Database         | MongoDB Atlas + Mongoose                        |
| API style        | REST + JSON, versioned at `/api/v1`             |
| Architecture     | Modular monolith, stateless                     |
| Auth             | JWT access + refresh in secure HttpOnly cookies |
| Password hashing | Argon2id                                        |
| Validation       | Zod (at the API boundary)                       |
| Object storage   | Cloudflare R2 (private bucket, presigned URLs)  |
| Email            | Resend                                          |
| Deployment       | Vercel (separate project from the frontend)     |

The frontend lives at [`../frontend`](../frontend) in this same repository.

---

## Design documents

The four documents in [`../doc/`](../doc/) (repo root) are the **source of truth**. Code follows
them; where code and documents disagree, the documents win until they are
formally amended.

| File                             | Covers                                        |
| -------------------------------- | --------------------------------------------- |
| `prd.md`                         | Product requirements, business rules, scope   |
| `db_design.docx`                 | Collections, fields, indexes, archive policy  |
| `api_design.docx`                | Endpoints, envelopes, error codes, validation |
| `system_design_architecture.pdf` | Architecture, deployment, security, non-goals |

A set of open conflicts between these documents is tracked in
[CLAUDE.md](CLAUDE.md#open-decisions). Several are blocking and must be resolved
before the corresponding feature work starts.

---

## Getting started

Requires Node.js 20.11 or later.

Run from the **repo root** (this is an npm workspace):

```bash
npm install                       # installs the whole workspace tree
cp backend/.env.example backend/.env   # then fill in the values
npm run dev:backend               # or: cd backend && npm run dev
```

Every variable in `.env.example` is validated at boot by `src/config/env.ts`.
A missing or malformed value fails immediately with a clear message rather than
surfacing later as a runtime error.

---

## Scripts

| Script                     | Purpose                                        |
| -------------------------- | ---------------------------------------------- |
| `npm run dev`              | Local server with watch mode                   |
| `npm run build`            | Compile `src/` to `dist/`                      |
| `npm start`                | Run the compiled server                        |
| `npm run typecheck`        | `tsc --noEmit` across src, api, tests, scripts |
| `npm run lint`             | ESLint                                         |
| `npm run lint:fix`         | ESLint with autofix                            |
| `npm run format`           | Prettier write                                 |
| `npm run format:check`     | Prettier check (CI gate)                       |
| `npm test`                 | Vitest, single run                             |
| `npm run test:watch`       | Vitest, watch mode                             |
| `npm run test:coverage`    | Vitest with coverage report                    |
| `npm run test:integration` | Integration suite only                         |
| `npm run openapi:generate` | Regenerate `openapi.json` from the Zod schemas |
| `npm run openapi:validate` | Fail if the committed spec is stale or invalid |
| `npm run db:indexes`       | Sync Mongoose indexes to the database          |
| `npm run verify`           | typecheck + lint + format:check + test         |

`npm run verify` is what CI runs. Run it before pushing.

---

## Project structure

```
api/index.ts            Vercel serverless entry — exports the Express app
src/
  app.ts                Builds and wires the app (never listens)
  server.ts             Local dev listener only
  config/               Validated env, doc-derived constants, OpenAPI document
  db/                   Cached connection, shared Mongoose plugins
  core/                 Errors, HTTP envelope, logger, shared types
  middleware/           Cross-cutting request middleware
  modules/              One folder per bounded module (routes + controller + service)
  routes/v1.ts          Mounts every module router under /api/v1
  integrations/         External providers, isolated behind typed wrappers
  utils/
tests/{unit,integration,setup}/
scripts/                OpenAPI generation, index sync, seeding
```

### Conventions

- **Module-first.** A feature lives in one folder under `src/modules/`, with its
  routes, controller, service, model, validation and OpenAPI registration
  together. Modules communicate through their public entry point only; reaching
  into another module's internals is blocked by lint.
- **Thin controllers.** Controllers translate HTTP to a service call and back.
  All business rules, ownership checks and transactions live in services.
- **Backend is the security boundary.** Authorisation is enforced in middleware
  and re-checked in the service layer for sensitive operations. Client-supplied
  `weddingId`, `userId`, `invitationId` and `role` values are never trusted.
- **Path aliases** use Node subpath imports: `import { config } from '#config/env.js'`.
  These resolve natively at runtime — no path-rewriting build step.
- **Soft archive, not deletion.** Business resources are archived; historical
  records are preserved.

---

## Current state

Implemented and verified (`npm run verify` — typecheck, lint, format, test —
passes; the production build has been smoke-tested end to end against a real
MongoDB instance):

- Directory structure, TypeScript (strict, NodeNext ESM), ESLint, Prettier
- Validated environment config (`src/config/env.ts`), fails fast at boot
- Error foundation: `AppError`, `ErrorCode`, Zod/Mongoose/Mongo-driver mappers
- Response envelope, pagination, and shared Zod primitives
- Structured logging (pino) with depth-agnostic secret redaction
- Serverless-safe MongoDB connection, soft-archive and toJSON Mongoose plugins
- Full middleware chain: request ID, CORS, CSRF origin check, security
  headers, cookie helpers, MongoDB-backed rate limiting
- `authenticate` (verifies the access-token cookie, stateless) and
  `load-membership` + `authorize` (resolves wedding role from
  `wedding_members`, checks it) — real implementations, not stubs
- Express app assembly, local dev server, Vercel entry point
- `health` module (`/healthz`, `/readyz`)
- `auth` module: register, login, refresh, logout, me, forgot-password,
  reset-password — Argon2id password hashing, JWT access (15 min) +
  refresh (7 days) in HttpOnly cookies, generic invalid-credentials/
  forgot-password responses, rate-limited register/login/forgot-password,
  single-use SHA-256-hashed reset tokens that expire in 1 hour and bump
  `tokenVersion` (invalidating every session) on use
- `weddings` module: create (transactional — wedding + the creator's ADMIN
  `wedding_members` row together), list mine, view one — every wedding gets
  an auto-generated unique `slug`
- OpenAPI document generation from the Zod schemas (`npm run openapi:generate`),
  served via Scalar outside production
- Cloudflare R2 integration shell (client + error mapping only — unverified
  against real credentials); Resend integration used for real by
  forgot-password when `RESEND_API_KEY` is configured, with a non-production
  fallback (the reset link comes back in the response body, never logged)
  when it isn't
- Test harness: Vitest + `mongodb-memory-server` (single-node replica set),
  158 real tests, plus the still-open required security test cases from
  `api_design.docx` §23 tracked as visible `it.todo(...)` placeholders
- Git hooks (Husky: pre-commit, commit-msg, pre-push) and GitHub Actions CI

Not yet implemented:

- Manager invites, guest/invitation/RSVP, events, tasks, vendors, expenses,
  wedding website, photos, announcements — see
  [doc/project_status.md](../doc/project_status.md) for what's next
- Every item under [Open decisions](CLAUDE.md#open-decisions) in CLAUDE.md
- R2 and Resend were verified only at the "does the client construct
  correctly" level — not against real credentials or a real bucket/account
- No enforced coverage thresholds yet (deliberate — see `vitest.config.ts`)
