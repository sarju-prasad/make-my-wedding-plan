import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';

import { createApp } from '../../src/app.js';
// Reaching into the module's internal model, rather than its service entry
// point, only to simulate a mid-transaction failure below — there's no other
// way to force the second write of a two-write transaction to fail without
// this. Not a pattern to copy for anything other than this one atomicity test.
import { WeddingMember } from '../../src/modules/weddings/members.model.js';
import { Wedding } from '../../src/modules/weddings/weddings.model.js';

const app = createApp();

// See tests/integration/auth.test.ts for why every POST needs this.
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

/** Registers a fresh user (unique email per call) and returns their session cookies. */
async function registerUser(): Promise<string[]> {
  userCounter += 1;
  const res = await post('/api/v1/auth/register').send({
    name: `Test User ${userCounter}`,
    email: `wedding-test-${userCounter}@example.com`,
    password: 'correct-horse-battery',
  });
  return res.headers['set-cookie'] as unknown as string[];
}

/** Same as registerUser(), but also returns the email — needed to add this user as a member by email. */
async function registerUserWithEmail(): Promise<{ cookies: string[]; email: string }> {
  const cookies = await registerUser();
  return { cookies, email: `wedding-test-${userCounter}@example.com` };
}

async function createWedding(cookies: string[]): Promise<string> {
  const res = await post('/api/v1/weddings').set('Cookie', cookies).send(VALID_WEDDING);
  return res.body.data.wedding.id as string;
}

