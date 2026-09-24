// Root lint-staged config (function-based — package.json's `lint-staged`
// field can't hold functions, so this lives here instead).
//
// Three things this works around, all verified empirically rather than assumed:
//
// 1. ESLint's flat-config `files:` glob overrides (e.g.
//    backend/eslint.config.js's `scripts/**/*.ts` -> no-console: off) are
//    matched relative to where the pattern was written for, and lint-staged
//    invoked from the repo root passes staged files as repo-root-relative
//    paths (`backend/scripts/foo.ts`). That extra prefix silently breaks
//    every such override — confirmed by running eslint against a
//    root-relative path and seeing the overrides not apply. Fixed by running
//    with the process's `cwd` set to the workspace and linting
//    workspace-relative paths instead, reproducing the already-correct
//    invocation.
//
// 2. Which workspace's node_modules/.bin actually holds a given binary is
//    NOT predictable: npm's hoisting put backend's eslint/prettier in
//    backend/node_modules/.bin (version conflict with the root's own copies)
//    but frontend's eslint/prettier in the ROOT node_modules/.bin (no
//    conflict) — confirmed by checking both directly. Hardcoding either
//    path breaks for the other workspace. Running `npx --no --` with `cwd`
//    set to the workspace resolves this correctly either way: it walks up
//    from `cwd` through every ancestor node_modules/.bin, so it always finds
//    that workspace's own pinned version regardless of where npm decided to
//    put it.
//
// 3. lint-staged v17 spawns each task command directly (no shell — see
//    node_modules/lint-staged/lib/getSpawnedTask.js, which tokenizes the
//    command string and spawns the first token as a literal executable). A
//    command string like `cd frontend && npx ...` therefore cannot work:
//    `cd` isn't a real executable, only a shell builtin, and fails with
//    "The system cannot find the path specified" — confirmed by running
//    lint-staged with `--debug` and by a real `git commit`, both of which
//    reproduced the failure. There's also no per-command `cwd` in
//    lint-staged's config API to work around it that way. Fixed by routing
//    every command through scripts/lint-staged-run.mjs, a real executable
//    (`node <script>`) that lint-staged CAN spawn directly, which does the
//    workspace `cwd` switch itself via child_process's own `cwd` option.
import path from "node:path";

// lint-staged v17 passes absolute paths to task functions by default (not
// workspace-relative ones, despite what this config used to assume —
// confirmed with `lint-staged --debug`, which showed the old startsWith()
// filter rejecting every file and silently returning [] for every commit).
// lint-staged has already scoped `filenames` to this glob before calling the
// function, so there's nothing left to filter — this just converts whatever
// path format it was given into a path relative to the workspace, for the
// workspace-relative commands below.
function relativeTo(workspace, filenames) {
  const workspaceAbs = path.resolve(workspace);
  return filenames.map((f) => path.relative(workspaceAbs, f));
}

function workspaceCommands(workspace, files, { eslint = true } = {}) {
  const quoted = files.map((f) => JSON.stringify(f)).join(" ");
  const runner = "scripts/lint-staged-run.mjs";
  const commands = [];
  if (eslint) commands.push(`node ${runner} ${workspace} eslint --fix ${quoted}`);
  commands.push(`node ${runner} ${workspace} prettier --write ${quoted}`);
  return commands;
}

export default {
  "backend/**/*.{ts,js}": (filenames) => {
    const files = relativeTo("backend", filenames);
    return files.length === 0 ? [] : workspaceCommands("backend", files);
  },
  "backend/**/*.{json,md,yml,yaml}": (filenames) => {
    const files = relativeTo("backend", filenames);
    return files.length === 0 ? [] : workspaceCommands("backend", files, { eslint: false });
  },
  "frontend/**/*.{ts,tsx,js,jsx}": (filenames) => {
    const files = relativeTo("frontend", filenames);
    return files.length === 0 ? [] : workspaceCommands("frontend", files);
  },
  "frontend/**/*.{json,md,css}": (filenames) => {
    const files = relativeTo("frontend", filenames);
    return files.length === 0 ? [] : workspaceCommands("frontend", files, { eslint: false });
  },
};
