import request from 'supertest';
import { beforeAll, describe, expect, it, vi } from 'vitest';

import { createApp } from '../../src/app.js';
import { WeddingInvitation } from '../../src/modules/weddings/invitations.model.js';
// Only for the explicit index sync below, and the forced mid-transaction
// failure further down (same pattern as weddings.test.ts's own atomicity
// test) — every other test in this file goes through the real HTTP API.
import { WeddingMember } from '../../src/modules/weddings/members.model.js';

const app = createApp();

// db/connection.ts disables autoIndex outside development (indexes are
// synced explicitly via `npm run db:indexes` in real deployments, never
// implicitly on a cold start) — the test database is no exception, so the
// {weddingId, userId} unique index this file's concurrent-add test depends
// on would otherwise simply not exist, and MongoDB would silently allow two
// "duplicate" documents rather than rejecting the second with E11000.
beforeAll(async () => {
  await WeddingMember.syncIndexes();
});

// See tests/integration/auth.test.ts for why every POST/PATCH/DELETE needs this.
const ALLOWED_ORIGIN = 'http://localhost:3000';

function post(path: string) {
  return request(app).post(path).set('Origin', ALLOWED_ORIGIN);
}

function patch(path: string) {
  return request(app).patch(path).set('Origin', ALLOWED_ORIGIN);
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

/** Registers a fresh user (unique email per call) and returns their session cookies + email. */
async function registerUser(): Promise<{ cookies: string[]; email: string }> {
  userCounter += 1;
  const email = `member-test-${userCounter}@example.com`;
  const res = await post('/api/v1/auth/register').send({
    name: `Test User ${userCounter}`,
    email,
    password: 'correct-horse-battery',
  });
  return { cookies: res.headers['set-cookie'] as unknown as string[], email };
}

async function createWedding(cookies: string[]): Promise<string> {
  const res = await post('/api/v1/weddings').set('Cookie', cookies).send(VALID_WEDDING);
  return res.body.data.wedding.id as string;
}

describe('GET /api/v1/weddings/:weddingId/members', () => {
  it('lists the creator as the sole ADMIN', async () => {
    const admin = await registerUser();
    const weddingId = await createWedding(admin.cookies);

    const res = await request(app)
      .get(`/api/v1/weddings/${weddingId}/members`)
      .set('Cookie', admin.cookies);

    expect(res.status).toBe(200);
    expect(res.body.data.items).toHaveLength(1);
    expect(res.body.data.items[0]).toMatchObject({ email: admin.email, role: 'ADMIN' });
  });

  it("a non-member cannot list another wedding's members (WEDDING_NOT_FOUND)", async () => {
    const admin = await registerUser();
    const stranger = await registerUser();
    const weddingId = await createWedding(admin.cookies);

    const res = await request(app)
      .get(`/api/v1/weddings/${weddingId}/members`)
      .set('Cookie', stranger.cookies);

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('WEDDING_NOT_FOUND');
  });
});

describe('POST /api/v1/weddings/:weddingId/members', () => {
  it('requires authentication', async () => {
    const admin = await registerUser();
    const weddingId = await createWedding(admin.cookies);

    const res = await post(`/api/v1/weddings/${weddingId}/members`).send({
      email: 'nobody@example.com',
      role: 'MANAGER',
    });

    expect(res.status).toBe(401);
  });

  it('adds an existing registered user as MANAGER', async () => {
    const admin = await registerUser();
    const invitee = await registerUser();
    const weddingId = await createWedding(admin.cookies);

    const res = await post(`/api/v1/weddings/${weddingId}/members`)
      .set('Cookie', admin.cookies)
      .send({ email: invitee.email, role: 'MANAGER' });

    expect(res.status).toBe(201);
    expect(res.body.data.member).toMatchObject({ email: invitee.email, role: 'MANAGER' });

    const listRes = await request(app)
      .get(`/api/v1/weddings/${weddingId}/members`)
      .set('Cookie', admin.cookies);
    expect(listRes.body.data.items).toHaveLength(2);
  });

  it('rate-limits repeated add-member attempts from the same caller', async () => {
    const admin = await registerUser();
    const weddingId = await createWedding(admin.cookies);

    // middleware/rate-limit.ts: RATE_LIMIT_POLICIES['member:add'] = 10 points / 60s.
    // Looking up a nonexistent email every time is deliberate — the point
    // being limited is the lookup-and-report oracle itself (USER_NOT_FOUND
    // vs 201 reveals whether an email is registered), not any one outcome.
    const attempt = (n: number) =>
      post(`/api/v1/weddings/${weddingId}/members`)
        .set('Cookie', admin.cookies)
        .send({ email: `rate-limit-probe-${n}@example.com`, role: 'MANAGER' });

    for (let i = 0; i < 10; i += 1) {
      await attempt(i);
    }
    const res = await attempt(10);

    expect(res.status).toBe(429);
    expect(res.body.error.code).toBe('RATE_LIMITED');
  });

  // security.todo.test.ts's "a MANAGER cannot perform an ADMIN-only
  // operation" — now implemented here instead of left as it.todo, since the
  // Members module this depended on now exists.
  it('a MANAGER cannot add a member (ADMIN-only)', async () => {
    const admin = await registerUser();
    const manager = await registerUser();
    const stranger = await registerUser();
    const weddingId = await createWedding(admin.cookies);

    await post(`/api/v1/weddings/${weddingId}/members`)
      .set('Cookie', admin.cookies)
      .send({ email: manager.email, role: 'MANAGER' });

    const res = await post(`/api/v1/weddings/${weddingId}/members`)
      .set('Cookie', manager.cookies)
      .send({ email: stranger.email, role: 'MANAGER' });

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  it('rejects an email with no registered account', async () => {
    const admin = await registerUser();
    const weddingId = await createWedding(admin.cookies);

    const res = await post(`/api/v1/weddings/${weddingId}/members`)
      .set('Cookie', admin.cookies)
      .send({ email: 'nobody-has-this-account@example.com', role: 'MANAGER' });

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('USER_NOT_FOUND');
  });

  it('rejects adding someone who is already an active member', async () => {
    const admin = await registerUser();
    const invitee = await registerUser();
    const weddingId = await createWedding(admin.cookies);

    await post(`/api/v1/weddings/${weddingId}/members`)
      .set('Cookie', admin.cookies)
      .send({ email: invitee.email, role: 'MANAGER' });

    const res = await post(`/api/v1/weddings/${weddingId}/members`)
      .set('Cookie', admin.cookies)
      .send({ email: invitee.email, role: 'MANAGER' });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('DUPLICATE_RESOURCE');
  });

  it('reactivates a previously removed member instead of failing on the unique index', async () => {
    const admin = await registerUser();
    const invitee = await registerUser();
    const weddingId = await createWedding(admin.cookies);

    const addRes = await post(`/api/v1/weddings/${weddingId}/members`)
      .set('Cookie', admin.cookies)
      .send({ email: invitee.email, role: 'MANAGER' });
    const memberId = addRes.body.data.member.id as string;

    await del(`/api/v1/weddings/${weddingId}/members/${memberId}`).set('Cookie', admin.cookies);

    const reAddRes = await post(`/api/v1/weddings/${weddingId}/members`)
      .set('Cookie', admin.cookies)
      .send({ email: invitee.email, role: 'ADMIN' });

    expect(reAddRes.status).toBe(201);
    expect(reAddRes.body.data.member).toMatchObject({ email: invitee.email, role: 'ADMIN' });

    const listRes = await request(app)
      .get(`/api/v1/weddings/${weddingId}/members`)
      .set('Cookie', admin.cookies);
    expect(listRes.body.data.items).toHaveLength(2);
  });

  // Regression test for a real bug: the compound {weddingId, userId} unique
  // index was being checked with isDuplicateKeyError(error, 'weddingId') /
  // (error, 'userId') — calls meant for a single-field index — so the race
  // branch never matched and a concurrent add fell through to `throw error`
  // instead of the intended friendly 409. Fixed by teaching
  // isDuplicateKeyError to accept the full field set for a compound index.
  it('only lets one of two concurrent adds for the same new member succeed', async () => {
    const admin = await registerUser();
    const invitee = await registerUser();
    const weddingId = await createWedding(admin.cookies);

    const [first, second] = await Promise.all([
      post(`/api/v1/weddings/${weddingId}/members`)
        .set('Cookie', admin.cookies)
        .send({ email: invitee.email, role: 'MANAGER' }),
      post(`/api/v1/weddings/${weddingId}/members`)
        .set('Cookie', admin.cookies)
        .send({ email: invitee.email, role: 'MANAGER' }),
    ]);

    const statuses = [first.status, second.status].sort();
    expect(statuses).toEqual([201, 409]);
    const failed = first.status === 409 ? first : second;
    expect(failed.body.error.code).toBe('DUPLICATE_RESOURCE');
    expect(failed.body.error.message).toBe('This person is already a member of this wedding.');
  });
});

describe('PATCH /api/v1/weddings/:weddingId/members/:memberId', () => {
  it("an ADMIN can change a member's role", async () => {
    const admin = await registerUser();
    const invitee = await registerUser();
    const weddingId = await createWedding(admin.cookies);

    const addRes = await post(`/api/v1/weddings/${weddingId}/members`)
      .set('Cookie', admin.cookies)
      .send({ email: invitee.email, role: 'MANAGER' });
    const memberId = addRes.body.data.member.id as string;

    const res = await patch(`/api/v1/weddings/${weddingId}/members/${memberId}`)
      .set('Cookie', admin.cookies)
      .send({ role: 'ADMIN' });

    expect(res.status).toBe(200);
    expect(res.body.data.member.role).toBe('ADMIN');
  });

  it("cannot change another wedding's member through this wedding's id", async () => {
    const adminA = await registerUser();
    const adminB = await registerUser();
    const memberOfB = await registerUser();
    const weddingA = await createWedding(adminA.cookies);
    const weddingB = await createWedding(adminB.cookies);

    const addRes = await post(`/api/v1/weddings/${weddingB}/members`)
      .set('Cookie', adminB.cookies)
      .send({ email: memberOfB.email, role: 'MANAGER' });
    const memberOfBId = addRes.body.data.member.id as string;

    const res = await patch(`/api/v1/weddings/${weddingA}/members/${memberOfBId}`)
      .set('Cookie', adminA.cookies)
      .send({ role: 'ADMIN' });

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('MEMBER_NOT_FOUND');
  });

  it('a MANAGER cannot change a role (ADMIN-only)', async () => {
    const admin = await registerUser();
    const manager = await registerUser();
    const other = await registerUser();
    const weddingId = await createWedding(admin.cookies);

    await post(`/api/v1/weddings/${weddingId}/members`)
      .set('Cookie', admin.cookies)
      .send({ email: manager.email, role: 'MANAGER' });
    const addRes = await post(`/api/v1/weddings/${weddingId}/members`)
      .set('Cookie', admin.cookies)
      .send({ email: other.email, role: 'MANAGER' });
    const otherMemberId = addRes.body.data.member.id as string;

    const res = await patch(`/api/v1/weddings/${weddingId}/members/${otherMemberId}`)
      .set('Cookie', manager.cookies)
      .send({ role: 'ADMIN' });

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  // security.todo.test.ts's "the final active ADMIN of a wedding cannot be
  // removed" — extended here to cover demotion too, since demoting the sole
  // Admin to Manager leaves the wedding with zero Admins just as removal does.
  it('cannot demote the only active ADMIN', async () => {
    const admin = await registerUser();
    const weddingId = await createWedding(admin.cookies);

    const listRes = await request(app)
      .get(`/api/v1/weddings/${weddingId}/members`)
      .set('Cookie', admin.cookies);
    const memberId = listRes.body.data.items[0].id as string;

    const res = await patch(`/api/v1/weddings/${weddingId}/members/${memberId}`)
      .set('Cookie', admin.cookies)
      .send({ role: 'MANAGER' });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('CANNOT_REMOVE_LAST_ADMIN');
  });

  it('can demote one of two active ADMINs', async () => {
    const admin = await registerUser();
    const secondAdmin = await registerUser();
    const weddingId = await createWedding(admin.cookies);

    const addRes = await post(`/api/v1/weddings/${weddingId}/members`)
      .set('Cookie', admin.cookies)
      .send({ email: secondAdmin.email, role: 'ADMIN' });
    const memberId = addRes.body.data.member.id as string;

    const res = await patch(`/api/v1/weddings/${weddingId}/members/${memberId}`)
      .set('Cookie', admin.cookies)
      .send({ role: 'MANAGER' });

    expect(res.status).toBe(200);
    expect(res.body.data.member.role).toBe('MANAGER');
  });
});

describe('DELETE /api/v1/weddings/:weddingId/members/:memberId', () => {
  it('an ADMIN can remove a member', async () => {
    const admin = await registerUser();
    const invitee = await registerUser();
    const weddingId = await createWedding(admin.cookies);

    const addRes = await post(`/api/v1/weddings/${weddingId}/members`)
      .set('Cookie', admin.cookies)
      .send({ email: invitee.email, role: 'MANAGER' });
    const memberId = addRes.body.data.member.id as string;

    const res = await del(`/api/v1/weddings/${weddingId}/members/${memberId}`).set(
      'Cookie',
      admin.cookies,
    );

    expect(res.status).toBe(204);

    const listRes = await request(app)
      .get(`/api/v1/weddings/${weddingId}/members`)
      .set('Cookie', admin.cookies);
    expect(listRes.body.data.items).toHaveLength(1);
  });

  it('rolls back the member removal itself if revoking their invitations fails mid-transaction', async () => {
    const admin = await registerUser();
    const invitee = await registerUser();
    const weddingId = await createWedding(admin.cookies);

    const addRes = await post(`/api/v1/weddings/${weddingId}/members`)
      .set('Cookie', admin.cookies)
      .send({ email: invitee.email, role: 'MANAGER' });
    const memberId = addRes.body.data.member.id as string;

    const spy = vi
      .spyOn(WeddingInvitation, 'updateMany')
      .mockRejectedValueOnce(new Error('simulated invitation-revocation failure'));

    try {
      const res = await del(`/api/v1/weddings/${weddingId}/members/${memberId}`).set(
        'Cookie',
        admin.cookies,
      );
      expect(res.status).toBe(500);
    } finally {
      spy.mockRestore();
    }

    // The member removal itself must not have stuck — a failure in the
    // second step of the transaction must roll back the first too.
    const listRes = await request(app)
      .get(`/api/v1/weddings/${weddingId}/members`)
      .set('Cookie', admin.cookies);
    expect(listRes.body.data.items).toHaveLength(2);
  });

  it("cannot remove another wedding's member through this wedding's id", async () => {
    const adminA = await registerUser();
    const adminB = await registerUser();
    const memberOfB = await registerUser();
    const weddingA = await createWedding(adminA.cookies);
    const weddingB = await createWedding(adminB.cookies);

    const addRes = await post(`/api/v1/weddings/${weddingB}/members`)
      .set('Cookie', adminB.cookies)
      .send({ email: memberOfB.email, role: 'MANAGER' });
    const memberOfBId = addRes.body.data.member.id as string;

    const res = await del(`/api/v1/weddings/${weddingA}/members/${memberOfBId}`).set(
      'Cookie',
      adminA.cookies,
    );

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('MEMBER_NOT_FOUND');

    const stillThere = await request(app)
      .get(`/api/v1/weddings/${weddingB}/members`)
      .set('Cookie', adminB.cookies);
    expect(
      (stillThere.body.data.items as { email: string }[]).some((m) => m.email === memberOfB.email),
    ).toBe(true);
  });

  it('cannot remove the only active ADMIN', async () => {
    const admin = await registerUser();
    const weddingId = await createWedding(admin.cookies);

    const listRes = await request(app)
      .get(`/api/v1/weddings/${weddingId}/members`)
      .set('Cookie', admin.cookies);
    const memberId = listRes.body.data.items[0].id as string;

    const res = await del(`/api/v1/weddings/${weddingId}/members/${memberId}`).set(
      'Cookie',
      admin.cookies,
    );

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('CANNOT_REMOVE_LAST_ADMIN');
  });

  it('a MANAGER cannot remove a member (ADMIN-only)', async () => {
    const admin = await registerUser();
    const manager = await registerUser();
    const other = await registerUser();
    const weddingId = await createWedding(admin.cookies);

    await post(`/api/v1/weddings/${weddingId}/members`)
      .set('Cookie', admin.cookies)
      .send({ email: manager.email, role: 'MANAGER' });
    const addRes = await post(`/api/v1/weddings/${weddingId}/members`)
      .set('Cookie', admin.cookies)
      .send({ email: other.email, role: 'MANAGER' });
    const otherMemberId = addRes.body.data.member.id as string;

    const res = await del(`/api/v1/weddings/${weddingId}/members/${otherMemberId}`).set(
      'Cookie',
      manager.cookies,
    );

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  it('returns MEMBER_NOT_FOUND for a well-formed but nonexistent member id', async () => {
    const admin = await registerUser();
    const weddingId = await createWedding(admin.cookies);

    const res = await del(`/api/v1/weddings/${weddingId}/members/507f1f77bcf86cd799439011`).set(
      'Cookie',
      admin.cookies,
    );

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('MEMBER_NOT_FOUND');
  });
});
