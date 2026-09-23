import { describe, expect, it } from 'vitest';

import { buildPagination, paginationQuerySchema, toSkip } from '../../src/core/http/pagination.js';

describe('paginationQuerySchema', () => {
  it('defaults page to 1 and limit to 20', () => {
    const result = paginationQuerySchema.parse({});
    expect(result).toEqual({ page: 1, limit: 20 });
  });

  it('coerces string query values to numbers', () => {
    const result = paginationQuerySchema.parse({ page: '3', limit: '50' });
    expect(result).toEqual({ page: 3, limit: 50 });
  });

  it('rejects a limit above MAX_PAGE_LIMIT', () => {
    expect(() => paginationQuerySchema.parse({ limit: '9999' })).toThrow();
  });

  it('rejects page 0 and negative pages', () => {
    expect(() => paginationQuerySchema.parse({ page: '0' })).toThrow();
    expect(() => paginationQuerySchema.parse({ page: '-1' })).toThrow();
  });
});

describe('toSkip', () => {
  it('computes the correct offset', () => {
    expect(toSkip({ page: 1, limit: 20 })).toBe(0);
    expect(toSkip({ page: 2, limit: 20 })).toBe(20);
    expect(toSkip({ page: 3, limit: 10 })).toBe(20);
  });
});

describe('buildPagination', () => {
  it('computes totalPages, rounding up', () => {
    expect(buildPagination({ page: 1, limit: 20 }, 45)).toEqual({
      page: 1,
      limit: 20,
      totalItems: 45,
      totalPages: 3,
    });
  });

  it('reports at least 1 page even when there are zero items', () => {
    expect(buildPagination({ page: 1, limit: 20 }, 0).totalPages).toBe(1);
  });
});
