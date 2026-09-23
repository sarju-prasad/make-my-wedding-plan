import { Error as MongooseError } from 'mongoose';
import { describe, expect, it } from 'vitest';
import { z, ZodError } from 'zod';

import { AppError } from '../../src/core/errors/app-error.js';
import { ErrorCode } from '../../src/core/errors/error-codes.js';
import { mapKnownError, toAppError } from '../../src/core/errors/error-mappers.js';

describe('AppError factories', () => {
  it('validation() produces a 422 with the given details', () => {
    const err = AppError.validation('bad input', { field: 'name' });
    expect(err.code).toBe(ErrorCode.VALIDATION_ERROR);
    expect(err.httpStatus).toBe(422);
    expect(err.isOperational).toBe(true);
    expect(err.details).toEqual({ field: 'name' });
  });

  it('internal() is non-operational', () => {
    const err = AppError.internal('boom');
    expect(err.code).toBe(ErrorCode.INTERNAL_SERVER_ERROR);
    expect(err.httpStatus).toBe(500);
    expect(err.isOperational).toBe(false);
  });

  it('duplicate() produces a 409', () => {
    expect(AppError.duplicate().httpStatus).toBe(409);
  });
});

describe('mapKnownError', () => {
  it('returns the same instance when given an AppError', () => {
    const original = AppError.notFound('gone');
    expect(mapKnownError(original)).toBe(original);
  });

  it('maps a ZodError to a 422 VALIDATION_ERROR with field-level details', () => {
    const schema = z.object({ name: z.string() });
    const result = schema.safeParse({ name: 123 });
    expect(result.success).toBe(false);
    if (result.success) return;

    const mapped = mapKnownError(result.error);
    expect(mapped).not.toBeNull();
    expect(mapped?.code).toBe(ErrorCode.VALIDATION_ERROR);
    expect(mapped?.httpStatus).toBe(422);
    expect(Array.isArray(mapped?.details)).toBe(true);
  });

  it('is a no-op passthrough for a raw ZodError instance too', () => {
    const err = new ZodError([]);
    expect(mapKnownError(err)?.code).toBe(ErrorCode.VALIDATION_ERROR);
  });

  it('maps a Mongoose CastError to a 422', () => {
    const err = new MongooseError.CastError('ObjectId', 'not-an-id', 'weddingId');
    const mapped = mapKnownError(err);
    expect(mapped?.code).toBe(ErrorCode.VALIDATION_ERROR);
    expect(mapped?.httpStatus).toBe(422);
  });

  it('maps a duplicate-key MongoServerError (E11000) to a 409 DUPLICATE_RESOURCE', () => {
    const err = Object.assign(new Error('E11000 duplicate key error'), {
      name: 'MongoServerError',
      code: 11000,
      keyPattern: { weddingId: 1, guestId: 1 },
    });

    const mapped = mapKnownError(err);
    expect(mapped?.code).toBe(ErrorCode.DUPLICATE_RESOURCE);
    expect(mapped?.httpStatus).toBe(409);
    expect(mapped?.details).toEqual({ fields: ['weddingId', 'guestId'] });
  });

  it('maps a MongoServerSelectionError to a 503 SERVICE_UNAVAILABLE', () => {
    const err = Object.assign(new Error('connect ECONNREFUSED'), {
      name: 'MongoServerSelectionError',
    });

    const mapped = mapKnownError(err);
    expect(mapped?.code).toBe(ErrorCode.SERVICE_UNAVAILABLE);
    expect(mapped?.httpStatus).toBe(503);
  });

  it('returns null for an unrecognised error', () => {
    expect(mapKnownError(new Error('plain'))).toBeNull();
    expect(mapKnownError('a string')).toBeNull();
    expect(mapKnownError(undefined)).toBeNull();
  });
});

describe('toAppError', () => {
  it('always returns an AppError, even for a non-Error throw', () => {
    expect(toAppError('oops')).toBeInstanceOf(AppError);
    expect(toAppError(null)).toBeInstanceOf(AppError);
    expect(toAppError(new Error('x'))).toBeInstanceOf(AppError);
  });

  it('falls back to a non-operational internal error for the unrecognised case', () => {
    const mapped = toAppError(new Error('unexpected'));
    expect(mapped.code).toBe(ErrorCode.INTERNAL_SERVER_ERROR);
    expect(mapped.isOperational).toBe(false);
  });
});
