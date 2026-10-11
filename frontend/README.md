# Make My Wedding Plan — Frontend

Next.js frontend for **Make My Wedding Plan**, a private, invitation-only
wedding management platform for Indian weddings. This is the `frontend/`
workspace of the monorepo; the Express/TypeScript/MongoDB API lives alongside
it at [`../backend`](../backend).

> **Status:** the public landing page is a first draft (see below) — the
> family dashboard, guest-facing wedding site, and every authenticated view
> are not built yet.

---

## Stack

| Concern       | Choice                                                                                                                           |
| ------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| Framework     | Next.js 16, App Router                                                                                                           |
| Language      | TypeScript                                                                                                                       |
| Styling       | Tailwind CSS v4 (CSS-first `@theme`, no `tailwind.config.js`)                                                                    |
| Fonts         | Playfair Display (headlines), Plus Jakarta Sans (body) — via `next/font/google`                                                  |
| Design system | Transcribed from the "Bridal SaaS Editorial" system attached to the project's Stitch design (see `../doc/` and root `CLAUDE.md`) |

## Design system

`src/app/globals.css` defines the full token set — colors, radii, and font
family mappings — copied **verbatim** from the Stitch-generated design
system's written spec, not approximated. If a color or radius doesn't exist
as a token there, don't invent one inline; extend `globals.css` instead so
every component draws from the same source.

The homepage's actual **section content and copy** is a separate matter from
the design system: it's a first draft written from `../doc/prd.md`, not a
reproduction of the real approved Stitch screen (that screen's HTML/screenshot
sit behind a Google-account-authenticated link this environment can't reach).
See the comment at the top of `src/app/page.tsx`.

## Getting started

Run from the **repo root** (this is an npm workspace):

```bash
npm install                # installs the whole workspace tree
npm run dev:frontend       # or: cd frontend && npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Scripts

| Script                            | Purpose                                                   |
| --------------------------------- | --------------------------------------------------------- |
| `npm run dev`                     | Local dev server                                          |
| `npm run build`                   | Production build (also generates route types — see below) |
| `npm start`                       | Run the production build                                  |
| `npm run typecheck`               | `next typegen && tsc --noEmit`                            |
| `npm run lint`                    | ESLint (`eslint-config-next`)                             |
| `npm run format` / `format:check` | Prettier                                                  |
| `npm run verify`                  | typecheck + lint + format:check + build — what CI runs    |

### Why `typecheck` runs `next typegen` first

Next.js 16 generates global route-aware types (`PageProps<'/route'>`,
`LayoutProps<'/route'>`) during `next dev`, `next build`, or `next typegen` —
they don't exist beforehand. A bare `tsc --noEmit` on a fresh checkout fails
with `Cannot find name 'LayoutProps'` otherwise (confirmed while setting this
up). `next typegen` generates just the types, without a full build.

## Project structure

```
src/
  app/
    layout.tsx      Root layout — fonts, metadata, html/body shell
    page.tsx         The homepage (composes the sections below)
    globals.css      Tailwind import + the full design system @theme
  components/
    marketing/       Homepage sections (Header, Hero, Features, ...)
```

## Notes for whoever (or whichever agent) works here next

- **This Next.js version may differ from what you remember.** `AGENTS.md`
  (auto-maintained by `next dev`/`next build`) says so directly — check
  `node_modules/next/dist/docs/` for the current API before assuming an
  older convention still applies. `PageProps`/`LayoutProps` route helpers are
  one concrete example that changed.
- Tailwind v4 config lives in `globals.css` via `@theme` — there is no
  `tailwind.config.ts` in this project by design.
- No test runner is set up yet. `system_design_architecture.pdf` §15 calls
  for React Testing Library for important frontend flows — worth adding
  once there's a component substantial enough to justify it, not
  speculatively ahead of that.
