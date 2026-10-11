import type { Request, Response } from 'express';

import { AppError } from '#core/errors/index.js';
import type { PaginationQuery } from '#core/http/pagination.js';
import { sendList, sendSuccess } from '#core/http/response.js';

import { createWedding, getWedding, listMyWeddings, updateWedding } from './weddings.service.js';
import type {
  CreateWeddingBody,
  UpdateWeddingBody,
  WeddingIdParams,
} from './weddings.validation.js';

export async function postCreateWedding(req: Request, res: Response): Promise<void> {
  // Set by middleware/authenticate.ts — this route only mounts behind it.
  if (!req.userId) {
    throw AppError.unauthorized();
  }

  const body = req.validated?.body as CreateWeddingBody;
  const wedding = await createWedding(req.userId, body);
  sendSuccess(res, { wedding }, 201);
}

export async function getMyWeddings(req: Request, res: Response): Promise<void> {
  if (!req.userId) {
    throw AppError.unauthorized();
  }

  const query = req.validated?.query as PaginationQuery;
  const { items, pagination } = await listMyWeddings(req.userId, query);
  sendList(res, items, pagination);
}

export async function getWeddingById(req: Request, res: Response): Promise<void> {
  const { weddingId } = req.validated?.params as WeddingIdParams;
  const wedding = await getWedding(weddingId);
  sendSuccess(res, { wedding });
}

export async function patchWedding(req: Request, res: Response): Promise<void> {
  const { weddingId } = req.validated?.params as WeddingIdParams;
  const body = req.validated?.body as UpdateWeddingBody;
  const wedding = await updateWedding(weddingId, body);
  sendSuccess(res, { wedding });
}