describe('POST /api/v1/weddings', () => {
  it('requires authentication', async () => {
    const res = await post('/api/v1/weddings').send(VALID_WEDDING);
    expect(res.status).toBe(401);
  });

  it('creates a wedding, generates a slug, and makes the creator an ADMIN', async () => {
    const cookies = await registerUser();

    const createRes = await post('/api/v1/weddings').set('Cookie', cookies).send(VALID_WEDDING);

    expect(createRes.status).toBe(201);
    expect(createRes.body.data.wedding).toMatchObject({
      name: 'Ananya & Arjun',
      slug: 'ananya-arjun',
      status: 'ACTIVE',
    });

    const weddingId = createRes.body.data.wedding.id as string;
    const getRes = await request(app).get(`/api/v1/weddings/${weddingId}`).set('Cookie', cookies);

    expect(getRes.status).toBe(200);
    expect(getRes.body.data.wedding.id).toBe(weddingId);
  });

  it('accepts an optional description and returns it on both create and get', async () => {
    const cookies = await registerUser();

    const createRes = await post('/api/v1/weddings')
      .set('Cookie', cookies)
      .send({ ...VALID_WEDDING, description: 'A small backyard ceremony with close family.' });

    expect(createRes.status).toBe(201);
    expect(createRes.body.data.wedding.description).toBe(
      'A small backyard ceremony with close family.',
    );

    const weddingId = createRes.body.data.wedding.id as string;
    const getRes = await request(app).get(`/api/v1/weddings/${weddingId}`).set('Cookie', cookies);

    expect(getRes.body.data.wedding.description).toBe(
      'A small backyard ceremony with close family.',
    );
  });

  it('omits description from the response entirely when not provided', async () => {
    const cookies = await registerUser();

    const createRes = await post('/api/v1/weddings').set('Cookie', cookies).send(VALID_WEDDING);

    expect(createRes.status).toBe(201);
    expect('description' in createRes.body.data.wedding).toBe(false);
  });

  it('rejects a description longer than 2000 characters', async () => {
    const cookies = await registerUser();

    const res = await post('/api/v1/weddings')
      .set('Cookie', cookies)
      .send({ ...VALID_WEDDING, description: 'x'.repeat(2001) });

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('assigns different slugs to two weddings with the same partner names', async () => {
    const cookiesA = await registerUser();
    const cookiesB = await registerUser();

    const first = await post('/api/v1/weddings').set('Cookie', cookiesA).send(VALID_WEDDING);
    const second = await post('/api/v1/weddings').set('Cookie', cookiesB).send(VALID_WEDDING);

    expect(first.body.data.wedding.slug).toBe('ananya-arjun');
    expect(second.body.data.wedding.slug).toBe('ananya-arjun-2');
  });

  it('rejects a request missing required fields with VALIDATION_ERROR', async () => {
    const cookies = await registerUser();

    const res = await post('/api/v1/weddings')
      .set('Cookie', cookies)
      .send({ name: 'Missing everything else' });

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('rejects an invalid IANA timezone', async () => {
    const cookies = await registerUser();

    const res = await post('/api/v1/weddings')
      .set('Cookie', cookies)
      .send({ ...VALID_WEDDING, timezone: 'Not/A_Real_Zone' });

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('rejects a malformed (non date-only) weddingDate', async () => {
    const cookies = await registerUser();

    const res = await post('/api/v1/weddings')
      .set('Cookie', cookies)
      .send({ ...VALID_WEDDING, weddingDate: '2026-11-14T10:00:00.000Z' });

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  // A regression test for a real bug: z.coerce.date() on a bare date-only
  // string parses it as UTC midnight, which is the *previous* calendar day
  // in any timezone behind UTC — e.g. America/Los_Angeles (UTC-8).
  it("stores the wedding date as midnight in the wedding's own timezone, not UTC", async () => {
    const cookies = await registerUser();

    const res = await post('/api/v1/weddings')
      .set('Cookie', cookies)
      .send({ ...VALID_WEDDING, weddingDate: '2026-12-25', timezone: 'America/Los_Angeles' });

    expect(res.status).toBe(201);
    const stored = new Date(res.body.data.wedding.weddingDate as string);
    // Rendered back in the wedding's own timezone, the calendar date must
    // still be the 25th, not the 24th.
    const localDate = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Los_Angeles',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(stored);
    expect(localDate).toBe('2026-12-25');
  });
});

describe('POST /api/v1/weddings — required-field validation', () => {
  const REQUIRED_FIELD_PATHS = [
    'name',
    'couple.partnerOneName',
    'couple.partnerTwoName',
    'weddingDate',
    'timezone',
    'location',
    'location.address',
    'location.latitude',
    'location.longitude',
  ];

  // Non-null assertions are fine in tests (see eslint.config.js) — every
  // path in REQUIRED_FIELD_PATHS is a literal dotted path into VALID_WEDDING,
  // so each segment is guaranteed to exist; noUncheckedIndexedAccess just
  // can't see that statically.
  function withFieldOmitted(path: string): Record<string, unknown> {
    const clone = structuredClone(VALID_WEDDING) as Record<string, unknown>;
    const keys = path.split('.');
    let target = clone;
    for (let i = 0; i < keys.length - 1; i += 1) {
      target = target[keys[i]!] as Record<string, unknown>;
    }
    Reflect.deleteProperty(target, keys[keys.length - 1]!);
    return clone;
  }

  it.each(REQUIRED_FIELD_PATHS)('rejects a request missing %s', async (path) => {
    const cookies = await registerUser();

    const res = await post('/api/v1/weddings').set('Cookie', cookies).send(withFieldOmitted(path));

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('rejects invalid input types (latitude as a string, weddingDate as a number)', async () => {
    const cookies = await registerUser();

    const res = await post('/api/v1/weddings')
      .set('Cookie', cookies)
      .send({
        ...VALID_WEDDING,
        weddingDate: 20261114,
        location: { ...VALID_WEDDING.location, latitude: '24.5762' },
      });

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  // api_design.docx §22 / §52: createdBy, status, and role are system-derived
  // and must never come from the client — the schema's `.strict()` rejects
  // the whole request outright rather than silently dropping them, which is a
  // stronger guarantee than merely ignoring them.
  it('rejects a request that tries to set createdBy, status, or role', async () => {
    const cookies = await registerUser();

    const res = await post('/api/v1/weddings')
      .set('Cookie', cookies)
      .send({
        ...VALID_WEDDING,
        createdBy: '507f1f77bcf86cd799439099',
        status: 'ARCHIVED',
        role: 'ADMIN',
      });

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });
});

describe('POST /api/v1/weddings — atomicity', () => {
  it('rolls back wedding creation if membership creation fails mid-transaction', async () => {
    const cookies = await registerUser();
    const spy = vi
      .spyOn(WeddingMember, 'create')
      .mockRejectedValueOnce(new Error('simulated membership failure'));

    try {
      const res = await post('/api/v1/weddings').set('Cookie', cookies).send(VALID_WEDDING);
      expect(res.status).toBe(500);
      expect(res.body.error.code).toBe('INTERNAL_SERVER_ERROR');
    } finally {
      spy.mockRestore();
    }

    const listRes = await request(app).get('/api/v1/weddings').set('Cookie', cookies);
    expect(listRes.body.data.items).toHaveLength(0);
  });
});

describe('GET /api/v1/weddings', () => {
  it('lists only the weddings the caller belongs to', async () => {
    const cookiesA = await registerUser();
    const cookiesB = await registerUser();

    await post('/api/v1/weddings').set('Cookie', cookiesA).send(VALID_WEDDING);
    await post('/api/v1/weddings')
      .set('Cookie', cookiesB)
      .send({ ...VALID_WEDDING, name: "B's Wedding" });

    const res = await request(app).get('/api/v1/weddings').set('Cookie', cookiesA);

    expect(res.status).toBe(200);
    expect(res.body.data.items).toHaveLength(1);
    expect(res.body.data.items[0].name).toBe('Ananya & Arjun');
    expect(res.body.data.pagination).toMatchObject({ page: 1, limit: 20, totalItems: 1 });
  });
});

describe('GET /api/v1/weddings/:weddingId — cross-wedding access', () => {
  it('requires authentication', async () => {
    const owner = await registerUser();
    const createRes = await post('/api/v1/weddings').set('Cookie', owner).send(VALID_WEDDING);
    const weddingId = createRes.body.data.wedding.id as string;

    const res = await request(app).get(`/api/v1/weddings/${weddingId}`);

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  it("a non-member cannot read another user's wedding (WEDDING_NOT_FOUND, not FORBIDDEN)", async () => {
    const owner = await registerUser();
    const stranger = await registerUser();

    const createRes = await post('/api/v1/weddings').set('Cookie', owner).send(VALID_WEDDING);
    const weddingId = createRes.body.data.wedding.id as string;

    const res = await request(app).get(`/api/v1/weddings/${weddingId}`).set('Cookie', stranger);

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('WEDDING_NOT_FOUND');
  });

  // A real DELETE /weddings/:weddingId/members/:memberId exists now
  // (members.service.ts), but it refuses to remove a wedding's only active
  // ADMIN — exactly the state this test needs (the wedding's sole member,
  // removed). That's the correct business rule, not a gap in this test: it
  // still flips the wedding_members row directly, same as the atomicity
  // test above, to verify the wedding-access check itself behaves
  // correctly against a REMOVED membership, however one arises.
  it('a removed member cannot read the wedding (WEDDING_NOT_FOUND, not FORBIDDEN)', async () => {
    const owner = await registerUser();
    const createRes = await post('/api/v1/weddings').set('Cookie', owner).send(VALID_WEDDING);
    const weddingId = createRes.body.data.wedding.id as string;

    await WeddingMember.updateOne({ weddingId, role: 'ADMIN' }, { $set: { status: 'REMOVED' } });

    const res = await request(app).get(`/api/v1/weddings/${weddingId}`).set('Cookie', owner);

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('WEDDING_NOT_FOUND');
  });

  it('returns WEDDING_NOT_FOUND (not a 500) for a well-formed but nonexistent id', async () => {
    const cookies = await registerUser();

    const res = await request(app)
      .get('/api/v1/weddings/507f1f77bcf86cd799439011')
      .set('Cookie', cookies);

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('WEDDING_NOT_FOUND');
  });

  // api_design.docx §18: "Validate ObjectId-like route parameters before
  // database calls" — a malformed id is a client validation error (422),
  // distinct from a well-formed id that's nonexistent/inaccessible (404).
  it('returns VALIDATION_ERROR (not a 500 or 404) for a malformed id', async () => {
    const cookies = await registerUser();

    const res = await request(app).get('/api/v1/weddings/not-an-object-id').set('Cookie', cookies);

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });
});

describe('loadMembership blocks access to an archived wedding', () => {
  // No archive endpoint exists yet (see CLAUDE.md) — flipping isArchived
  // directly via the model is the only way to produce this state at all,
  // same reasoning as this file's other direct-model-write tests.
  //
  // GET /weddings/:weddingId itself already excludes archived weddings via
  // its own getWedding()/.excludeArchived() call, independent of
  // loadMembership — so this deliberately goes through a *sub-resource*
  // route instead (GET .../members), which has no archived check of its
  // own and relies entirely on loadMembership's (weddings.service.ts's
  // findActiveMembership) for this.
  it('blocks a sub-resource route (GET .../members) once the wedding is archived', async () => {
    const owner = await registerUser();
    const createRes = await post('/api/v1/weddings').set('Cookie', owner).send(VALID_WEDDING);
    const weddingId = createRes.body.data.wedding.id as string;

    const before = await request(app)
      .get(`/api/v1/weddings/${weddingId}/members`)
      .set('Cookie', owner);
    expect(before.status).toBe(200);

    await Wedding.updateOne({ _id: weddingId }, { isArchived: true, archivedAt: new Date() });

    const after = await request(app)
      .get(`/api/v1/weddings/${weddingId}/members`)
      .set('Cookie', owner);

    expect(after.status).toBe(404);
    expect(after.body.error.code).toBe('WEDDING_NOT_FOUND');
  });
});

describe('PATCH /api/v1/weddings/:weddingId', () => {
  it('requires authentication', async () => {
    const owner = await registerUser();
    const weddingId = await createWedding(owner);

    const res = await patch(`/api/v1/weddings/${weddingId}`).send({ name: 'New Name' });

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  it('an ADMIN can update their own wedding', async () => {
    const owner = await registerUser();
    const weddingId = await createWedding(owner);

    const res = await patch(`/api/v1/weddings/${weddingId}`).set('Cookie', owner).send({
      name: 'Updated Name',
      description: 'An updated description',
    });

    expect(res.status).toBe(200);
    expect(res.body.data.wedding).toMatchObject({
      name: 'Updated Name',
      description: 'An updated description',
    });
  });

  it("cannot update another user's wedding (WEDDING_NOT_FOUND, not FORBIDDEN)", async () => {
    const ownerA = await registerUser();
    const ownerB = await registerUser();
    const weddingA = await createWedding(ownerA);
    const weddingB = await createWedding(ownerB);

    const resAonB = await patch(`/api/v1/weddings/${weddingB}`)
      .set('Cookie', ownerA)
      .send({ name: 'Hijacked' });
    expect(resAonB.status).toBe(404);
    expect(resAonB.body.error.code).toBe('WEDDING_NOT_FOUND');

    const resBonA = await patch(`/api/v1/weddings/${weddingA}`)
      .set('Cookie', ownerB)
      .send({ name: 'Hijacked' });
    expect(resBonA.status).toBe(404);
    expect(resBonA.body.error.code).toBe('WEDDING_NOT_FOUND');
  });

  it('a removed member cannot update the wedding (WEDDING_NOT_FOUND, not FORBIDDEN)', async () => {
    const admin = await registerUser();
    const removed = await registerUserWithEmail();
    const weddingId = await createWedding(admin);

    const addRes = await post(`/api/v1/weddings/${weddingId}/members`)
      .set('Cookie', admin)
      .send({ email: removed.email, role: 'MANAGER' });
    const memberId = addRes.body.data.member.id as string;
    await del(`/api/v1/weddings/${weddingId}/members/${memberId}`).set('Cookie', admin);

    const res = await patch(`/api/v1/weddings/${weddingId}`)
      .set('Cookie', removed.cookies)
      .send({ name: 'Should not apply' });

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('WEDDING_NOT_FOUND');
  });

  it('an active MANAGER (non-ADMIN) cannot update the wedding', async () => {
    const admin = await registerUser();
    const manager = await registerUserWithEmail();
    const weddingId = await createWedding(admin);

    await post(`/api/v1/weddings/${weddingId}/members`)
      .set('Cookie', admin)
      .send({ email: manager.email, role: 'MANAGER' });

    const res = await patch(`/api/v1/weddings/${weddingId}`)
      .set('Cookie', manager.cookies)
      .send({ name: 'Should not apply' });

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  it('rejects an empty PATCH body', async () => {
    const owner = await registerUser();
    const weddingId = await createWedding(owner);

    const res = await patch(`/api/v1/weddings/${weddingId}`).set('Cookie', owner).send({});

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('rejects an empty name', async () => {
    const owner = await registerUser();
    const weddingId = await createWedding(owner);

    const res = await patch(`/api/v1/weddings/${weddingId}`)
      .set('Cookie', owner)
      .send({ name: '   ' });

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('rejects a description over 2000 characters', async () => {
    const owner = await registerUser();
    const weddingId = await createWedding(owner);

    const res = await patch(`/api/v1/weddings/${weddingId}`)
      .set('Cookie', owner)
      .send({ description: 'x'.repeat(2001) });

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('rejects an empty partner name', async () => {
    const owner = await registerUser();
    const weddingId = await createWedding(owner);

    const res = await patch(`/api/v1/weddings/${weddingId}`)
      .set('Cookie', owner)
      .send({ couple: { partnerOneName: '', partnerTwoName: 'Someone' } });

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('rejects a malformed weddingDate', async () => {
    const owner = await registerUser();
    const weddingId = await createWedding(owner);

    const res = await patch(`/api/v1/weddings/${weddingId}`)
      .set('Cookie', owner)
      .send({ weddingDate: 'not-a-date' });

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('rejects an invalid timezone', async () => {
    const owner = await registerUser();
    const weddingId = await createWedding(owner);

    const res = await patch(`/api/v1/weddings/${weddingId}`)
      .set('Cookie', owner)
      .send({ timezone: 'NotATimezone' });

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('rejects an empty location address', async () => {
    const owner = await registerUser();
    const weddingId = await createWedding(owner);

    const res = await patch(`/api/v1/weddings/${weddingId}`)
      .set('Cookie', owner)
      .send({ location: { address: '', latitude: 1, longitude: 1 } });

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('rejects an out-of-range latitude', async () => {
    const owner = await registerUser();
    const weddingId = await createWedding(owner);

    const res = await patch(`/api/v1/weddings/${weddingId}`)
      .set('Cookie', owner)
      .send({ location: { address: 'Somewhere', latitude: 999, longitude: 1 } });

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('rejects an out-of-range longitude', async () => {
    const owner = await registerUser();
    const weddingId = await createWedding(owner);

    const res = await patch(`/api/v1/weddings/${weddingId}`)
      .set('Cookie', owner)
      .send({ location: { address: 'Somewhere', latitude: 1, longitude: 999 } });

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('rejects an incomplete location (missing latitude)', async () => {
    const owner = await registerUser();
    const weddingId = await createWedding(owner);

    const res = await patch(`/api/v1/weddings/${weddingId}`)
      .set('Cookie', owner)
      .send({ location: { address: 'Somewhere', longitude: 1 } });

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('rejects unknown fields', async () => {
    const owner = await registerUser();
    const weddingId = await createWedding(owner);

    const res = await patch(`/api/v1/weddings/${weddingId}`)
      .set('Cookie', owner)
      .send({ favoriteColor: 'teal' });

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  describe('partial update preserves unrelated fields', () => {
    it('updating only name preserves couple/date/timezone/location/description', async () => {
      const owner = await registerUser();
      const createRes = await post('/api/v1/weddings')
        .set('Cookie', owner)
        .send({ ...VALID_WEDDING, description: 'Original description' });
      const weddingId = createRes.body.data.wedding.id as string;

      const res = await patch(`/api/v1/weddings/${weddingId}`)
        .set('Cookie', owner)
        .send({ name: 'Only Name Changed' });

      expect(res.status).toBe(200);
      expect(res.body.data.wedding).toMatchObject({
        name: 'Only Name Changed',
        description: 'Original description',
        couple: VALID_WEDDING.couple,
        timezone: VALID_WEDDING.timezone,
        location: VALID_WEDDING.location,
      });
    });

    it('updating only description preserves all other fields', async () => {
      const owner = await registerUser();
      const weddingId = await createWedding(owner);

      const res = await patch(`/api/v1/weddings/${weddingId}`)
        .set('Cookie', owner)
        .send({ description: 'Only description changed' });

      expect(res.status).toBe(200);
      expect(res.body.data.wedding).toMatchObject({
        name: VALID_WEDDING.name,
        description: 'Only description changed',
        couple: VALID_WEDDING.couple,
        location: VALID_WEDDING.location,
      });
    });

    it('updating only weddingDate (no timezone) combines it with the existing timezone and preserves other fields', async () => {
      const owner = await registerUser();
      const weddingId = await createWedding(owner);

      const res = await patch(`/api/v1/weddings/${weddingId}`)
        .set('Cookie', owner)
        .send({ weddingDate: '2026-12-25' });

      expect(res.status).toBe(200);
      expect(res.body.data.wedding.timezone).toBe(VALID_WEDDING.timezone);
      expect(res.body.data.wedding.name).toBe(VALID_WEDDING.name);
      expect(res.body.data.wedding.location).toMatchObject(VALID_WEDDING.location);
      // Asia/Kolkata is UTC+5:30 — midnight local on 2026-12-25 is 2026-12-24T18:30:00Z.
      expect(res.body.data.wedding.weddingDate).toBe('2026-12-24T18:30:00.000Z');
    });

    it('updating only timezone (no weddingDate) keeps the same calendar day, reinterpreted in the new timezone', async () => {
      const owner = await registerUser();
      const weddingId = await createWedding(owner);

      const res = await patch(`/api/v1/weddings/${weddingId}`)
        .set('Cookie', owner)
        .send({ timezone: 'America/Los_Angeles' });

      expect(res.status).toBe(200);
      expect(res.body.data.wedding.name).toBe(VALID_WEDDING.name);
      expect(res.body.data.wedding.location).toMatchObject(VALID_WEDDING.location);
      expect(res.body.data.wedding.timezone).toBe('America/Los_Angeles');
      // The wedding's calendar date in its own (new) timezone must still be
      // 2026-11-14 — the same date it was in the old timezone — not shifted
      // by reinterpreting the raw UTC instant naively.
      const stored = new Date(res.body.data.wedding.weddingDate as string);
      const localDate = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'America/Los_Angeles',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }).format(stored);
      expect(localDate).toBe('2026-11-14');
    });

    it('updating location does not erase name/couple/date/description', async () => {
      const owner = await registerUser();
      const createRes = await post('/api/v1/weddings')
        .set('Cookie', owner)
        .send({ ...VALID_WEDDING, description: 'Keep me' });
      const weddingId = createRes.body.data.wedding.id as string;

      const res = await patch(`/api/v1/weddings/${weddingId}`)
        .set('Cookie', owner)
        .send({
          location: { address: 'New Venue', latitude: 10, longitude: 20 },
        });

      expect(res.status).toBe(200);
      expect(res.body.data.wedding).toMatchObject({
        name: VALID_WEDDING.name,
        description: 'Keep me',
        couple: VALID_WEDDING.couple,
        location: { address: 'New Venue', latitude: 10, longitude: 20 },
      });
    });
  });

  describe('protected fields cannot be changed through this endpoint', () => {
    const MALICIOUS_PAYLOADS = [
      { createdBy: '507f1f77bcf86cd799439099' },
      { id: '507f1f77bcf86cd799439099' },
      { _id: '507f1f77bcf86cd799439099' },
      { createdAt: '2000-01-01T00:00:00.000Z' },
      { updatedAt: '2000-01-01T00:00:00.000Z' },
      { isArchived: true },
      { archivedAt: '2000-01-01T00:00:00.000Z' },
      { archivedBy: '507f1f77bcf86cd799439099' },
      { status: 'ARCHIVED' },
      { slug: 'hijacked-slug' },
    ];

    it.each(MALICIOUS_PAYLOADS)('rejects a payload trying to set %j', async (payload) => {
      const owner = await registerUser();
      const weddingId = await createWedding(owner);

      const res = await patch(`/api/v1/weddings/${weddingId}`).set('Cookie', owner).send(payload);

      expect(res.status).toBe(422);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('data integrity', () => {
    it('updatedAt changes after a successful update', async () => {
      const owner = await registerUser();
      const createRes = await post('/api/v1/weddings').set('Cookie', owner).send(VALID_WEDDING);
      const weddingId = createRes.body.data.wedding.id as string;
      const originalUpdatedAt = createRes.body.data.wedding.updatedAt as string;

      const res = await patch(`/api/v1/weddings/${weddingId}`)
        .set('Cookie', owner)
        .send({ name: 'Changed' });

      expect(res.status).toBe(200);
      expect(new Date(res.body.data.wedding.updatedAt as string).getTime()).toBeGreaterThan(
        new Date(originalUpdatedAt).getTime(),
      );
    });

    it('persists the update — a subsequent GET reflects the new values', async () => {
      const owner = await registerUser();
      const weddingId = await createWedding(owner);

      await patch(`/api/v1/weddings/${weddingId}`)
        .set('Cookie', owner)
        .send({ name: 'Persisted Name' });

      const getRes = await request(app).get(`/api/v1/weddings/${weddingId}`).set('Cookie', owner);

      expect(getRes.body.data.wedding.name).toBe('Persisted Name');
    });
  });

  describe('concurrent updates', () => {
    it('two concurrent weddingDate/timezone-only updates: one succeeds, the other gets 409 CONCURRENT_UPDATE', async () => {
      const owner = await registerUser();
      const weddingId = await createWedding(owner);

      // Both requests read the same pre-update document (optimisticConcurrency:
      // true on the Wedding schema — weddings.model.ts) before either saves,
      // simulating two admins editing at once. Without that option, the second
      // save would silently overwrite the first using its stale read of the
      // field it wasn't even changing, rather than erroring.
      const [first, second] = await Promise.all([
        patch(`/api/v1/weddings/${weddingId}`)
          .set('Cookie', owner)
          .send({ weddingDate: '2026-12-25' }),
        patch(`/api/v1/weddings/${weddingId}`)
          .set('Cookie', owner)
          .send({ timezone: 'America/Los_Angeles' }),
      ]);

      const statuses = [first.status, second.status].sort((a, b) => a - b);
      expect(statuses).toEqual([200, 409]);

      const failed = first.status === 409 ? first : second;
      expect(failed.body.error.code).toBe('CONCURRENT_UPDATE');
    });
  });

  describe('slug is immutable', () => {
    it('updating the wedding name does not change the slug', async () => {
      const owner = await registerUser();
      const createRes = await post('/api/v1/weddings').set('Cookie', owner).send(VALID_WEDDING);
      const weddingId = createRes.body.data.wedding.id as string;
      const originalSlug = createRes.body.data.wedding.slug as string;

      const res = await patch(`/api/v1/weddings/${weddingId}`)
        .set('Cookie', owner)
        .send({ name: 'A Completely Different Name' });

      expect(res.body.data.wedding.slug).toBe(originalSlug);
    });

    it('updating the couple names (which the slug is actually derived from) does not change the slug', async () => {
      const owner = await registerUser();
      const createRes = await post('/api/v1/weddings').set('Cookie', owner).send(VALID_WEDDING);
      const weddingId = createRes.body.data.wedding.id as string;
      const originalSlug = createRes.body.data.wedding.slug as string;

      const res = await patch(`/api/v1/weddings/${weddingId}`)
        .set('Cookie', owner)
        .send({ couple: { partnerOneName: 'Different', partnerTwoName: 'Names' } });

      expect(res.status).toBe(200);
      expect(res.body.data.wedding.slug).toBe(originalSlug);
    });
  });
});
