/**
 * app.ts's express.json()/express.urlencoded() run ahead of every route —
 * including validate(), which never gets a chance to run on a body that
 * didn't even parse. Without core/errors/error-mappers.ts's handling of
 * body-parser's errors, both of these came back as a generic 500 (and got
 * logged as a server bug) instead of the 400/413 they actually are.
 */
import request from 'supertest';
import { describe, expect, it } from 'vitest';

import { createApp } from '../../src/app.js';

const app = createApp();

const ALLOWED_ORIGIN = 'http://localhost:3000';

describe('malformed/oversized request bodies', () => {
  it('rejects malformed JSON with 400, not 500', async () => {
    const res = await request(app)
      .post('/api/v1/auth/register')
      .set('Origin', ALLOWED_ORIGIN)
      .set('Content-Type', 'application/json')
      .send('{"name": "Broken", "email": ');

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('MALFORMED_REQUEST');
  });

  it('rejects a body over the configured size limit with 413, not 500', async () => {
    // config/constants.ts's JSON_BODY_LIMIT is 100kb.
    const res = await request(app)
      .post('/api/v1/auth/register')
      .set('Origin', ALLOWED_ORIGIN)
      .send({
        name: 'A'.repeat(200_000),
        email: 'oversized@example.com',
        password: 'correct-horse-battery',
      });

    expect(res.status).toBe(413);
    expect(res.body.error.code).toBe('PAYLOAD_TOO_LARGE');
  });

  it('rejects an unsupported Content-Encoding with its real status, not 500', async () => {
    // Deliberately a body-parser error *type* neither of the two tests above
    // covers (encoding.unsupported, not entity.parse.failed/entity.too.large)
    // — proves error-mappers.ts's isHttpError() check is genuinely generic
    // (keyed on http-errors' own status/expose fields), not just two
    // hand-picked `type` strings that would leave a case like this at 500.
    const res = await request(app)
      .post('/api/v1/auth/register')
      .set('Origin', ALLOWED_ORIGIN)
      .set('Content-Type', 'application/json')
      .set('Content-Encoding', 'bogus-encoding')
      .send('{}');

    expect(res.status).toBe(415);
    expect(res.body.error.code).toBe('MALFORMED_REQUEST');
  });
});
