/**
 * Syncs MongoDB indexes to match every registered Mongoose schema —
 * db_design.docx §6 (indexing strategy), and connection.ts's own
 * `autoIndex: false` outside development (indexes are never built implicitly
 * on a cold start; this script is the explicit, deliberate alternative —
 * it must be run against every non-development environment, including
 * production, or none of the unique indexes below actually exist there).
 *
 * Mongoose only knows about a schema once its module has been evaluated —
 * `mongoose.modelNames()` is empty until something imports it. Routes/
 * services import these transitively in the running app, but this script
 * has no reason to load any of that, so every model is imported here
 * directly, purely for the registration side effect (same reasoning as
 * routes/v1.ts's `import '../modules/x/x.openapi.js'` lines). Forgetting one
 * here silently means its collection just never gets indexed — there's no
 * other signal that a model was missed, so a new model file means a new
 * import here.
 *
 * Run with: npm run db:indexes
 */
import mongoose from 'mongoose';

import '../src/modules/auth/auth.model.js';
import '../src/modules/events/events.model.js';
import '../src/modules/weddings/invitations.model.js';
import '../src/modules/weddings/members.model.js';
import '../src/modules/weddings/weddings.model.js';

import { connectDb, disconnectDb } from '../src/db/connection.js';

async function main(): Promise<void> {
  await connectDb();

  const modelNames = mongoose.modelNames();
  if (modelNames.length === 0) {
    console.log('No models registered yet — nothing to sync.');
    await disconnectDb();
    return;
  }

  console.log(`Syncing indexes for: ${modelNames.join(', ')}`);
  const result = await mongoose.connection.syncIndexes();

  for (const [modelName, dropped] of Object.entries(result)) {
    const droppedList = dropped;
    if (droppedList.length > 0) {
      console.log(`  ${modelName}: dropped stale indexes → ${droppedList.join(', ')}`);
    } else {
      console.log(`  ${modelName}: up to date`);
    }
  }

  await disconnectDb();
  console.log('Done.');
}

main().catch((error: unknown) => {
  console.error('Index sync failed:', error);
  process.exitCode = 1;
});
