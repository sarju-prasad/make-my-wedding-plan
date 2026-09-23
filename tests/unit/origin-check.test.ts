import { describe, expect, it, vi } from 'vitest';

import { originCheck } from '../../src/middleware/origin-check.js';

// tests/setup/global-setup.ts sets CORS_ALLOWED_ORIGINS=http://localhost:3000
// before this module (and therefore origin-check.ts's module-level allowlist)
// is ever imported.
const ALLOWED_ORIGIN = 'http://localhost:3000';

function mockReq(method: string, headers: Record<string, string> = {}) {
  return { method, headers } as Parameters<typeof originCheck>[0];
}

function mockRes() {
  return {} as Parameters<typeof originCheck>[1];
}

describe('originCheck', () => {
  it.each(['GET', 'HEAD', 'OPTIONS'])(
    'always calls next() with no error for safe method %s',
    (method) => {
      const next = vi.fn();
      originCheck(mockReq(method), mockRes(), next);
      expect(next).toHaveBeenCalledWith();
    },
  );

  it('calls next() with no error when Origin matches the allowlist', () => {
    const next = vi.fn();
    originCheck(mockReq('POST', { origin: ALLOWED_ORIGIN }), mockRes(), next);
    expect(next).toHaveBeenCalledWith();
  });

  it('calls next(AppError) when Origin does not match the allowlist', () => {
    const next = vi.fn();
    originCheck(mockReq('POST', { origin: 'https://evil.example.com' }), mockRes(), next);

    expect(next).toHaveBeenCalledTimes(1);
    const error = next.mock.calls[0]?.[0] as { httpStatus?: number; code?: string } | undefined;
    expect(error?.httpStatus).toBe(403);
    expect(error?.code).toBe('FORBIDDEN');
  });

  it('falls back to Referer when Origin is absent', () => {
    const next = vi.fn();
    originCheck(mockReq('POST', { referer: `${ALLOWED_ORIGIN}/some/page` }), mockRes(), next);
    expect(next).toHaveBeenCalledWith();
  });

  it('rejects when neither Origin nor Referer is present', () => {
    const next = vi.fn();
    originCheck(mockReq('DELETE'), mockRes(), next);

    const error = next.mock.calls[0]?.[0] as { httpStatus?: number } | undefined;
    expect(error?.httpStatus).toBe(403);
  });

  it('rejects a malformed Referer rather than throwing', () => {
    const next = vi.fn();
    expect(() => {
      originCheck(mockReq('POST', { referer: 'not a url' }), mockRes(), next);
    }).not.toThrow();

    const error = next.mock.calls[0]?.[0] as { httpStatus?: number } | undefined;
    expect(error?.httpStatus).toBe(403);
  });
});
