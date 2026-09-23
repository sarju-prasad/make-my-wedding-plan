/**
 * Standard response envelope — api_design.docx §3.1–§3.3.
 *
 * Every controller sends its response through one of these helpers, so the
 * envelope shape can never drift between endpoints.
 */
import type { Response } from 'express';

import type { ErrorCode } from '../errors/error-codes.js';

import type { Pagination } from './pagination.js';

export interface SuccessBody<T> {
  success: true;
  data: T;
}

export interface ListBody<T> {
  success: true;
  data: {
    items: T[];
    pagination: Pagination;
  };
}

export interface ErrorBody {
  success: false;
  error: {
    code: ErrorCode;
    message: string;
    /** Optional and safe-to-expose only — never a stack trace or secret. */
    details?: unknown;
  };
}

/**
 * 200/201 with a single resource (or any non-list payload).
 *
 * `data` is deliberately `unknown` rather than a generic `<T>` — nothing
 * downstream depends on the inferred type (SuccessBody<T> is built and
 * consumed entirely inside this function), so a single-occurrence generic
 * would give callers no more type safety than `unknown` does.
 */
export function sendSuccess(res: Response, data: unknown, httpStatus = 200): Response {
  const body: SuccessBody<unknown> = { success: true, data };
  return res.status(httpStatus).json(body);
}

/** 200 with a paginated collection. */
export function sendList(res: Response, items: unknown[], pagination: Pagination): Response {
  const body: ListBody<unknown> = { success: true, data: { items, pagination } };
  return res.status(200).json(body);
}

/** 204 — no body. */
export function sendNoContent(res: Response): Response {
  return res.status(204).end();
}
