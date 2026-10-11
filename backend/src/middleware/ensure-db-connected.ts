/**
 * Awaits connectDb() before any non-health route runs.
 *
 * api/index.ts deliberately never connects at module scope — a cold start
 * must still be able to serve /healthz even if the database is unreachable
 * — and connection.ts sets `bufferCommands: false`, so a query issued
 * before the connection actually finishes fails immediately instead of
 * queueing. Without this gate, the first request to reach a fresh
 * serverless instance through any route the rate limiter doesn't already
 * happen to touch first (e.g. GET /auth/me has no rate limiter) races the
 * connection and 500s. A connection failure here still reaches
 * error-mappers.ts's existing isMongoConnectivityError() handling, which
 * already turns it into a clean 503.
 *
 * Mounted after healthRouter and before every other v1 route — see
 * routes/v1.ts — so liveness/readiness stay DB-independent as designed.
 */
import type { NextFunction, Request, Response } from 'express';

import { connectDb } from '#db/connection.js';

export function ensureDbConnected(req: Request, res: Response, next: NextFunction): void {
  connectDb()
    .then(() => {
      next();
    })
    .catch(next);
}
