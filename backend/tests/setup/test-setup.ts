/**
 * Vitest `setupFiles` — runs inside the actual test-worker process, once per
 * worker, before that worker's test files execute. This is where the real
 * Mongoose connection is established (globalSetup.ts only starts the Mongo
 * binary and publishes its URI — it runs in a separate process and can't
 * hold a connection the test worker could use).
 *
 * Applies uniformly to every test file, including tests/unit ones that don't
 * touch the database — the connection is fast (a local in-memory instance
 * already running by the time this fires) and this keeps the setup story to
 * one file. Worth splitting into a DB-free project config if the unit suite
 * grows large enough for the overhead to matter.
 */
import mongoose from 'mongoose';
import { afterAll, afterEach, beforeAll } from 'vitest';

import { connectDb, disconnectDb } from '../../src/db/connection.js';

beforeAll(async () => {
  await connectDb();
});

afterEach(async () => {
  const { collections } = mongoose.connection;
  await Promise.all(Object.values(collections).map((collection) => collection.deleteMany({})));
});

afterAll(async () => {
  await disconnectDb();
});
