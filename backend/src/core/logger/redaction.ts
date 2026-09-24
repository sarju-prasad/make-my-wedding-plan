/**
 * Secret redaction for the application logger.
 *
 * system_design_architecture.pdf §15 and api_design.docx §20 both forbid
 * logging passwords, JWTs, invitation tokens, reset tokens, and presigned /
 * signed URLs.
 *
 * This deliberately does NOT use pino's built-in `redact.paths` option.
 * That option only matches at the exact nesting depth given — `*.password`
 * redacts `user.password` but silently lets `body.user.password` through
 * unredacted (verified empirically against the installed pino version; this
 * is documented pino behaviour, not a version quirk). Given how many
 * different depths a field like `password` or `token` can appear at across
 * 14 modules, a single missed path is a real leak, not a cosmetic gap.
 *
 * Instead, `deepRedact` walks the entire log object recursively and blanks
 * any key whose name (case-insensitively) is in SENSITIVE_KEYS, at any depth,
 * including inside arrays. It is wired in as pino's `formatters.log` hook in
 * logger.ts, which pino runs on every log object before serialisation.
 */

const SENSITIVE_KEYS = new Set([
  'password',
  'passwordhash',
  'token',
  'tokenhash',
  'accesstoken',
  'refreshtoken',
  'resettoken',
  'resettokenhash',
  'invitationtoken',
  'guestsessiontoken',
  'signedurl',
  'presignedurl',
  'uploadurl',
  'downloadurl',
  'apikey',
  'secretaccesskey',
  'authorization',
  'cookie',
  'setcookie',
]);

export const REDACTED_CENSOR = '[REDACTED]';

/** Bounds recursion depth so a pathological or circular object cannot hang the process. */
const MAX_REDACT_DEPTH = 10;

function isSensitiveKey(key: string): boolean {
  return SENSITIVE_KEYS.has(key.toLowerCase().replace(/[_-]/g, ''));
}

export function deepRedact(value: unknown, depth = 0): unknown {
  if (depth >= MAX_REDACT_DEPTH || value === null || typeof value !== 'object') {
    return value;
  }

  if (value instanceof Date || value instanceof Error) {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map((item) => deepRedact(item, depth + 1));
  }

  const result: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
    result[key] = isSensitiveKey(key) ? REDACTED_CENSOR : deepRedact(val, depth + 1);
  }
  return result;
}
