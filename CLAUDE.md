# CLAUDE.md

Guidance for Claude Code when working in this repository.

## What this is

**Make My Wedding Plan** — a private, invitation-only wedding management
platform for Indian weddings. This repo is an **npm-workspaces monorepo**:

- [`backend/`](backend) — Node.js + Express + TypeScript + MongoDB REST API.
  Has its own [backend/CLAUDE.md](backend/CLAUDE.md) with backend-specific
  rules, stack decisions, and open questions — read it before touching
  anything under `backend/`.
- [`frontend/`](frontend) — Next.js app. Has its own
  [frontend/CLAUDE.md](frontend/CLAUDE.md) — read it before touching
  anything under `frontend/`. Only the public landing page exists so far,
  and it's a first draft (see that file for what that means).
- [`doc/`](doc) — the four source-of-truth design documents both workspaces
  answer to (PRD, DB design, API design, system architecture). Never edit,
  rename, or reformat these.

## Repo-wide vs workspace-scoped

Git hooks (`.husky/`), commit message rules (`commitlint.config.js`), CI
(`.github/workflows/`), and editor baselines (`.editorconfig`,
`.gitattributes`) live at the repo root and apply to both workspaces.
Everything else — dependencies, linting, formatting, tests, build — is owned
by each workspace individually. `npm install` runs once, at the repo root
(npm workspaces hoist into one `node_modules`); `npm run <script>` for a
specific workspace runs either via `npm run <script> --workspace=<name>` or
by `cd`-ing into that workspace first.

## Known deviation from the design docs

`system_design_architecture.pdf` calls for two separate repositories
(`make-my-wedding-frontend`, `make-my-wedding-backend`). This repo was
deliberately restructured into one monorepo instead, at the user's explicit
request. That document has not been updated to match — don't treat the
mismatch as a bug to silently fix.

## Where to go next

For anything backend-related, read [backend/CLAUDE.md](backend/CLAUDE.md)
first — it has the real stack decisions, architecture rules, things that will
bite, and the list of open product/design decisions blocking specific
features.

For anything frontend-related, read
[frontend/CLAUDE.md](frontend/CLAUDE.md) first — it covers the Next.js 16 /
Tailwind v4 stack decisions, what's real versus draft in the current
homepage, and things that will bite.
