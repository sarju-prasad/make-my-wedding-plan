/**
 * Page-number pagination — api_design.docx §17.
 *
 * Defaults: page 1, limit 20, ceiling 100. Sort fields must be validated
 * against a per-resource allowlist by the caller; this module has no
 * knowledge of any resource's sortable fields.
 */
import { z } from 'zod';

import { env } from '#config/env.js';

export interface Pagination {
  page: number;
  limit: number;
  totalItems: number;
  totalPages: number;
}

export const paginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(env.MAX_PAGE_LIMIT).default(20),
});

export type PaginationQuery = z.infer<typeof paginationQuerySchema>;

/** Builds a `sort` query validator restricted to an allowlist of field names. */
export function sortQuerySchema(allowedFields: readonly string[]) {
  const pattern = new RegExp(`^(${allowedFields.join('|')}):(asc|desc)$`);
  return z
    .string()
    .regex(pattern, `sort must be one of: ${allowedFields.map((f) => `${f}:asc|desc`).join(', ')}`)
    .optional();
}

export function toSkip(query: PaginationQuery): number {
  return (query.page - 1) * query.limit;
}

export function buildPagination(query: PaginationQuery, totalItems: number): Pagination {
  return {
    page: query.page,
    limit: query.limit,
    totalItems,
    totalPages: Math.max(1, Math.ceil(totalItems / query.limit)),
  };
}
