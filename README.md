# Make My Wedding Plan

A private, invitation-only wedding management platform for Indian weddings.

This repository is an **npm-workspaces monorepo**:

| Workspace | What it is | Docs |
|---|---|---|
| [`backend/`](backend) | Node.js + Express + TypeScript + MongoDB REST API | [backend/README.md](backend/README.md) |
| [`frontend/`](frontend) | Next.js app (public landing page, family dashboard, guest-facing wedding site) | [frontend/README.md](frontend/README.md) |
| [`doc/`](doc) | Shared source-of-truth design docs (PRD, DB design, API design, system architecture) — both workspaces answer to these | — |

## Getting started

```bash
npm install              # installs the whole workspace tree from the repo root
npm run dev:backend      # start the backend API
npm run dev:frontend     # start the frontend (once it exists)
```

Each workspace has its own README with full setup, scripts, and environment
variable details.

## Repo-wide tooling

These apply across both workspaces and live at the repo root, not inside
either one: git hooks (`.husky/`), commit message rules (`commitlint.config.js`),
CI (`.github/workflows/`), and editor/formatting baselines (`.editorconfig`,
`.gitattributes`). Each workspace still owns its own linter, formatter, and
test configuration.

## Note on architecture

`system_design_architecture.pdf` (in `doc/`) originally called for two
separate repositories. This repo was deliberately restructured into a single
monorepo with `backend/` and `frontend/` workspaces instead — that document
has not yet been updated to match.
