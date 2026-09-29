import request from 'supertest';
import { describe, expect, it } from 'vitest';

import { createApp } from '../../src/app.js';
import { User } from '../../src/modules/auth/auth.model.js';

const app = createApp();

// middleware/origin-check.ts rejects state-changing requests with no
// Origin/Referer matching CORS_ALLOWED_ORIGINS (403) — tests/setup/global-setup.ts
// sets CORS_ALLOWED_ORIGINS to this value, so every POST below needs it.
const ALLOWED_ORIGIN = 'http://localhost:3000';

function post(path: string) {
  return request(app).post(path).set('Origin', ALLOWED_ORIGIN);
}

const VALID_REGISTRATION = {
  name: 'Ananya Sharma',
  email: 'ananya@example.com',
  password: 'correct-horse-battery',
};

describe('POST /api/v1/auth/register', () => {
  it('creates a user and sets access/refresh cookies', async () => {
    const res = await post('/api/v1/auth/register').send(VALID_REGISTRATION);

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      success: true,
      data: {
        user: {
          name: 'Ananya Sharma',
          email: 'ananya@example.com',
        },
      },
    });
    expect(res.body.data.user.passwordHash).toBeUndefined();
    expect(res.body.data.user.tokenVersion).toBeUndefined();

    const cookieHeader = res.headers['set-cookie'] as unknown as string[];
    expect(cookieHeader.some((c) => c.startsWith('access_token='))).toBe(true);
    expect(cookieHeader.some((c) => c.startsWith('refresh_token='))).toBe(true);
  });

  it('rejects a duplicate email with EMAIL_ALREADY_EXISTS', async () => {
    await post('/api/v1/auth/register').send(VALID_REGISTRATION);

    const res = await post('/api/v1/auth/register').send({
      ...VALID_REGISTRATION,
      name: 'Someone Else',
    });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('EMAIL_ALREADY_EXISTS');
  });

  it('rejects a short password with VALIDATION_ERROR', async () => {
    const res = await post('/api/v1/auth/register').send({
      ...VALID_REGISTRATION,
      password: 'short',
    });

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('normalizes the email to lowercase before storing it', async () => {
    await post('/api/v1/auth/register').send({
      ...VALID_REGISTRATION,
      email: 'Ananya@EXAMPLE.com',
    });

    const stored = await User.findOne({ email: 'ananya@example.com' });
    expect(stored).not.toBeNull();
  });
});

describe('POST /api/v1/auth/login', () => {
  it('authenticates with the correct password and sets cookies', async () => {
    await post('/api/v1/auth/register').send(VALID_REGISTRATION);

    const res = await post('/api/v1/auth/login').send({
      email: VALID_REGISTRATION.email,
      password: VALID_REGISTRATION.password,
    });

    expect(res.status).toBe(200);
    expect(res.body.data.user.email).toBe(VALID_REGISTRATION.email);
    const cookieHeader = res.headers['set-cookie'] as unknown as string[];
    expect(cookieHeader.some((c) => c.startsWith('access_token='))).toBe(true);
  });

  // api_design.docx §5.3: "Use a generic invalid-credentials response to
  // avoid account enumeration" — both a wrong password and a nonexistent
  // account must be indistinguishable to the caller.
  it('returns the same generic message for a wrong password as for a nonexistent account', async () => {
    await post('/api/v1/auth/register').send(VALID_REGISTRATION);

    const wrongPassword = await post('/api/v1/auth/login').send({
      email: VALID_REGISTRATION.email,
      password: 'not-the-password',
    });

    const noSuchAccount = await post('/api/v1/auth/login').send({
      email: 'nobody@example.com',
      password: VALID_REGISTRATION.password,
    });

    expect(wrongPassword.status).toBe(401);
    expect(noSuchAccount.status).toBe(401);
    expect(wrongPassword.body.error.code).toBe('UNAUTHORIZED');
    expect(wrongPassword.body.error.message).toBe(noSuchAccount.body.error.message);
  });

  it('is rate limited past the configured threshold', async () => {
    // middleware/rate-limit.ts: RATE_LIMIT_POLICIES['auth:login'] = 10 points / 60s.
    const attempt = () =>
      post('/api/v1/auth/login').send({
        email: 'nobody@example.com',
        password: 'whatever-password',
      });

    for (let i = 0; i < 10; i += 1) {
      await attempt();
    }
    const res = await attempt();

    expect(res.status).toBe(429);
    expect(res.body.error.code).toBe('RATE_LIMITED');
    expect(res.headers['retry-after']).toBeTruthy();
  });
});

