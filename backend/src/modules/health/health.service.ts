/**
 * Business logic for liveness/readiness — trivial here, but kept in a
 * service rather than inline in the controller so every module follows the
 * same thin-controller convention from day one (see CLAUDE.md).
 */
import { logger } from '#core/logger/logger.js';
import { connectDb, isDbReady } from '#db/connection.js';

const processStartedAt = Date.now();

export interface LivenessResult {
  status: 'ok';
  uptimeSeconds: number;
}

export interface ReadinessResult {
  status: 'ok' | 'not_ready';
  db: 'connected' | 'disconnected';
  uptimeSeconds: number;
}

function uptimeSeconds(): number {
  return Math.floor((Date.now() - processStartedAt) / 1000);
}

/** Liveness never touches the database — a DB outage must not make the process look dead. */
export function getLiveness(): LivenessResult {
  return { status: 'ok', uptimeSeconds: uptimeSeconds() };
}

/**
 * Readiness actively attempts a connection rather than only observing
 * `mongoose.connection.readyState` — on a cold start, nothing else has
 * necessarily called connectDb() yet, so a purely passive check would report
 * "not ready" forever until some other request happened to trigger a
 * connect. The attempt is bounded by connection.ts's own
 * serverSelectionTimeoutMS (5s), so this can't hang indefinitely.
 */
export async function getReadiness(): Promise<ReadinessResult> {
  if (!isDbReady()) {
    try {
      await connectDb();
    } catch (error) {
      logger.warn({ err: error }, 'Readiness check: database connection attempt failed.');
    }
  }

  const dbReady = isDbReady();
  return {
    status: dbReady ? 'ok' : 'not_ready',
    db: dbReady ? 'connected' : 'disconnected',
    uptimeSeconds: uptimeSeconds(),
  };
}
