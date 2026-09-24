/**
 * MongoDB connection management for a serverless-hosted Express app.
 *
 * Vercel reuses a warm function instance across many invocations, so a naive
 * `mongoose.connect()` per request would open a new connection every time and
 * exhaust the Atlas connection limit within minutes. The fix — cache the
 * connection promise on `globalThis` so it survives warm reuse (and local
 * dev's hot reload, which would otherwise re-run this module from scratch on
 * every file save).
 *
 * system_design_architecture.pdf §5, §15:
 *   - bufferCommands: false — otherwise a query issued before the connection
 *     is ready queues silently for ~10s and then fails with an opaque
 *     timeout, instead of the caller seeing a clear "not connected" error.
 *   - Small pool (maxPoolSize 5, minPoolSize 0) — many concurrent lambdas
 *     each holding a large pool is how the Atlas connection cap gets hit.
 *   - Layered timeouts (serverSelectionTimeoutMS, socketTimeoutMS).
 *   - autoIndex disabled outside development — indexes are synced explicitly
 *     via `npm run db:indexes` (scripts/sync-indexes.ts), never implicitly
 *     on a cold start.
 *   - The connection is never closed at the end of a request.
 */
import mongoose from 'mongoose';

import { env, isDevelopment } from '#config/env.js';
import { logger } from '#core/logger/logger.js';

const CONNECTION_OPTIONS = {
  dbName: env.MONGODB_DB_NAME,
  bufferCommands: false,
  maxPoolSize: 5,
  minPoolSize: 0,
  serverSelectionTimeoutMS: 5000,
  socketTimeoutMS: 20000,
  autoIndex: isDevelopment,
} satisfies mongoose.ConnectOptions;

interface ConnectionCache {
  promise: Promise<typeof mongoose> | null;
}

// Cached on globalThis (not a module-level `let`) so the connection survives
// serverless warm reuse and, locally, tsx watch's module re-evaluation.
const globalForMongoose = globalThis as typeof globalThis & {
  __mongooseConnection?: ConnectionCache;
};

const cache: ConnectionCache = (globalForMongoose.__mongooseConnection ??= { promise: null });

/**
 * Establishes (or reuses) the MongoDB connection. Safe to call on every
 * request — after the first successful call, this resolves immediately
 * against the cached promise rather than reconnecting.
 */
export async function connectDb(): Promise<typeof mongoose> {
  cache.promise ??= mongoose
    .connect(env.MONGODB_URI, CONNECTION_OPTIONS)
    .then((instance) => {
      logger.info({ dbName: env.MONGODB_DB_NAME }, 'MongoDB connected.');
      return instance;
    })
    .catch((error: unknown) => {
      // Let the next call retry instead of caching a permanently rejected promise.
      cache.promise = null;
      logger.error({ err: error }, 'MongoDB connection failed.');
      throw error;
    });

  return await cache.promise;
}

/**
 * Connection readiness, for the /readyz endpoint. Does not attempt to
 * connect — a wedding platform under load should report "not ready" fast,
 * not hang a health check while establishing a fresh connection.
 */
export function isDbReady(): boolean {
  return mongoose.connection.readyState === mongoose.ConnectionStates.connected;
}

/**
 * Local development / test teardown only. Never called in a request path —
 * a serverless invocation must never close the connection other requests may
 * still be using.
 */
export async function disconnectDb(): Promise<void> {
  await mongoose.disconnect();
  cache.promise = null;
}

mongoose.connection.on('disconnected', () => {
  logger.warn('MongoDB disconnected.');
});

mongoose.connection.on('reconnected', () => {
  logger.info('MongoDB reconnected.');
});
