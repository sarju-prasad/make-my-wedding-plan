/**
 * Regenerates openapi.json from the Zod schemas — api_design.docx §23
 * ("Generate and validate Swagger/OpenAPI documentation during CI").
 *
 * Importing routes/v1.ts triggers every mounted module's `*.openapi.ts` via
 * its side-effect import (see routes/v1.ts), which registers that module's
 * paths into the shared document before buildOpenApiDocument() runs.
 *
 * Run with: npm run openapi:generate
 */
import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { buildOpenApiDocument } from '../src/config/openapi.js';
import '../src/routes/v1.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUTPUT_PATH = path.join(__dirname, '..', 'openapi.json');

async function main(): Promise<void> {
  const document = buildOpenApiDocument();
  const json = `${JSON.stringify(document, null, 2)}\n`;

  await writeFile(OUTPUT_PATH, json, 'utf8');

  const pathCount = Object.keys(document.paths ?? {}).length;
  console.log(`Wrote ${OUTPUT_PATH} (${pathCount} path${pathCount === 1 ? '' : 's'}).`);
}

main().catch((error: unknown) => {
  console.error('Failed to generate OpenAPI document:', error);
  process.exitCode = 1;
});
