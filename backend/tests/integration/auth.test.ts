import { SignJWT } from 'jose';
import request from 'supertest';
import { beforeAll, describe, expect, it } from 'vitest';

import { createApp } from '../../src/app.js';
import { env } from '../../src/config/env.js';
import { User } from '../../src/modules/auth/auth.model.js';

const app = createApp();

// db/connection.ts disables autoIndex outside development, and tests run
// with NODE_ENV=test — so without this, users.email's unique index simply
// doesn't exist here either, and the concurrent-duplicate-registration test
// below would pass for the wrong reason (no race actually being caught).
// Same gap, same fix, as tests/integration/{members,invitations}.test.ts.
beforeAll(async () => {
  await User.syncIndexes();
});

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

  it('rejects one of two concurrent registrations with the same email', async () => {
    // registerUser() pre-checks User.exists() before inserting, purely as a
    // fast path — the real guard against two requests racing past that
    // check is the unique index on users.email, caught via the
    // isDuplicateKeyError() catch around User.create() (auth.service.ts).
    // Without that index actually existing (scripts/sync-indexes.ts not
    // loading any models was exactly this bug), both of these would
    // succeed and leave two accounts sharing one email.
    const [first, second] = await Promise.all([
      post('/api/v1/auth/register').send(VALID_REGISTRATION),
      post('/api/v1/auth/register').send({ ...VALID_REGISTRATION, name: 'Someone Else' }),
    ]);

    const statuses = [first.status, second.status].sort();
    expect(statuses).toEqual([201, 409]);
    const loser = first.status === 409 ? first : second;
    expect(loser.body.error.code).toBe('EMAIL_ALREADY_EXISTS');

    const accounts = await User.find({ email: VALID_REGISTRATION.email });
    expect(accounts).toHaveLength(1);
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

  it('logs in with a password that has leading/trailing whitespace, unmodified', async () => {
    // Neither register's nor login's password field trims — if login ever
    // trimmed while register didn't (or vice versa), this exact password
    // would hash one way at registration and compare a different way at
    // login, locking the account out permanently.
    const spacedPassword = '  correct-horse-battery  ';
    await post('/api/v1/auth/register').send({ ...VALID_REGISTRATION, password: spacedPassword });

    const res = await post('/api/v1/auth/login').send({
      email: VALID_REGISTRATION.email,
      password: spacedPassword,
    });

    expect(res.status).toBe(200);
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

  it('is rate limited per target email even when each attempt comes from a different IP', async () => {
    // middleware/rate-limit.ts: RATE_LIMIT_POLICIES['auth:login-per-email'] =
    // 10 points / 60s. app.ts sets `trust proxy: 1`, so a distinct
    // X-Forwarded-For per request simulates attempts the per-IP auth:login
    // limit above would never catch on its own (each IP only sends one) —
    // this is exactly the distributed-credential-stuffing-against-one-
    // account case a per-IP-only limit misses.
    const attempt = (n: number) =>
      post('/api/v1/auth/login')
        .set('X-Forwarded-For', `10.0.0.${n}`)
        .send({ email: 'targeted-victim@example.com', password: 'whatever-password' });

    for (let i = 0; i < 10; i += 1) {
      await attempt(i);
    }
    const res = await attempt(10);

    expect(res.status).toBe(429);
    expect(res.body.error.code).toBe('RATE_LIMITED');
  });
});

describe('POST /api/v1/auth/refresh and /auth/me', () => {
  async function registerAndGetCookies(): Promise<string[]> {
    const res = await post('/api/v1/auth/register').send(VALID_REGISTRATION);
    return res.headers['set-cookie'] as unknown as string[];
  }

  it('me returns 401 UNAUTHORIZED (not ACCESS_TOKEN_EXPIRED) without a session', async () => {
    // No cookie at all is a different situation than an expired one —
    // lib/api.ts's apiFetch only retries-after-refresh on the latter
    // (ACCESS_TOKEN_EXPIRED specifically), since there's nothing to refresh
    // here in the first place.
    const res = await request(app).get('/api/v1/auth/me');
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  it('me returns 401 ACCESS_TOKEN_EXPIRED for an expired (but otherwise valid) access token', async () => {
    const secret = new TextEncoder().encode(env.JWT_ACCESS_SECRET);
    const expiredToken = await new SignJWT({ sub: '507f1f77bcf86cd799439011' })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime('-10s')
      .sign(secret);

    const res = await request(app)
      .get('/api/v1/auth/me')
      .set('Cookie', [`access_token=${expiredToken}`]);

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('ACCESS_TOKEN_EXPIRED');
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

  it('pads the no-account response up to the same floor as the real one, closing the timing side-channel', async () => {
    // Without auth.service.ts's withMinimumDuration() wrapper, the
    // no-account path returns immediately (no DB write, no email-provider
    // call) while the real-account path pays for both — an attacker could
    // tell the two apart by response time alone even though the body is
    // identical. PASSWORD_RESET_MIN_RESPONSE_MS is 500ms; this only checks
    // the fast path actually gets padded up to it, not an exact match
    // against the real path (which varies with DB/network latency).
    const startedAt = Date.now();
    const res = await post('/api/v1/auth/forgot-password').send({ email: 'nobody@example.com' });
    const elapsedMs = Date.now() - startedAt;

    expect(res.status).toBe(200);
    expect(elapsedMs).toBeGreaterThanOrEqual(450);
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