describe('POST /api/v1/auth/refresh and /auth/me', () => {
  async function registerAndGetCookies(): Promise<string[]> {
    const res = await post('/api/v1/auth/register').send(VALID_REGISTRATION);
    return res.headers['set-cookie'] as unknown as string[];
  }

  it('me returns 401 without a session', async () => {
    const res = await request(app).get('/api/v1/auth/me');
    expect(res.status).toBe(401);
  });

  it('me returns the current user when authenticated', async () => {
    const cookies = await registerAndGetCookies();

    const res = await request(app).get('/api/v1/auth/me').set('Cookie', cookies);

    expect(res.status).toBe(200);
    expect(res.body.data.user.email).toBe(VALID_REGISTRATION.email);
  });

  it('refresh without a refresh cookie is rejected', async () => {
    const res = await post('/api/v1/auth/refresh');
    expect(res.status).toBe(401);
  });

  it('refresh issues a working access token from the refresh cookie alone', async () => {
    const cookies = await registerAndGetCookies();
    const refreshCookie = cookies.find((c) => c.startsWith('refresh_token='));
    expect(refreshCookie).toBeDefined();

    const refreshRes = await post('/api/v1/auth/refresh').set('Cookie', [refreshCookie!]);

    expect(refreshRes.status).toBe(200);
    const newAccessCookie = (refreshRes.headers['set-cookie'] as unknown as string[]).find((c) =>
      c.startsWith('access_token='),
    );
    expect(newAccessCookie).toBeDefined();

    const meRes = await request(app).get('/api/v1/auth/me').set('Cookie', [newAccessCookie!]);
    expect(meRes.status).toBe(200);
  });

  it('is rate limited past the configured threshold', async () => {
    // middleware/rate-limit.ts: RATE_LIMIT_POLICIES['auth:refresh'] = 20 points / 60s.
    const attempt = () => post('/api/v1/auth/refresh');

    for (let i = 0; i < 20; i += 1) {
      await attempt();
    }
    const res = await attempt();

    expect(res.status).toBe(429);
    expect(res.body.error.code).toBe('RATE_LIMITED');
  });
});

describe('POST /api/v1/auth/logout', () => {
  it('clears cookies and is safe to call without a session', async () => {
    const res = await post('/api/v1/auth/logout');
    expect(res.status).toBe(200);

    const again = await post('/api/v1/auth/logout');
    expect(again.status).toBe(200);
  });
});

