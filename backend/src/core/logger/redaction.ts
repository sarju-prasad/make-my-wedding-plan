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

/**
 * message/stack are non-enumerable on the base Error prototype (verified
 * directly: `Object.keys(new Error('x'))` is `[]`) — exactly why deepRedact
 * short-circuits on `instanceof Error` at all, rather than walking it with
 * the same Object.entries() loop used for plain objects, which would
 * "flatten" it to `{}` and lose them (pino's own downstream Error handling
 * is what actually surfaces message/stack in the final log line, not this
 * function).
 *
 * But a subclass (AppError's own `code`/`httpStatus`/`details`/`name`) or a
 * third-party library's error (an HTTP client that attaches its entire
 * request config, headers included, to a thrown error) CAN add genuinely
 * enumerable own properties — those must be redacted by key exactly like
 * any plain object's fields, or a secret smuggled in through one is never
 * caught. Clones rather than mutates the original error in place: the same
 * error instance logged here may still be read elsewhere after this call
 * returns (e.g. error-handler.ts reads `appError.details` right after
 * logging it), and logging must not have a mutating side effect on it.
 */
function redactErrorExtras(error: Error, depth: number): Error {
  const clone = Object.create(Object.getPrototypeOf(error) as object) as Error &
    Record<string, unknown>;
  clone.message = error.message;
  // exactOptionalPropertyTypes forbids assigning `undefined` explicitly to
  // an optional property (stack?: string, not string | undefined) — guard
  // rather than assign unconditionally, since a stack trace isn't always
  // present (e.g. an Error constructed without one in certain engines).
  if (error.stack !== undefined) {
    clone.stack = error.stack;
  }
  // cause is non-enumerable too (same as message/stack — `error.cause` was
  // confirmed absent from Object.entries() directly against the installed
  // Node version), so the loop below never reaches it on its own. Pino's own
  // Error serialization follows and logs a cause chain automatically (also
  // verified directly), which is exactly why AppError's own error-mappers.ts
  // uses `cause` to carry a wrapped exception's detail for logging without
  // putting it in the client-facing `message` — dropping it here would
  // silently lose that detail from every such log line.
  if ('cause' in error) {
    clone.cause = deepRedact(error.cause, depth + 1);
  }
  for (const [key, val] of Object.entries(error)) {
    clone[key] = isSensitiveKey(key) ? REDACTED_CENSOR : deepRedact(val, depth + 1);
  }
  return clone;
}

export function deepRedact(value: unknown, depth = 0): unknown {
  if (depth >= MAX_REDACT_DEPTH || value === null || typeof value !== 'object') {
    return value;
  }

  if (value instanceof Date) {
    return value;
  }

  if (value instanceof Error) {
    return redactErrorExtras(value, depth);
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
