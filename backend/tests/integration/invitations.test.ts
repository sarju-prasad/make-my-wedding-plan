import request from 'supertest';
import { beforeAll, describe, expect, it } from 'vitest';

import { createApp } from '../../src/app.js';
// Reaching into the module's internal model directly, not through a public
// entry point — only to simulate a state the real API has no way to produce
// (an invitation already past its expiry).
import { WeddingInvitation } from '../../src/modules/weddings/invitations.model.js';
import { WeddingMember } from '../../src/modules/weddings/members.model.js';

const app = createApp();

// db/connection.ts disables autoIndex outside development — the test
// database is no exception (same gap tests/integration/members.test.ts hit
// first), so the partial unique {weddingId, email} index this file's
// duplicate-pending-invitation test depends on, and members.test.ts's own
// {weddingId, userId} unique index that this file's concurrent-accept-vs-
// addMember test depends on, would otherwise simply not exist — MongoDB
// would silently allow two "duplicate" rows instead of rejecting the second
// with E11000. This is a separate vitest worker/connection from
// members.test.ts (one per file), so its own syncIndexes() call there
// doesn't carry over to this file.
beforeAll(async () => {
  await Promise.all([WeddingInvitation.syncIndexes(), WeddingMember.syncIndexes()]);
});

// See tests/integration/auth.test.ts for why every state-changing request needs this.
const ALLOWED_ORIGIN = 'http://localhost:3000';

function post(path: string) {
  return request(app).post(path).set('Origin', ALLOWED_ORIGIN);
}

function del(path: string) {
  return request(app).delete(path).set('Origin', ALLOWED_ORIGIN);
}

const VALID_WEDDING = {
  name: 'Ananya & Arjun',
  couple: { partnerOneName: 'Ananya', partnerTwoName: 'Arjun' },
  weddingDate: '2026-11-14',
  timezone: 'Asia/Kolkata',
  location: { address: 'The Oberoi Udaivilas, Udaipur', latitude: 24.5762, longitude: 73.6833 },
};

let userCounter = 0;

/** Registers a fresh user (unique email per call) and returns their session cookies + email + name. */
async function registerUser(): Promise<{ cookies: string[]; email: string; name: string }> {
  userCounter += 1;
  const email = `invite-test-${userCounter}@example.com`;
  const name = `Test User ${userCounter}`;
  const res = await post('/api/v1/auth/register').send({
    name,
    email,
    password: 'correct-horse-battery',
  });
  return { cookies: res.headers['set-cookie'] as unknown as string[], email, name };
}

async function createWedding(cookies: string[]): Promise<string> {
  const res = await post('/api/v1/weddings').set('Cookie', cookies).send(VALID_WEDDING);
  return res.body.data.wedding.id as string;
}

/** Extracts the raw token from a devInviteUrl like `${WEB_BASE_URL}/invitations/<token>`. */
function extractToken(devInviteUrl: string): string {
  return new URL(devInviteUrl).pathname.split('/').pop()!;
}

async function invite(
  adminCookies: string[],
  weddingId: string,
  email: string,
  role: 'ADMIN' | 'MANAGER' = 'MANAGER',
): Promise<{ invitationId: string; token: string }> {
  const res = await post(`/api/v1/weddings/${weddingId}/invitations`)
    .set('Cookie', adminCookies)
    .send({ email, role });
  return {
    invitationId: res.body.data.invitation.id as string,
    token: extractToken(res.body.data.devInviteUrl as string),
  };
}

// Token travels in the body, not the URL — see weddings.routes.ts for why.
function previewInvite(token: string) {
  return post('/api/v1/invitations/preview').send({ token });
}

function acceptInvite(token: string) {
  return post('/api/v1/invitations/accept').send({ token });
}