describe('POST /api/v1/auth/forgot-password and /auth/reset-password', () => {
  // RESEND_API_KEY is unset in the test env (tests/setup/global-setup.ts) and
  // NODE_ENV=test is not production, so requestPasswordReset() takes the
  // devResetUrl branch — see auth.service.ts. This lets the full round trip
  // be tested without a real email provider, exactly as intended.
  function extractToken(devResetUrl: string): string {
    return new URL(devResetUrl).searchParams.get('token')!;
  }

  it('returns the same generic message whether or not the email is registered', async () => {
    await post('/api/v1/auth/register').send(VALID_REGISTRATION);

    const registered = await post('/api/v1/auth/forgot-password').send({
      email: VALID_REGISTRATION.email,
    });
    const unregistered = await post('/api/v1/auth/forgot-password').send({
      email: 'nobody@example.com',
    });

    expect(registered.status).toBe(200);
    expect(unregistered.status).toBe(200);
    expect(registered.body.data.message).toBe(unregistered.body.data.message);
  });

  it('includes a devResetUrl for a registered email but not for an unregistered one', async () => {
    await post('/api/v1/auth/register').send(VALID_REGISTRATION);

    const registered = await post('/api/v1/auth/forgot-password').send({
      email: VALID_REGISTRATION.email,
    });
    const unregistered = await post('/api/v1/auth/forgot-password').send({
      email: 'nobody@example.com',
    });

    expect(registered.body.data.devResetUrl).toContain('/reset-password?token=');
    expect(unregistered.body.data.devResetUrl).toBeUndefined();
  });

  it('resets the password, and the new password (not the old one) then works for login', async () => {
    await post('/api/v1/auth/register').send(VALID_REGISTRATION);

    const forgotRes = await post('/api/v1/auth/forgot-password').send({
      email: VALID_REGISTRATION.email,
    });
    const token = extractToken(forgotRes.body.data.devResetUrl as string);

    const resetRes = await post('/api/v1/auth/reset-password').send({
      token,
      password: 'a-brand-new-password',
    });
    expect(resetRes.status).toBe(200);

    const oldPasswordLogin = await post('/api/v1/auth/login').send({
      email: VALID_REGISTRATION.email,
      password: VALID_REGISTRATION.password,
    });
    expect(oldPasswordLogin.status).toBe(401);

    const newPasswordLogin = await post('/api/v1/auth/login').send({
      email: VALID_REGISTRATION.email,
      password: 'a-brand-new-password',
    });
    expect(newPasswordLogin.status).toBe(200);
  });

  it('rejects reuse of an already-used reset token', async () => {
    await post('/api/v1/auth/register').send(VALID_REGISTRATION);

    const forgotRes = await post('/api/v1/auth/forgot-password').send({
      email: VALID_REGISTRATION.email,
    });
    const token = extractToken(forgotRes.body.data.devResetUrl as string);

    await post('/api/v1/auth/reset-password').send({ token, password: 'first-new-password' });
    const secondAttempt = await post('/api/v1/auth/reset-password').send({
      token,
      password: 'second-new-password',
    });

    expect(secondAttempt.status).toBe(401);
  });

  // A regression test for a real concurrency bug: the original
  // find-then-save implementation let two requests racing on the same
  // still-valid token both find the user, both pass the expiry check, and
  // both succeed, before either had saved the cleared token — sequential
  // reuse (the test above) doesn't exercise this, since the first request
  // fully completes (clearing the token) before the second even starts.
  it('only lets one of two concurrent requests with the same token succeed', async () => {
    await post('/api/v1/auth/register').send(VALID_REGISTRATION);

    const forgotRes = await post('/api/v1/auth/forgot-password').send({
      email: VALID_REGISTRATION.email,
    });
    const token = extractToken(forgotRes.body.data.devResetUrl as string);

    const [first, second] = await Promise.all([
      post('/api/v1/auth/reset-password').send({ token, password: 'password-attempt-one' }),
      post('/api/v1/auth/reset-password').send({ token, password: 'password-attempt-two' }),
    ]);

    const statuses = [first.status, second.status].sort();
    expect(statuses).toEqual([200, 401]);
  });

  it('rejects a malformed/unknown token', async () => {
    const res = await post('/api/v1/auth/reset-password').send({
      token: 'not-a-real-token',
      password: 'some-new-password',
    });
    expect(res.status).toBe(401);
  });

  it('invalidates existing sessions after a reset (tokenVersion bump)', async () => {
    const registerRes = await post('/api/v1/auth/register').send(VALID_REGISTRATION);
    const oldCookies = registerRes.headers['set-cookie'] as unknown as string[];
    const oldRefreshCookie = oldCookies.find((c) => c.startsWith('refresh_token='));

    const forgotRes = await post('/api/v1/auth/forgot-password').send({
      email: VALID_REGISTRATION.email,
    });
    const token = extractToken(forgotRes.body.data.devResetUrl as string);
    await post('/api/v1/auth/reset-password').send({ token, password: 'a-brand-new-password' });

    const refreshRes = await post('/api/v1/auth/refresh').set('Cookie', [oldRefreshCookie!]);
    expect(refreshRes.status).toBe(401);
  });

  it('is rate limited past the configured threshold', async () => {
    // middleware/rate-limit.ts: RATE_LIMIT_POLICIES['auth:reset-password'] = 10 points / 300s.
    const attempt = () =>
      post('/api/v1/auth/reset-password').send({
        token: 'a-token-that-does-not-exist',
        password: 'whatever-password',
      });

    for (let i = 0; i < 10; i += 1) {
      await attempt();
    }
    const res = await attempt();

    expect(res.status).toBe(429);
    expect(res.body.error.code).toBe('RATE_LIMITED');
  });
});
