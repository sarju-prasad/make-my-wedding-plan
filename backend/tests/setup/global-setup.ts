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
}

export async function teardown(): Promise<void> {
  await replSet?.stop();
}
