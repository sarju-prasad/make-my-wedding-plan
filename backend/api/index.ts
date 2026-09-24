/**
 * Vercel serverless entry point.
 *
 * Exports the Express app directly — Vercel's Node.js runtime accepts a
 * request-listener-shaped default export, which an Express app already is.
 * Never calls listen() and never connects to MongoDB at module scope: a cold
 * start must be able to serve /api/v1/healthz even if the database is
 * unreachable (see modules/health/health.service.ts). The database connects
 * lazily, the first time a request actually needs it — /readyz drives that
 * for itself; other routes will call connectDb() from their own service
 * layer as they're built.
 *
 * vercel.json routes every request here via a catch-all rewrite.
 */
import { createApp } from '../src/app.js';

export default createApp();
