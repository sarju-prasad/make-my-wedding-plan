/**
 * Syncs MongoDB indexes to match every registered Mongoose schema —
 * db_design.docx §6 (indexing strategy), and connection.ts's own
 * `autoIndex: false` outside development (indexes are never built implicitly
 * on a cold start; this script is the explicit, deliberate alternative).
 *
 * With zero business models registered yet, this currently connects and
 * reports nothing to sync — that's the correct, honest behaviour for the
 * scaffold's current state, not a bug. It will start doing real work the
 * moment the first model is added, with no changes needed here.
 *
 * Run with: npm run db:indexes
 */
import mongoose from 'mongoose';

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
