#!/usr/bin/env node
// lint-staged v17 spawns each task command directly via `tinyexec`, with no
// shell involved — the command string is tokenized with `string-argv` and
// the first token is spawned as a literal executable (confirmed by reading
// node_modules/lint-staged/lib/getSpawnedTask.js). That means a command
// string like `cd frontend && npx --no -- eslint --fix ...` cannot work:
// `cd` gets treated as a (non-existent) executable rather than a shell
// builtin, failing with "The system cannot find the path specified."
// lint-staged also threads through a single `cwd` for the whole run, with
// no per-command override in its config API.
//
// This script is the workaround: lint-staged spawns *this* file (a real,
// resolvable executable — `node`), and it does the working-directory switch
// itself via the `cwd` option on its own child_process call, which Node
// supports natively without needing a shell for the outer command.
import { spawnSync } from "node:child_process";

const [workspace, tool, ...args] = process.argv.slice(2);

// `--no` skips npx's install-prompt; `--` stops npx from parsing the rest of
// the args as its own flags. Running via `npx` (not a hardcoded binary path)
// is deliberate: which workspace's node_modules/.bin actually holds a given
// tool isn't predictable under npm's hoisting (see lint-staged.config.mjs),
// and `npx` resolves the right one by walking up from `cwd`.
const result = spawnSync("npx", ["--no", "--", tool, ...args], {
  cwd: workspace,
  stdio: "inherit",
  shell: true,
});

if (result.error) {
  console.error(result.error);
  process.exit(1);
}

process.exit(result.status ?? 1);
