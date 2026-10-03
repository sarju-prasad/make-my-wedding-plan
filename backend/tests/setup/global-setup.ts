/**
 * Vitest `globalSetup` — runs once for the entire test run, in its own
 * process, before any test file is loaded.
 *
 * Starts a single-node MongoDB replica set (required for transactions —
 * db_design.docx §9 and api_design.docx §22 both call for them on wedding
 * creation and website publishing) and publishes its connection details via
 * `process.env`. This was verified empirically: `process.env` mutations made
 * here DO propagate to the test-worker processes Vitest spawns afterwards
 * (Node's fork inherits the parent's environment at fork time) — confirmed
 * against this project's installed Vitest version before relying on it.
 *
 * What this file does NOT do: connect Mongoose. A connection is a live
 * socket tied to a process, and this setup process is not the process the
 * actual tests run in — each test file connects for itself via
 * tests/setup/test-setup.ts (Vitest's `setupFiles`, which does run inside
 * the worker).
 */
import { MongoMemoryReplSet } from 'mongodb-memory-server';

let replSet: MongoMemoryReplSet | null = null;

export async function setup(): Promise<void> {
  replSet = await MongoMemoryReplSet.create({ replSet: { count: 1 } });

  process.env.NODE_ENV = 'test';
  process.env.MONGODB_URI = replSet.getUri();
  process.env.MONGODB_DB_NAME = 'make-my-wedding-plan-test';

  // Values env.ts requires but which no test exercises directly — present
  // so schema validation passes, not chosen for any cryptographic property.
  process.env.APP_BASE_URL ??= 'http://localhost:4000';
  process.env.WEB_BASE_URL ??= 'http://localhost:3000';
  process.env.JWT_ACCESS_SECRET ??= 'test-access-secret-00000000000000000000000';
  process.env.JWT_REFRESH_SECRET ??= 'test-refresh-secret-0000000000000000000000';
  process.env.LOG_LEVEL ??= 'silent';
  process.env.CORS_ALLOWED_ORIGINS ??= 'http://localhost:3000';

  // Forced to '', not deleted: config/env.ts's dotenv.config() runs again
  // separately inside each forked test-worker process, and only fills in
  // process.env keys that process doesn't already have — a `delete` here
  // (this is a different, earlier process; see this file's own top comment)
  // leaves the key merely absent by the time of the fork, which dotenv would
  // then load fresh from .env's file contents in the worker regardless.
  // Setting it to '' here, which *does* propagate through the fork, makes
  // dotenv see the key as already present and skip it — '' is still falsy
  // for every `if (env.RESEND_API_KEY)` check. Without this, a real
  // RESEND_API_KEY in a developer's local .env (added for live manual
  // testing) leaks into every test run too: auth.service.ts's
  // requestPasswordReset() and invitations.service.ts's
  // deliverInvitationEmail() both branch on whether this is configured
  // specifically so tests can exercise the dev-fallback (devResetUrl/
  // devInviteUrl) path instead of attempting a real Resend API call, which
  // fails outright against this suite's `@example.com` addresses (Resend's
  // sandbox rejects non-test domains) — confirmed empirically: this exact
  // failure reproduced against tests/integration/auth.test.ts before this
  // fix, with a real key present in .env.
  process.env.RESEND_API_KEY = '';
  process.env.EMAIL_FROM = '';
}

export async function teardown(): Promise<void> {
  await replSet?.stop();
}
