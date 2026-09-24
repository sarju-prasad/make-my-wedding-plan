/**
 * Required security test cases — api_design.docx §23:
 *
 *   "Test unauthorized cross-wedding access. Test expired and revoked
 *   invitation tokens. Test duplicate RSVP submission. Test role
 *   restrictions for ADMIN and MANAGER. Test rate limiting and generic
 *   authentication errors."
 *
 * Recorded here as `it.todo(...)` so they stay visible in every test run's
 * summary and can't be silently forgotten, rather than living only as a line
 * in a document. Each becomes a real test once its module exists — none of
 * these can be implemented yet (no auth, wedding, guest, invitation, or RSVP
 * module is built), and several depend on open decisions in CLAUDE.md
 * (the ADMIN/MANAGER permission matrix — G6 — in particular).
 */
import { describe, it } from 'vitest';

describe('cross-wedding access', () => {
  it.todo("a member of wedding A cannot read wedding B's resources via a guessed/known id");
  it.todo("a member of wedding A cannot write to wedding B's resources");
});

describe('invitation tokens', () => {
  it.todo('an expired invitation token is rejected with INVITATION_EXPIRED');
  it.todo('a revoked invitation token is rejected with INVITATION_REVOKED');
  it.todo('revocation takes effect on the next request (no caching of a stale valid state)');
  it.todo('a guest cannot access an event they were not invited to');
});

describe('RSVP', () => {
  it.todo('submitting an RSVP twice for the same invitation+event upserts rather than duplicating');
  it.todo('an RSVP for an event not on the invitation is rejected');
});

describe('role restrictions', () => {
  it.todo('a MANAGER cannot perform an ADMIN-only operation');
  it.todo('the final active ADMIN of a wedding cannot be removed');
});

describe('rate limiting and generic errors', () => {
  it.todo('login returns a generic invalid-credentials message regardless of which check failed');
  it.todo(
    'login is rate limited past the configured threshold (see middleware/rate-limit.ts policies)',
  );
  it.todo('guest-access validation is rate limited past the configured threshold');
});
