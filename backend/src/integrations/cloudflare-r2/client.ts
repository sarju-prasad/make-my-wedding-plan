/**
 * Cloudflare R2 client — private photo storage (system_design_architecture.pdf
 * §12; PRD §33–§40).
 *
 * R2 is S3-compatible, so the AWS SDK's S3Client talks to it directly once
 * pointed at the account's R2 endpoint with `region: 'auto'` — Cloudflare's
 * documented pattern, not an AWS one.
 *
 * This module is a client shell only: construction and a singleton getter.
 * No presign/upload/download functions live here yet — those are feature
 * work for the photos module (api_design.docx §13) and depend on decisions
 * not yet made (bulk ZIP bounds — CLAUDE.md C5). Deliberately NOT verified
 * against a real R2 bucket; doing so needs real account credentials, which
 * is one of the Phase 0 risk spikes flagged for before this integration is
 * built out further.
 */
import { S3Client } from '@aws-sdk/client-s3';

import { env } from '#config/env.js';

let client: S3Client | null = null;

/**
 * Throws if R2 credentials aren't configured — callers only reach this once
 * a photo operation actually needs it, so a missing credential fails at the
 * point of use with a clear message, not with a generic SDK error.
 */
export function getR2Client(): S3Client {
  if (client) return client;

  if (
    !env.R2_ACCOUNT_ID ||
    !env.R2_ACCESS_KEY_ID ||
    !env.R2_SECRET_ACCESS_KEY ||
    !env.R2_ENDPOINT
  ) {
    throw new Error(
      'Cloudflare R2 is not configured — set R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY and R2_ENDPOINT.',
    );
  }

  client = new S3Client({
    region: 'auto',
    endpoint: env.R2_ENDPOINT,
    credentials: {
      accessKeyId: env.R2_ACCESS_KEY_ID,
      secretAccessKey: env.R2_SECRET_ACCESS_KEY,
    },
  });

  return client;
}

export function getR2Bucket(): string {
  if (!env.R2_BUCKET) {
    throw new Error('Cloudflare R2 is not configured — set R2_BUCKET.');
  }
  return env.R2_BUCKET;
}
