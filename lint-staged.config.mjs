// Root lint-staged config (function-based — package.json's `lint-staged`
// field can't hold functions, so this lives here instead).
//
// Two things this works around, both verified empirically rather than assumed:
//
// 1. ESLint's flat-config `files:` glob overrides (e.g.
//    backend/eslint.config.js's `scripts/**/*.ts` -> no-console: off) are
//    matched relative to where the pattern was written for, and lint-staged
//    invoked from the repo root passes staged files as repo-root-relative
//    paths (`backend/scripts/foo.ts`). That extra prefix silently breaks
//    every such override — confirmed by running eslint against a
//    root-relative path and seeing the overrides not apply. Fixed by `cd`ing
//    into the workspace and linting workspace-relative paths instead,
//    reproducing the already-correct invocation.
//
// 2. Which workspace's node_modules/.bin actually holds a given binary is
//    NOT predictable: npm's hoisting put backend's eslint/prettier in
//    backend/node_modules/.bin (version conflict with the root's own copies)
//    but frontend's eslint/prettier in the ROOT node_modules/.bin (no
//    conflict) — confirmed by checking both directly. Hardcoding either
//    path breaks for the other workspace. `npx --no --` resolves this
//    correctly either way: it walks up from CWD through every ancestor
//    node_modules/.bin, so `cd <workspace> && npx --no -- eslint` always
//    finds that workspace's own pinned version regardless of where npm
//    decided to put it.
import path from 'node:path';

function relativeTo(workspace, filenames) {
  return filenames
    .filter((f) => f.startsWith(workspace + path.sep) || f.startsWith(workspace + '/'))
    .map((f) => path.relative(workspace, f));
}

function workspaceCommands(workspace, files, { eslint = true } = {}) {
  const quoted = files.map((f) => JSON.stringify(f)).join(' ');
  const commands = [];
  if (eslint) commands.push(`cd ${workspace} && npx --no -- eslint --fix ${quoted}`);
  commands.push(`cd ${workspace} && npx --no -- prettier --write ${quoted}`);
  return commands;
}

export default {
  'backend/**/*.{ts,js}': (filenames) => {
    const files = relativeTo('backend', filenames);
    return files.length === 0 ? [] : workspaceCommands('backend', files);
  },
  'backend/**/*.{json,md,yml,yaml}': (filenames) => {
    const files = relativeTo('backend', filenames);
    return files.length === 0 ? [] : workspaceCommands('backend', files, { eslint: false });
  },
  'frontend/**/*.{ts,tsx,js,jsx}': (filenames) => {
    const files = relativeTo('frontend', filenames);
    return files.length === 0 ? [] : workspaceCommands('frontend', files);
  },
  'frontend/**/*.{json,md,css}': (filenames) => {
    const files = relativeTo('frontend', filenames);
    return files.length === 0 ? [] : workspaceCommands('frontend', files, { eslint: false });
  },
};