describe('POST /api/v1/weddings/:weddingId/invitations', () => {
  it('requires authentication', async () => {
    const { cookies: admin } = await registerUser();
    const weddingId = await createWedding(admin);

    const res = await post(`/api/v1/weddings/${weddingId}/invitations`).send({
      email: 'invitee@example.com',
      role: 'MANAGER',
    });

    expect(res.status).toBe(401);
  });

  it('creates a pending invitation and returns a devInviteUrl (no RESEND_API_KEY in test env)', async () => {
    const { cookies: admin } = await registerUser();
    const weddingId = await createWedding(admin);

    const res = await post(`/api/v1/weddings/${weddingId}/invitations`)
      .set('Cookie', admin)
      .send({ email: 'invitee@example.com', role: 'MANAGER' });

    expect(res.status).toBe(201);
    expect(res.body.data.invitation).toMatchObject({
      email: 'invitee@example.com',
      role: 'MANAGER',
      status: 'PENDING',
      isExpired: false,
    });
    expect(res.body.data.emailSent).toBe(false);
    expect(res.body.data.devInviteUrl).toContain('/invitations/');
  });

  it('rejects a non-Admin (Manager) with FORBIDDEN', async () => {
    const { cookies: admin } = await registerUser();
    const { cookies: manager, email: managerEmail } = await registerUser();
    const weddingId = await createWedding(admin);
    const { token } = await invite(admin, weddingId, managerEmail, 'MANAGER');
    await acceptInvite(token).set('Cookie', manager);

    const res = await post(`/api/v1/weddings/${weddingId}/invitations`)
      .set('Cookie', manager)
      .send({ email: 'someone-else@example.com', role: 'MANAGER' });

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  it('rejects a second pending invitation to the same email with DUPLICATE_RESOURCE', async () => {
    const { cookies: admin } = await registerUser();
    const weddingId = await createWedding(admin);
    await invite(admin, weddingId, 'duplicate@example.com');

    const res = await post(`/api/v1/weddings/${weddingId}/invitations`)
      .set('Cookie', admin)
      .send({ email: 'duplicate@example.com', role: 'MANAGER' });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('DUPLICATE_RESOURCE');
  });

  it('allows re-inviting an email after the first invitation was revoked', async () => {
    const { cookies: admin } = await registerUser();
    const weddingId = await createWedding(admin);
    const { invitationId } = await invite(admin, weddingId, 'again@example.com');
    await del(`/api/v1/weddings/${weddingId}/invitations/${invitationId}`).set('Cookie', admin);

    const res = await post(`/api/v1/weddings/${weddingId}/invitations`)
      .set('Cookie', admin)
      .send({ email: 'again@example.com', role: 'MANAGER' });

    expect(res.status).toBe(201);
  });

  it('rejects inviting an email that is already an active member with ALREADY_MEMBER', async () => {
    const { cookies: admin } = await registerUser();
    const { cookies: member, email: memberEmail } = await registerUser();
    const weddingId = await createWedding(admin);
    const { token } = await invite(admin, weddingId, memberEmail);
    await acceptInvite(token).set('Cookie', member);

    const res = await post(`/api/v1/weddings/${weddingId}/invitations`)
      .set('Cookie', admin)
      .send({ email: memberEmail, role: 'MANAGER' });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('ALREADY_MEMBER');
  });

  it.each([
    { role: 'MANAGER' }, // missing email
    { email: 'invitee@example.com' }, // missing role
    { email: 'invitee@example.com', role: 'OWNER' }, // invalid role
    { email: 'not-an-email', role: 'MANAGER' }, // invalid email
    { email: 'invitee@example.com', role: 'MANAGER', extra: true }, // unknown field
  ])('rejects %j with VALIDATION_ERROR', async (payload) => {
    const { cookies: admin } = await registerUser();
    const weddingId = await createWedding(admin);

    const res = await post(`/api/v1/weddings/${weddingId}/invitations`)
      .set('Cookie', admin)
      .send(payload);

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('returns WEDDING_NOT_FOUND for a non-member', async () => {
    const { cookies: admin } = await registerUser();
    const { cookies: outsider } = await registerUser();
    const weddingId = await createWedding(admin);

    const res = await post(`/api/v1/weddings/${weddingId}/invitations`)
      .set('Cookie', outsider)
      .send({ email: 'invitee@example.com', role: 'MANAGER' });

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('WEDDING_NOT_FOUND');
  });

  it('rate-limits repeated invites from the same caller', async () => {
    const { cookies: admin } = await registerUser();
    const weddingId = await createWedding(admin);

    // middleware/rate-limit.ts: RATE_LIMIT_POLICIES['invitation:create'] = 10 points / 60s.
    const attempt = (n: number) =>
      post(`/api/v1/weddings/${weddingId}/invitations`)
        .set('Cookie', admin)
        .send({ email: `rate-limit-${n}@example.com`, role: 'MANAGER' });

    for (let i = 0; i < 10; i += 1) {
      await attempt(i);
    }
    const res = await attempt(10);

    expect(res.status).toBe(429);
    expect(res.body.error.code).toBe('RATE_LIMITED');
  });
});

describe('GET /api/v1/weddings/:weddingId/invitations', () => {
  it('requires authentication', async () => {
    const { cookies: admin } = await registerUser();
    const weddingId = await createWedding(admin);
    const res = await request(app).get(`/api/v1/weddings/${weddingId}/invitations`);
    expect(res.status).toBe(401);
  });

  it('rejects a non-Admin (Manager) with FORBIDDEN', async () => {
    const { cookies: admin } = await registerUser();
    const { cookies: manager, email: managerEmail } = await registerUser();
    const weddingId = await createWedding(admin);
    const { token } = await invite(admin, weddingId, managerEmail);
    await acceptInvite(token).set('Cookie', manager);

    const res = await request(app)
      .get(`/api/v1/weddings/${weddingId}/invitations`)
      .set('Cookie', manager);

    expect(res.status).toBe(403);
  });

  it('lists only PENDING invitations — not accepted or revoked ones', async () => {
    const { cookies: admin } = await registerUser();
    const weddingId = await createWedding(admin);

    const { cookies: acceptedUser, email: acceptedEmail } = await registerUser();
    const { token: acceptedToken } = await invite(admin, weddingId, acceptedEmail);
    await acceptInvite(acceptedToken).set('Cookie', acceptedUser);

    const { invitationId: revokedId } = await invite(admin, weddingId, 'revoked@example.com');
    await del(`/api/v1/weddings/${weddingId}/invitations/${revokedId}`).set('Cookie', admin);

    await invite(admin, weddingId, 'still-pending@example.com');

    const res = await request(app)
      .get(`/api/v1/weddings/${weddingId}/invitations`)
      .set('Cookie', admin);

    expect(res.status).toBe(200);
    const items = res.body.data.items as { email: string; status: string }[];
    const emails = items.map((i) => i.email);
    expect(emails).toEqual(['still-pending@example.com']);
    expect(items.every((i) => i.status === 'PENDING')).toBe(true);
  });

  it('does not leak another wedding’s invitations', async () => {
    const { cookies: admin1 } = await registerUser();
    const { cookies: admin2 } = await registerUser();
    const wedding1 = await createWedding(admin1);
    const wedding2 = await createWedding(admin2);
    await invite(admin1, wedding1, 'wedding1-invitee@example.com');
    await invite(admin2, wedding2, 'wedding2-invitee@example.com');

    const res = await request(app)
      .get(`/api/v1/weddings/${wedding1}/invitations`)
      .set('Cookie', admin1);

    const emails = (res.body.data.items as { email: string }[]).map((i) => i.email);
    expect(emails).toEqual(['wedding1-invitee@example.com']);
  });

  it('returns an empty list when there are no pending invitations', async () => {
    const { cookies: admin } = await registerUser();
    const weddingId = await createWedding(admin);

    const res = await request(app)
      .get(`/api/v1/weddings/${weddingId}/invitations`)
      .set('Cookie', admin);

    expect(res.body.data.items).toEqual([]);
  });
});

describe('DELETE /api/v1/weddings/:weddingId/invitations/:invitationId', () => {
  it('requires authentication', async () => {
    const { cookies: admin } = await registerUser();
    const weddingId = await createWedding(admin);
    const { invitationId } = await invite(admin, weddingId, 'invitee@example.com');

    const res = await del(`/api/v1/weddings/${weddingId}/invitations/${invitationId}`);
    expect(res.status).toBe(401);
  });

  it('rejects a non-Admin (Manager) with FORBIDDEN', async () => {
    const { cookies: admin } = await registerUser();
    const { cookies: manager, email: managerEmail } = await registerUser();
    const weddingId = await createWedding(admin);
    const { token } = await invite(admin, weddingId, managerEmail);
    await acceptInvite(token).set('Cookie', manager);
    const { invitationId } = await invite(admin, weddingId, 'invitee@example.com');

    const res = await del(`/api/v1/weddings/${weddingId}/invitations/${invitationId}`).set(
      'Cookie',
      manager,
    );

    expect(res.status).toBe(403);
  });

  it('revokes a pending invitation', async () => {
    const { cookies: admin } = await registerUser();
    const weddingId = await createWedding(admin);
    const { invitationId } = await invite(admin, weddingId, 'invitee@example.com');

    const res = await del(`/api/v1/weddings/${weddingId}/invitations/${invitationId}`).set(
      'Cookie',
      admin,
    );

    expect(res.status).toBe(204);
    const listRes = await request(app)
      .get(`/api/v1/weddings/${weddingId}/invitations`)
      .set('Cookie', admin);
    expect(listRes.body.data.items).toEqual([]);
  });

  it('returns INVITATION_NOT_FOUND for an already-revoked invitation', async () => {
    const { cookies: admin } = await registerUser();
    const weddingId = await createWedding(admin);
    const { invitationId } = await invite(admin, weddingId, 'invitee@example.com');
    await del(`/api/v1/weddings/${weddingId}/invitations/${invitationId}`).set('Cookie', admin);

    const res = await del(`/api/v1/weddings/${weddingId}/invitations/${invitationId}`).set(
      'Cookie',
      admin,
    );

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('INVITATION_NOT_FOUND');
  });

  it('returns INVITATION_NOT_FOUND for a nonexistent invitation id', async () => {
    const { cookies: admin } = await registerUser();
    const weddingId = await createWedding(admin);

    const res = await del(`/api/v1/weddings/${weddingId}/invitations/507f1f77bcf86cd799439099`).set(
      'Cookie',
      admin,
    );

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('INVITATION_NOT_FOUND');
  });
});

describe('POST /api/v1/weddings/:weddingId/invitations/:invitationId/resend', () => {
  it('rejects a non-Admin (Manager) with FORBIDDEN', async () => {
    const { cookies: admin } = await registerUser();
    const { cookies: manager, email: managerEmail } = await registerUser();
    const weddingId = await createWedding(admin);
    const { token } = await invite(admin, weddingId, managerEmail);
    await acceptInvite(token).set('Cookie', manager);
    const { invitationId } = await invite(admin, weddingId, 'invitee@example.com');

    const res = await post(`/api/v1/weddings/${weddingId}/invitations/${invitationId}/resend`).set(
      'Cookie',
      manager,
    );

    expect(res.status).toBe(403);
  });

  it('issues a new token, invalidating the old one', async () => {
    const { cookies: admin } = await registerUser();
    const weddingId = await createWedding(admin);
    const { invitationId, token: oldToken } = await invite(admin, weddingId, 'invitee@example.com');

    const res = await post(`/api/v1/weddings/${weddingId}/invitations/${invitationId}/resend`).set(
      'Cookie',
      admin,
    );

    expect(res.status).toBe(200);
    const newToken = extractToken(res.body.data.devInviteUrl as string);
    expect(newToken).not.toBe(oldToken);

    const oldPreview = await previewInvite(oldToken);
    expect(oldPreview.status).toBe(404);

    const newPreview = await previewInvite(newToken);
    expect(newPreview.status).toBe(200);
  });

  it('resets the expiry, so a previously-expired invitation becomes acceptable again', async () => {
    const { cookies: admin } = await registerUser();
    const weddingId = await createWedding(admin);
    const { invitationId } = await invite(admin, weddingId, 'invitee@example.com');
    await WeddingInvitation.updateOne(
      { _id: invitationId },
      { expiresAt: new Date(Date.now() - 1000) },
    );

    const res = await post(`/api/v1/weddings/${weddingId}/invitations/${invitationId}/resend`).set(
      'Cookie',
      admin,
    );

    expect(res.status).toBe(200);
    expect(res.body.data.invitation.isExpired).toBe(false);
  });

  it('returns INVITATION_NOT_FOUND for a revoked invitation', async () => {
    const { cookies: admin } = await registerUser();
    const weddingId = await createWedding(admin);
    const { invitationId } = await invite(admin, weddingId, 'invitee@example.com');
    await del(`/api/v1/weddings/${weddingId}/invitations/${invitationId}`).set('Cookie', admin);

    const res = await post(`/api/v1/weddings/${weddingId}/invitations/${invitationId}/resend`).set(
      'Cookie',
      admin,
    );

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('INVITATION_NOT_FOUND');
  });
});

describe('POST /api/v1/invitations/preview', () => {
  it('works with no auth at all, and includes the wedding/inviter context', async () => {
    const { cookies: admin, name: adminName } = await registerUser();
    const weddingId = await createWedding(admin);
    const { token } = await invite(admin, weddingId, 'invitee@example.com', 'MANAGER');

    const res = await previewInvite(token);

    expect(res.status).toBe(200);
    expect(res.body.data.invitation).toMatchObject({
      email: 'invitee@example.com',
      role: 'MANAGER',
      status: 'PENDING',
      isExpired: false,
      weddingName: VALID_WEDDING.name,
      couple: VALID_WEDDING.couple,
      invitedByName: adminName,
    });
  });

  it('returns 404 for a bogus token', async () => {
    const res = await previewInvite('a'.repeat(64));
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('INVITATION_NOT_FOUND');
  });

  it('rejects a malformed token with VALIDATION_ERROR', async () => {
    const res = await previewInvite('not-a-real-token');
    expect(res.status).toBe(422);
  });

  it('reports REVOKED status for a revoked invitation rather than erroring', async () => {
    const { cookies: admin } = await registerUser();
    const weddingId = await createWedding(admin);
    const { invitationId, token } = await invite(admin, weddingId, 'invitee@example.com');
    await del(`/api/v1/weddings/${weddingId}/invitations/${invitationId}`).set('Cookie', admin);

    const res = await previewInvite(token);

    expect(res.status).toBe(200);
    expect(res.body.data.invitation.status).toBe('REVOKED');
  });

  it('reports isExpired: true for an invitation past its expiry', async () => {
    const { cookies: admin } = await registerUser();
    const weddingId = await createWedding(admin);
    const { invitationId, token } = await invite(admin, weddingId, 'invitee@example.com');
    await WeddingInvitation.updateOne(
      { _id: invitationId },
      { expiresAt: new Date(Date.now() - 1000) },
    );

    const res = await previewInvite(token);

    expect(res.status).toBe(200);
    expect(res.body.data.invitation.isExpired).toBe(true);
    expect(res.body.data.invitation.status).toBe('PENDING');
  });
});

describe('POST /api/v1/invitations/accept', () => {
  it('requires authentication', async () => {
    const { cookies: admin } = await registerUser();
    const weddingId = await createWedding(admin);
    const { token } = await invite(admin, weddingId, 'invitee@example.com');

    const res = await acceptInvite(token);
    expect(res.status).toBe(401);
  });

  it('returns 404 for a bogus token', async () => {
    const { cookies: someone } = await registerUser();
    const res = await acceptInvite('b'.repeat(64)).set('Cookie', someone);
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('INVITATION_NOT_FOUND');
  });

  it('accepts a valid invitation, creating a membership with the invited role', async () => {
    const { cookies: admin } = await registerUser();
    const weddingId = await createWedding(admin);
    const { cookies: invitee, email: inviteeEmail } = await registerUser();
    const { token } = await invite(admin, weddingId, inviteeEmail, 'MANAGER');

    const res = await acceptInvite(token).set('Cookie', invitee);

    expect(res.status).toBe(200);
    expect(res.body.data.role).toBe('MANAGER');
    expect(res.body.data.wedding.id).toBe(weddingId);

    const membersRes = await request(app)
      .get(`/api/v1/weddings/${weddingId}/members`)
      .set('Cookie', admin);
    const emails = (membersRes.body.data.items as { email: string; role: string }[]).map(
      (m) => m.email,
    );
    expect(emails).toContain(inviteeEmail);
  });

  it('removes the invitation from the pending list once accepted', async () => {
    const { cookies: admin } = await registerUser();
    const weddingId = await createWedding(admin);
    const { cookies: invitee, email: inviteeEmail } = await registerUser();
    const { token } = await invite(admin, weddingId, inviteeEmail);
    await acceptInvite(token).set('Cookie', invitee);

    const listRes = await request(app)
      .get(`/api/v1/weddings/${weddingId}/invitations`)
      .set('Cookie', admin);

    expect(listRes.body.data.items).toEqual([]);
  });

  it('rejects a revoked invitation with INVITATION_REVOKED', async () => {
    const { cookies: admin } = await registerUser();
    const weddingId = await createWedding(admin);
    const { cookies: invitee, email: inviteeEmail } = await registerUser();
    const { invitationId, token } = await invite(admin, weddingId, inviteeEmail);
    await del(`/api/v1/weddings/${weddingId}/invitations/${invitationId}`).set('Cookie', admin);

    const res = await acceptInvite(token).set('Cookie', invitee);

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('INVITATION_REVOKED');
  });

  it('rejects an expired invitation with INVITATION_EXPIRED', async () => {
    const { cookies: admin } = await registerUser();
    const weddingId = await createWedding(admin);
    const { cookies: invitee, email: inviteeEmail } = await registerUser();
    const { invitationId, token } = await invite(admin, weddingId, inviteeEmail);
    await WeddingInvitation.updateOne(
      { _id: invitationId },
      { expiresAt: new Date(Date.now() - 1000) },
    );

    const res = await acceptInvite(token).set('Cookie', invitee);

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('INVITATION_EXPIRED');
  });

  it('rejects acceptance from a different account than the invited email with EMAIL_MISMATCH', async () => {
    const { cookies: admin } = await registerUser();
    const weddingId = await createWedding(admin);
    const { cookies: someoneElse } = await registerUser();
    const { token } = await invite(admin, weddingId, 'specific-invitee@example.com');

    const res = await acceptInvite(token).set('Cookie', someoneElse);

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('EMAIL_MISMATCH');
  });

  it('rejects re-accepting an already-accepted token with INVITATION_ALREADY_ACCEPTED', async () => {
    const { cookies: admin } = await registerUser();
    const weddingId = await createWedding(admin);
    const { cookies: invitee, email: inviteeEmail } = await registerUser();
    const { token } = await invite(admin, weddingId, inviteeEmail);
    await acceptInvite(token).set('Cookie', invitee);

    // Same token, same still-active member, hit a second time (e.g. the
    // email link clicked twice, or a double-submit).
    const res = await acceptInvite(token).set('Cookie', invitee);

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('INVITATION_ALREADY_ACCEPTED');
  });

  it('rejects an already-accepted token from reinstating a removed member', async () => {
    const { cookies: admin } = await registerUser();
    const weddingId = await createWedding(admin);
    const { cookies: invitee, email: inviteeEmail } = await registerUser();
    const { token } = await invite(admin, weddingId, inviteeEmail, 'ADMIN');
    await acceptInvite(token).set('Cookie', invitee);

    const membersRes = await request(app)
      .get(`/api/v1/weddings/${weddingId}/members`)
      .set('Cookie', admin);
    const memberId = (membersRes.body.data.items as { id: string; email: string }[]).find(
      (m) => m.email === inviteeEmail,
    )!.id;
    await del(`/api/v1/weddings/${weddingId}/members/${memberId}`).set('Cookie', admin);

    // Replaying the exact same (already-accepted) link must not let a
    // removed member back in — especially not as the Admin they were
    // originally invited as. Getting back in requires a fresh invite.
    const res = await acceptInvite(token).set('Cookie', invitee);

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('INVITATION_ALREADY_ACCEPTED');

    const afterRes = await request(app)
      .get(`/api/v1/weddings/${weddingId}/members`)
      .set('Cookie', admin);
    const stillRemoved = (afterRes.body.data.items as { email: string }[]).some(
      (m) => m.email === inviteeEmail,
    );
    expect(stillRemoved).toBe(false);
  });

  it('reactivates a previously-removed membership with the invitation’s role', async () => {
    const { cookies: admin } = await registerUser();
    const weddingId = await createWedding(admin);
    const { cookies: invitee, email: inviteeEmail } = await registerUser();
    const firstInvite = await invite(admin, weddingId, inviteeEmail, 'MANAGER');
    await acceptInvite(firstInvite.token).set('Cookie', invitee);

    const membersRes = await request(app)
      .get(`/api/v1/weddings/${weddingId}/members`)
      .set('Cookie', admin);
    const memberId = (membersRes.body.data.items as { id: string; email: string }[]).find(
      (m) => m.email === inviteeEmail,
    )!.id;
    await del(`/api/v1/weddings/${weddingId}/members/${memberId}`).set('Cookie', admin);

    // Getting back in after removal needs a fresh invite — the old,
    // already-accepted token is rejected (covered above).
    const secondInvite = await invite(admin, weddingId, inviteeEmail, 'ADMIN');
    const res = await acceptInvite(secondInvite.token).set('Cookie', invitee);

    expect(res.status).toBe(200);
    expect(res.body.data.role).toBe('ADMIN');

    const afterRes = await request(app)
      .get(`/api/v1/weddings/${weddingId}/members`)
      .set('Cookie', admin);
    const reactivated = (afterRes.body.data.items as { email: string; role: string }[]).find(
      (m) => m.email === inviteeEmail,
    );
    expect(reactivated?.role).toBe('ADMIN');
  });

  it('two concurrent accepts of the same token: one succeeds, the other gets a clean 409, not a 500', async () => {
    const { cookies: admin } = await registerUser();
    const weddingId = await createWedding(admin);
    const { cookies: invitee, email: inviteeEmail } = await registerUser();
    const { token } = await invite(admin, weddingId, inviteeEmail);

    // Two tabs hitting accept at once. The invitation's PENDING->ACCEPTED
    // flip is a conditional update inside a transaction (see
    // invitations.service.ts#acceptInvitation), so exactly one of these
    // wins it — the other sees a no-longer-PENDING invitation and is
    // rejected before ever reaching the membership write.
    const [first, second] = await Promise.all([
      acceptInvite(token).set('Cookie', invitee),
      acceptInvite(token).set('Cookie', invitee),
    ]);

    const statuses = [first.status, second.status].sort();
    expect(statuses).toEqual([200, 409]);
    const loser = first.status === 409 ? first : second;
    expect(loser.body.error.code).toBe('INVITATION_ALREADY_ACCEPTED');
  });

  it('a concurrent addMember racing the same accept converts the duplicate-key collision into a clean 409, not a 500', async () => {
    const { cookies: admin } = await registerUser();
    const weddingId = await createWedding(admin);
    const { cookies: invitee, email: inviteeEmail } = await registerUser();
    const { token } = await invite(admin, weddingId, inviteeEmail, 'MANAGER');

    // Two independent codepaths — an Admin adding the same (already
    // registered) person directly, at the same moment that person accepts
    // their own invitation — both end up writing the same {weddingId,
    // userId} row.
    const [acceptRes, addRes] = await Promise.all([
      acceptInvite(token).set('Cookie', invitee),
      post(`/api/v1/weddings/${weddingId}/members`)
        .set('Cookie', admin)
        .send({ email: inviteeEmail, role: 'MANAGER' }),
    ]);

    if (acceptRes.status === 200) {
      expect(addRes.status).toBe(409);
      expect(addRes.body.error.code).toBe('DUPLICATE_RESOURCE');
    } else {
      expect(acceptRes.status).toBe(409);
      expect(acceptRes.body.error.code).toBe('ALREADY_MEMBER');
      expect(addRes.status).toBe(201);
    }
  });
});
