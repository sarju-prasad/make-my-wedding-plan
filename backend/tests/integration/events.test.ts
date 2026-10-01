import request from 'supertest';
import { describe, expect, it } from 'vitest';

import { createApp } from '../../src/app.js';

const app = createApp();

// See tests/integration/auth.test.ts for why every POST needs this.
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

const VALID_EVENT = {
  name: 'Haldi',
  startsAt: '2026-11-13T10:00:00+05:30',
  timezone: 'Asia/Kolkata',
};

let userCounter = 0;

/** Registers a fresh user (unique email per call) and returns their session cookies + email. */
async function registerUser(): Promise<{ cookies: string[]; email: string }> {
  userCounter += 1;
  const email = `event-test-${userCounter}@example.com`;
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

async function createEvent(
  weddingId: string,
  cookies: string[],
  overrides: Record<string, unknown> = {},
) {
  const res = await post(`/api/v1/weddings/${weddingId}/events`)
    .set('Cookie', cookies)
    .send({ ...VALID_EVENT, ...overrides });
  return { status: res.status, body: res.body };
}

/** Adds `invitee` as a MANAGER of `weddingId` (as `admin`), then immediately removes them via the real API. */
async function addThenRemoveMember(
  weddingId: string,
  admin: { cookies: string[] },
  invitee: { cookies: string[]; email: string },
): Promise<void> {
  const addRes = await post(`/api/v1/weddings/${weddingId}/members`)
    .set('Cookie', admin.cookies)
    .send({ email: invitee.email, role: 'MANAGER' });
  const memberId = addRes.body.data.member.id as string;
  await del(`/api/v1/weddings/${weddingId}/members/${memberId}`).set('Cookie', admin.cookies);
}

describe('POST /api/v1/weddings/:weddingId/events', () => {
  it('an authenticated active member can create an event', async () => {
    const admin = await registerUser();
    const weddingId = await createWedding(admin.cookies);

    const { status, body } = await createEvent(weddingId, admin.cookies);

    expect(status).toBe(201);
    expect(body.data.event).toMatchObject({
      name: 'Haldi',
      weddingId,
      timezone: 'Asia/Kolkata',
      status: 'ACTIVE',
    });
    expect(body.data.event.startsAt).toBe('2026-11-13T04:30:00.000Z');
  });

  it('requires authentication', async () => {
    const admin = await registerUser();
    const weddingId = await createWedding(admin.cookies);

    const res = await post(`/api/v1/weddings/${weddingId}/events`).send(VALID_EVENT);

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  // Existing, already-established convention (weddings.test.ts,
  // members.test.ts): a non-member/removed-member gets WEDDING_NOT_FOUND,
  // not FORBIDDEN, so a non-member can't use the response code to probe
  // which wedding ids are real. Reused here via the same loadMembership
  // middleware, not a new decision for this module.
  it('a non-member gets WEDDING_NOT_FOUND, not FORBIDDEN', async () => {
    const admin = await registerUser();
    const stranger = await registerUser();
    const weddingId = await createWedding(admin.cookies);

    const { status, body } = await createEvent(weddingId, stranger.cookies);

    expect(status).toBe(404);
    expect(body.error.code).toBe('WEDDING_NOT_FOUND');
  });

  it('a removed member gets WEDDING_NOT_FOUND, not FORBIDDEN', async () => {
    const admin = await registerUser();
    const removed = await registerUser();
    const weddingId = await createWedding(admin.cookies);
    await addThenRemoveMember(weddingId, admin, removed);

    const { status, body } = await createEvent(weddingId, removed.cookies);

    expect(status).toBe(404);
    expect(body.error.code).toBe('WEDDING_NOT_FOUND');
  });

  it('rejects a malformed weddingId', async () => {
    const admin = await registerUser();

    const res = await post('/api/v1/weddings/not-an-object-id/events')
      .set('Cookie', admin.cookies)
      .send(VALID_EVENT);

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('returns WEDDING_NOT_FOUND for a well-formed but nonexistent wedding', async () => {
    const admin = await registerUser();

    const { status, body } = await createEvent('507f1f77bcf86cd799439011', admin.cookies);

    expect(status).toBe(404);
    expect(body.error.code).toBe('WEDDING_NOT_FOUND');
  });

  describe('required-field validation', () => {
    const REQUIRED_FIELDS = ['name', 'startsAt', 'timezone'];

    it.each(REQUIRED_FIELDS)('rejects a request missing %s', async (field) => {
      const admin = await registerUser();
      const weddingId = await createWedding(admin.cookies);
      const body: Record<string, unknown> = { ...VALID_EVENT };
      Reflect.deleteProperty(body, field);

      const res = await post(`/api/v1/weddings/${weddingId}/events`)
        .set('Cookie', admin.cookies)
        .send(body);

      expect(res.status).toBe(422);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  it('rejects an invalid startsAt', async () => {
    const admin = await registerUser();
    const weddingId = await createWedding(admin.cookies);

    const { status, body } = await createEvent(weddingId, admin.cookies, {
      startsAt: 'not-a-real-date',
    });

    expect(status).toBe(422);
    expect(body.error.code).toBe('VALIDATION_ERROR');
  });

  it('rejects an invalid endsAt', async () => {
    const admin = await registerUser();
    const weddingId = await createWedding(admin.cookies);

    const { status, body } = await createEvent(weddingId, admin.cookies, {
      endsAt: 'not-a-real-date',
    });

    expect(status).toBe(422);
    expect(body.error.code).toBe('VALIDATION_ERROR');
  });

  it('rejects endsAt equal to startsAt', async () => {
    const admin = await registerUser();
    const weddingId = await createWedding(admin.cookies);

    const { status, body } = await createEvent(weddingId, admin.cookies, {
      endsAt: VALID_EVENT.startsAt,
    });

    expect(status).toBe(422);
    expect(body.error.code).toBe('VALIDATION_ERROR');
  });

  it('rejects endsAt before startsAt', async () => {
    const admin = await registerUser();
    const weddingId = await createWedding(admin.cookies);

    const { status, body } = await createEvent(weddingId, admin.cookies, {
      startsAt: '2026-11-13T18:00:00+05:30',
      endsAt: '2026-11-13T10:00:00+05:30',
    });

    expect(status).toBe(422);
    expect(body.error.code).toBe('VALIDATION_ERROR');
  });

  it('accepts a valid endsAt after startsAt', async () => {
    const admin = await registerUser();
    const weddingId = await createWedding(admin.cookies);

    const { status, body } = await createEvent(weddingId, admin.cookies, {
      endsAt: '2026-11-13T13:00:00+05:30',
    });

    expect(status).toBe(201);
    expect(body.data.event.endsAt).toBe('2026-11-13T07:30:00.000Z');
  });

  // api_design.docx §18/§52: createdBy/weddingId/status are system-derived
  // and must never come from the client — `.strict()` rejects the whole
  // request outright rather than silently dropping them (same pattern as
  // weddings.test.ts's equivalent test).
  it('rejects a request that tries to set createdBy, weddingId, or status', async () => {
    const admin = await registerUser();
    const weddingId = await createWedding(admin.cookies);

    const { status, body } = await createEvent(weddingId, admin.cookies, {
      createdBy: '507f1f77bcf86cd799439099',
      weddingId: '507f1f77bcf86cd799439098',
      status: 'ARCHIVED',
    });

    expect(status).toBe(422);
    expect(body.error.code).toBe('VALIDATION_ERROR');
  });

  it('accepts an optional venue and livestream', async () => {
    const admin = await registerUser();
    const weddingId = await createWedding(admin.cookies);

    const { status, body } = await createEvent(weddingId, admin.cookies, {
      venue: {
        name: 'Ahmedabad Venue',
        address: 'Ahmedabad, Gujarat',
        latitude: 23.0225,
        longitude: 72.5714,
        googleMapsUrl: 'https://maps.google.com/?q=23.0225,72.5714',
      },
      livestream: { url: 'https://youtube.com/watch?v=example' },
    });

    expect(status).toBe(201);
    expect(body.data.event.venue).toMatchObject({ name: 'Ahmedabad Venue' });
    expect(body.data.event.livestream).toMatchObject({
      url: 'https://youtube.com/watch?v=example',
    });
  });
});

describe('GET /api/v1/weddings/:weddingId/events', () => {
  it('an active member can list events', async () => {
    const admin = await registerUser();
    const weddingId = await createWedding(admin.cookies);
    await createEvent(weddingId, admin.cookies, { name: 'Haldi' });
    await createEvent(weddingId, admin.cookies, {
      name: 'Sangeet',
      startsAt: '2026-11-14T18:00:00+05:30',
    });

    const res = await request(app)
      .get(`/api/v1/weddings/${weddingId}/events`)
      .set('Cookie', admin.cookies);

    expect(res.status).toBe(200);
    expect(res.body.data.items).toHaveLength(2);
    // Ascending by startsAt (Haldi 11/13 before Sangeet 11/14).
    expect(res.body.data.items[0].name).toBe('Haldi');
    expect(res.body.data.items[1].name).toBe('Sangeet');
    expect(res.body.data.pagination).toMatchObject({ page: 1, limit: 20, totalItems: 2 });
  });

  it('only returns events belonging to the requested wedding', async () => {
    const adminA = await registerUser();
    const adminB = await registerUser();
    const weddingA = await createWedding(adminA.cookies);
    const weddingB = await createWedding(adminB.cookies);
    await createEvent(weddingA, adminA.cookies, { name: 'Wedding A Event' });
    await createEvent(weddingB, adminB.cookies, { name: 'Wedding B Event' });

    const res = await request(app)
      .get(`/api/v1/weddings/${weddingA}/events`)
      .set('Cookie', adminA.cookies);

    expect(res.body.data.items).toHaveLength(1);
    expect(res.body.data.items[0].name).toBe('Wedding A Event');
  });

  it('a non-member cannot list events (WEDDING_NOT_FOUND)', async () => {
    const admin = await registerUser();
    const stranger = await registerUser();
    const weddingId = await createWedding(admin.cookies);

    const res = await request(app)
      .get(`/api/v1/weddings/${weddingId}/events`)
      .set('Cookie', stranger.cookies);

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('WEDDING_NOT_FOUND');
  });

  it('a removed member cannot list events (WEDDING_NOT_FOUND)', async () => {
    const admin = await registerUser();
    const removed = await registerUser();
    const weddingId = await createWedding(admin.cookies);
    await addThenRemoveMember(weddingId, admin, removed);

    const res = await request(app)
      .get(`/api/v1/weddings/${weddingId}/events`)
      .set('Cookie', removed.cookies);

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('WEDDING_NOT_FOUND');
  });

  it('returns an empty array for a wedding with no events', async () => {
    const admin = await registerUser();
    const weddingId = await createWedding(admin.cookies);

    const res = await request(app)
      .get(`/api/v1/weddings/${weddingId}/events`)
      .set('Cookie', admin.cookies);

    expect(res.status).toBe(200);
    expect(res.body.data.items).toEqual([]);
    expect(res.body.data.pagination.totalItems).toBe(0);
  });
});

describe('GET /api/v1/weddings/:weddingId/events/:eventId', () => {
  it('an active member can retrieve an event', async () => {
    const admin = await registerUser();
    const weddingId = await createWedding(admin.cookies);
    const { body: createBody } = await createEvent(weddingId, admin.cookies);
    const eventId = createBody.data.event.id as string;

    const res = await request(app)
      .get(`/api/v1/weddings/${weddingId}/events/${eventId}`)
      .set('Cookie', admin.cookies);

    expect(res.status).toBe(200);
    expect(res.body.data.event.id).toBe(eventId);
  });

  it('a non-member cannot retrieve an event (WEDDING_NOT_FOUND)', async () => {
    const admin = await registerUser();
    const stranger = await registerUser();
    const weddingId = await createWedding(admin.cookies);
    const { body: createBody } = await createEvent(weddingId, admin.cookies);
    const eventId = createBody.data.event.id as string;

    const res = await request(app)
      .get(`/api/v1/weddings/${weddingId}/events/${eventId}`)
      .set('Cookie', stranger.cookies);

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('WEDDING_NOT_FOUND');
  });

  it('a removed member cannot retrieve an event (WEDDING_NOT_FOUND)', async () => {
    const admin = await registerUser();
    const removed = await registerUser();
    const weddingId = await createWedding(admin.cookies);
    const { body: createBody } = await createEvent(weddingId, admin.cookies);
    const eventId = createBody.data.event.id as string;
    await addThenRemoveMember(weddingId, admin, removed);

    const res = await request(app)
      .get(`/api/v1/weddings/${weddingId}/events/${eventId}`)
      .set('Cookie', removed.cookies);

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('WEDDING_NOT_FOUND');
  });

  it('returns EVENT_NOT_FOUND for a well-formed but nonexistent event', async () => {
    const admin = await registerUser();
    const weddingId = await createWedding(admin.cookies);

    const res = await request(app)
      .get(`/api/v1/weddings/${weddingId}/events/507f1f77bcf86cd799439011`)
      .set('Cookie', admin.cookies);

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('EVENT_NOT_FOUND');
  });

  it('rejects a malformed eventId', async () => {
    const admin = await registerUser();
    const weddingId = await createWedding(admin.cookies);

    const res = await request(app)
      .get(`/api/v1/weddings/${weddingId}/events/not-an-object-id`)
      .set('Cookie', admin.cookies);

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  // The cross-wedding security test — confirms weddingId is actually
  // enforced as the tenant boundary for events, not just checked for
  // membership access.
  describe('cross-wedding access', () => {
    it("cannot retrieve wedding B's event through wedding A's id, or vice versa", async () => {
      const adminA = await registerUser();
      const adminB = await registerUser();
      const weddingA = await createWedding(adminA.cookies);
      const weddingB = await createWedding(adminB.cookies);
      const { body: eventABody } = await createEvent(weddingA, adminA.cookies, {
        name: 'Event A',
      });
      const { body: eventBBody } = await createEvent(weddingB, adminB.cookies, {
        name: 'Event B',
      });
      const eventAId = eventABody.data.event.id as string;
      const eventBId = eventBBody.data.event.id as string;

      const crossOne = await request(app)
        .get(`/api/v1/weddings/${weddingA}/events/${eventBId}`)
        .set('Cookie', adminA.cookies);
      expect(crossOne.status).toBe(404);
      expect(crossOne.body.error.code).toBe('EVENT_NOT_FOUND');

      const crossTwo = await request(app)
        .get(`/api/v1/weddings/${weddingB}/events/${eventAId}`)
        .set('Cookie', adminB.cookies);
      expect(crossTwo.status).toBe(404);
      expect(crossTwo.body.error.code).toBe('EVENT_NOT_FOUND');
    });
  });
});
