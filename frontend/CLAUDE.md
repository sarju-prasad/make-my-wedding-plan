@AGENTS.md

# CLAUDE.md — frontend

Guidance for Claude Code when working in `frontend/`. Read the root
[CLAUDE.md](../CLAUDE.md) first for how this workspace fits into the
monorepo; this file is frontend-specific.

The `@AGENTS.md` include above is auto-maintained by `next dev`/`next
build` — it warns that this Next.js version may have breaking changes
from what's in a model's training data, and points at
`node_modules/next/dist/docs/` for the current API. Take that warning
seriously: `PageProps<'/route'>`/`LayoutProps<'/route'>` (see below) are a
concrete example of an API that isn't what older Next.js knowledge expects.

## What exists right now

The public landing page (`/`), reproduced directly from the real, approved
Stitch export (project `18072378067396819631`, screen
`671f69847aff45f6813834e1b1f25588` — "Make My Wedding Plan - Private
Wedding Management Platform"), plus a minimal auth + wedding-creation flow
wired to `../backend`'s `auth`/`weddings` modules:

- The design **system** (colors, type scale, radii, in `src/app/globals.css`)
  and the page's **structure, copy, and sample data** (`src/app/page.tsx`
  and `src/components/marketing/*`) are both transcribed from that export's
  actual HTML/Tailwind-config, fetched via the Stitch MCP `list_screens`/
  `get_screen` download URLs — not written from `../doc/prd.md`. (An earlier
  pass here _was_ PRD-derived, under the mistaken belief that the real
  export was behind an unreachable Google-account auth wall; it wasn't —
  the direct download URLs the MCP tools return work with a plain
  unauthenticated fetch. That draft has been replaced.)
- **Deliberate scope note**: the approved design includes product surfaces
  that aren't built yet or scoped for V1 — most notably a "Smart Stay &
  Travel Desk" module (hotel room / airport shuttle coordination) in the
  workspace-modules section, and "real-time status" / live-stream language
  in a couple of places. Explicit direction was to match the approved
  design as-is rather than trim it, so those are present. If V1 scope
  stays narrower than this, that's a product decision to make later, not a
  frontend implementation gap.
- The three photos and the header logo lockup are the exact images from
  the export, downloaded once into `public/images/` rather than kept as
  live links to Stitch's `lh3.googleusercontent.com` CDN (those links are
  Google-hosted and not guaranteed stable long-term).
- **`/sign-up`, `/sign-in`, `/forgot-password`, `/reset-password`,
  `/weddings`, `/weddings/[weddingId]`** — plain client components (no
  design reference exists for the auth pages or the wedding list; styled by
  hand with the same design tokens as the homepage). `/weddings` is the
  create-wedding form plus the "your weddings" list; each card links to
  `/weddings/[weddingId]`, the wedding overview/dashboard page — its
  visual language (hero card, countdown badge, quick-actions grid) is
  transcribed from a real but previously-hidden Stitch screen in the same
  project (`7aa0c8f50a5b4fa9818aed91ba712b7f`, "Wedding Command Center"),
  cut down to only the sections backed by real data today (no fabricated
  tasks/RSVP/vendor/budget numbers — those modules don't exist yet, so
  those sections of that screen weren't built). Its "Wedding team" section
  (`components/wedding/MembersSection.tsx`) is real: list/add/role-change/
  remove against the backend's Members API, with ADMIN-only controls shown
  or hidden based on the viewer's own row in the fetched member list.
  `/reset-password` reads `?token=` via `useSearchParams()`, which Next.js
  requires wrapping in `<Suspense>` for static prerendering to work — see
  that file for the pattern if another page needs `useSearchParams()`.
- `src/lib/api.ts` — the only place that calls `../backend`. Cookie-based
  auth (`credentials: 'include'`), unwraps the standard success/error
  envelope, throws `ApiError` on failure. `NEXT_PUBLIC_API_BASE_URL`
  (`.env.example`) points at the backend's `/api/v1`.
- `src/lib/date.ts` — `formatWeddingDate()`, shared by `/weddings` and
  `/weddings/[weddingId]`. Always pass the wedding's own `timezone`, not
  the viewer's — two weddings on the same page can be in different zones.
- The homepage's `plan-your-wedding` CTAs (Header, Hero, FinalCta) now link
  to `/sign-up`; its `sign-in` links now go to `/sign-in`. Every other
  nav/CTA link is still `#` — no page exists for them yet (see "Open items").
- Still nothing built: guest-facing wedding site, Manager-invite UI, or any
  of the modules the wedding overview page's quick actions point at
  (Events, Guests, Tasks, Vendors, Expenses, Wedding Website) — each shows
  a "Coming soon" state rather than a broken link or fake data.

## Stack and fixed decisions

- Next.js 16, App Router, TypeScript, Tailwind CSS v4
- Tailwind config lives in `globals.css` via `@theme` — no
  `tailwind.config.ts`. Add new design tokens there, not inline in
  components.
- Fonts via `next/font/google`: Playfair Display (headline, weights
  400–500 only — the design spec warns heavier weights blur its serif
  detail) and Plus Jakarta Sans (body).
- Light mode only — the source design system has no dark variant.

## Things that will bite

- **`next dev`'s default bundler (Turbopack) cannot resolve `next/font/google`
  in this install.** Every font weight/subset fails with `Module not found:
Can't resolve '@vercel/turbopack-next/internal/font/google/font'`, in a
  retry loop. Confirmed this is dev-mode-and-Turbopack-specific, not a config
  problem: `next build` (which also uses Turbopack, for production) compiles
  the exact same font imports without error, and `next dev --webpack` serves
  the page correctly with fonts applied (checked the response HTML for the
  font loader's `__variable_*` classes). `package.json`'s `dev` script
  already pins `next dev --webpack` for this reason — don't "simplify" it
  back to bare `next dev`, and don't assume a font-loader error means the
  font config is wrong before checking which bundler is running.
- **`next typecheck` alone fails on a fresh checkout.** `PageProps`/
  `LayoutProps` are generated by `next dev`/`next build`/`next typegen`,
  not present beforehand. The `typecheck` script here runs `next typegen`
  first for exactly this reason — don't "simplify" it back to bare `tsc`.
- **Tailwind v4, not v3.** No JS config file; `@theme` blocks in CSS.
  Opacity modifiers (`bg-canvas/80`) work automatically on any custom
  `--color-*` token via `color-mix()` — verified directly in compiled
  output, not assumed.
- **Binary hoisting is unpredictable across workspaces.** `frontend`'s
  eslint/prettier landed in the _root_ `node_modules/.bin`; `backend`'s
  landed in its _own_. Don't hardcode either path — use `npx --no --
<tool>` (see root `lint-staged.config.mjs`), which resolves correctly
  either way.

## Open items

- No test runner yet (see root README's note on React Testing Library).
- Most nav/CTA links (How it works, Features, Planning Suite, Privacy) are
  still `#` — no corresponding page or section exists yet.
- A product decision on the Stay & Travel Desk / real-time-language scope
  note above (see "What exists right now") is still open.
- No guest-facing wedding site or Manager-invite UI yet.
