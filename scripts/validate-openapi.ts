/**
 * CI gate — api_design.docx §23 ("Generate and validate Swagger/OpenAPI
 * documentation during CI").
 *
 * Regenerates the document in memory and fails if:
 *   1. It doesn't match the committed openapi.json (the spec is stale —
 *      someone changed a route/schema and forgot to run
 *      `npm run openapi:generate`), or
 *   2. It's structurally incomplete (missing the required top-level keys,
 *      or has zero registered paths, which would mean the module
 *      side-effect imports silently failed to register anything).
 *
 * This is a structural/staleness check, not full JSON-Schema-level OpenAPI
 * validation — no dedicated OpenAPI validator package (e.g.
 * @apidevtools/swagger-parser) is part of the approved dependency list.
 * Worth adding if deeper spec validation becomes important later.
 *
 * Run with: npm run openapi:validate
 */
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { buildOpenApiDocument } from '../src/config/openapi.js';
import '../src/routes/v1.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUTPUT_PATH = path.join(__dirname, '..', 'openapi.json');

async function main(): Promise<void> {
  const document = buildOpenApiDocument();
  const errors: string[] = [];

  // `openapi` and `info` are non-optional on createDocument()'s return type,
  // so only `paths` (optional in the OpenAPI type) is worth a runtime check.
  if (!document.paths) {
    errors.push('Generated document is missing "paths".');
  }

  const pathCount = Object.keys(document.paths ?? {}).length;
  if (pathCount === 0) {
    errors.push(
      'Generated document has zero registered paths — module *.openapi.ts side effects may not be firing.',
    );
  }

  const generatedJson = `${JSON.stringify(document, null, 2)}\n`;

  let committedJson: string | null = null;
  try {
    committedJson = await readFile(OUTPUT_PATH, 'utf8');
  } catch {
    errors.push(
      `${OUTPUT_PATH} does not exist — run "npm run openapi:generate" and commit the result.`,
    );
  }

  if (committedJson !== null && committedJson !== generatedJson) {
    errors.push(
      `${OUTPUT_PATH} is stale — it does not match what the current Zod schemas generate. Run "npm run openapi:generate" and commit the result.`,
    );
  }

  if (errors.length > 0) {
    console.error('OpenAPI validation failed:\n');
    for (const error of errors) console.error(`  - ${error}`);
    process.exitCode = 1;
    return;
  }

  console.log(
    `openapi.json is valid and up to date (${pathCount} path${pathCount === 1 ? '' : 's'}).`,
  );
}

main().catch((error: unknown) => {
  console.error('OpenAPI validation crashed:', error);
  process.exitCode = 1;
});
