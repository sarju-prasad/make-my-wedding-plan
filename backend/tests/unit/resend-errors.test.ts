import { describe, expect, it } from 'vitest';

import {
  mapResendErrorResponse,
  mapResendException,
} from '../../src/integrations/resend/errors.js';

describe('mapResendErrorResponse', () => {
  it('never includes Resend’s own error message in the client-facing message', () => {
    const error = mapResendErrorResponse(
      {
        message: 'From address domain is not verified: super-internal-detail.example',
        statusCode: 422,
        name: 'validation_error',
      },
      'Wedding invitation email',
    );

    expect(error.message).not.toContain('super-internal-detail');
    expect(error.message).toBe('Wedding invitation email failed.');
  });

  it('preserves the raw Resend error via cause, for logging', () => {
    const resendError = { message: 'raw detail', statusCode: 422, name: 'validation_error' };
    const error = mapResendErrorResponse(resendError, 'Password reset email');

    expect(error.cause).toBe(resendError);
  });

  it('maps a rate-limit error name to RATE_LIMITED with a generic message', () => {
    const error = mapResendErrorResponse(
      { message: 'quota exceeded for account xyz', statusCode: 429, name: 'rate_limit_exceeded' },
      'Wedding invitation email',
    );

    expect(error.code).toBe('RATE_LIMITED');
    expect(error.message).not.toContain('xyz');
  });
});

describe('mapResendException', () => {
  it('reports a generic message and preserves the original exception via cause', () => {
    const original = new Error('ECONNREFUSED');
    const error = mapResendException(original, 'Wedding invitation email');

    expect(error.message).toBe('Wedding invitation email failed unexpectedly.');
    expect(error.cause).toBe(original);
  });
});
