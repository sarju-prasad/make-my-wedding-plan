import request from 'supertest';
import { describe, expect, it } from 'vitest';

import { createApp } from '../../src/app.js';

const app = createApp();

describe('GET /api/v1/healthz', () => {
  it('returns 200 without requiring a database connection', async () => {
    const res = await request(app).get('/api/v1/healthz');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      success: true,
      data: { status: 'ok', uptimeSeconds: expect.any(Number) },
    });
  });
});

describe('GET /api/v1/readyz', () => {
  it('returns 200 and reports the database as connected', async () => {
    // test-setup.ts's beforeAll has already called connectDb() by this point.
    const res = await request(app).get('/api/v1/readyz');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      success: true,
      data: { status: 'ok', db: 'connected', uptimeSeconds: expect.any(Number) },
    });
  });
});

describe('unmatched routes and the error envelope', () => {
  it('returns the standard error envelope with a 404 for an unknown route', async () => {
    const res = await request(app).get('/api/v1/this-route-does-not-exist');

    expect(res.status).toBe(404);
    expect(res.body).toEqual({
      success: false,
      error: {
        code: 'NOT_FOUND',
        message: expect.stringContaining('/api/v1/this-route-does-not-exist'),
      },
    });
  });

  it('sets an x-request-id response header even on a 404', async () => {
    const res = await request(app).get('/api/v1/nope');
    expect(res.headers['x-request-id']).toBeTruthy();
  });

  it('echoes a valid inbound x-request-id rather than replacing it', async () => {
    const res = await request(app).get('/api/v1/healthz').set('x-request-id', 'test-fixed-id-123');
    expect(res.headers['x-request-id']).toBe('test-fixed-id-123');
  });
});

describe('CORS and CSRF origin checks', () => {
  it('rejects a state-changing request from a disallowed origin', async () => {
    // No route accepts POST yet, but the origin check runs before routing,
    // so this still exercises the 403 path rather than hitting notFound.
    const res = await request(app)
      .post('/api/v1/healthz')
      .set('Origin', 'https://evil.example.com')
      .send({});

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  it('allows a GET request with no Origin header (non-browser / same-origin)', async () => {
    const res = await request(app).get('/api/v1/healthz');
    expect(res.status).toBe(200);
  });

  it('allows a state-changing request from an allowed origin through the origin check', async () => {
    // No mutating route is mounted yet, so this reaches notFound (404) rather
    // than a real handler — the point is only that it clears origin-check,
    // i.e. it must NOT be the 403 the disallowed-origin case produces above.
    const res = await request(app)
      .post('/api/v1/healthz')
      .set('Origin', 'http://localhost:3000')
      .send({});

    expect(res.status).not.toBe(403);
  });
});
