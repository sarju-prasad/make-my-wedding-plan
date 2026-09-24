// Root lint-staged config (function-based — package.json's `lint-staged`
// field can't hold functions, so this lives here instead).
//
// Why this exists: ESLint's flat-config `files:` glob overrides (e.g.
// backend/eslint.config.js's `scripts/**/*.ts` -> no-console: off) are
// matched relative to where the pattern was written for, and lint-staged
// invoked from the repo root passes staged files as repo-root-relative
// paths (`backend/scripts/foo.ts`). That extra `backend/` prefix silently
// breaks every override in backend/eslint.config.js — verified empirically:
// running eslint with `--config backend/eslint.config.js` against a
// root-relative path applied the base rules but not the per-glob overrides.
//
// The fix is to reproduce the exact, already-working invocation — `cd
// backend` and pass paths relative to *backend* — rather than fight path
// relativity across the CWD boundary. eslint has no --cwd flag to do this
// for us (checked), so this does it by hand.
import path from 'node:path';

function toBackendRelative(filenames) {
  return filenames
    .filter((f) => f.startsWith('backend' + path.sep) || f.startsWith('backend/'))
    .map((f) => path.relative('backend', f));
}

export default {
  'backend/**/*.{ts,js}': (filenames) => {
    const files = toBackendRelative(filenames);
    if (files.length === 0) return [];
    const quoted = files.map((f) => JSON.stringify(f)).join(' ');
    return [
      `cd backend && node_modules/.bin/eslint --fix ${quoted}`,
      `cd backend && node_modules/.bin/prettier --write ${quoted}`,
    ];
  },
  'backend/**/*.{json,md,yml,yaml}': (filenames) => {
    const files = toBackendRelative(filenames);
    if (files.length === 0) return [];
    const quoted = files.map((f) => JSON.stringify(f)).join(' ');
    return [`cd backend && node_modules/.bin/prettier --write ${quoted}`];
  },
};
