import request from 'supertest';
import { describe, expect, it } from 'vitest';

import { createApp } from '../../src/app.js';

const app = createApp();

// See tests/integration/auth.test.ts for why every POST needs this.
const ALLOWED_ORIGIN = 'http://localhost:3000';

function post(path: string) {
  return request(app).post(path).set('Origin', ALLOWED_ORIGIN);
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
  it("a non-member cannot read another user's wedding (WEDDING_NOT_FOUND, not FORBIDDEN)", async () => {
    const owner = await registerUser();
    const stranger = await registerUser();

    const createRes = await post('/api/v1/weddings').set('Cookie', owner).send(VALID_WEDDING);
    const weddingId = createRes.body.data.wedding.id as string;

    const res = await request(app).get(`/api/v1/weddings/${weddingId}`).set('Cookie', stranger);

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
