/**
 * Local development server — the only place in this codebase that binds a
 * port. Not used on Vercel; serverless deployments enter through
 * api/index.ts, which never calls listen() and lets the platform manage the
 * process lifecycle.
 *
 * Connects to MongoDB before accepting traffic — if the database is
 * unreachable at startup, that should fail loudly immediately, not surface
 * later as every request's first query timing out.
 */
import { createApp } from './app.js';
import { env } from './config/env.js';
import { logger } from './core/logger/logger.js';
import { connectDb, disconnectDb } from './db/connection.js';

const SHUTDOWN_TIMEOUT_MS = 10_000;

async function main(): Promise<void> {
  await connectDb();

  const app = createApp();
  const server = app.listen(env.PORT, () => {
    logger.info({ port: env.PORT, baseUrl: env.APP_BASE_URL }, 'Server listening.');
  });

  let shuttingDown = false;

  async function shutdown(signal: string): Promise<void> {
    if (shuttingDown) return;
    shuttingDown = true;

    logger.info({ signal }, 'Shutting down…');

    const forceExit = setTimeout(() => {
      logger.error('Graceful shutdown timed out — forcing exit.');
      process.exit(1);
    }, SHUTDOWN_TIMEOUT_MS);
    forceExit.unref();

    server.close(() => {
      logger.info('HTTP server closed.');
    });

    await disconnectDb();
    clearTimeout(forceExit);
    process.exit(0);
  }

  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
}

main().catch((error: unknown) => {
  logger.fatal({ err: error }, 'Failed to start server.');
  process.exit(1);
});
