import type { Request, Response } from 'express';

import { AppError } from '#core/errors/index.js';
import type { PaginationQuery } from '#core/http/pagination.js';
import { sendList, sendSuccess } from '#core/http/response.js';

import { createEvent, getEvent, listEvents } from './events.service.js';
import type { CreateEventBody, EventIdParams, WeddingIdParams } from './events.validation.js';

export async function postCreateEvent(req: Request, res: Response): Promise<void> {
  // Set by middleware/authenticate.ts — this route only mounts behind it.
  if (!req.userId) {
    throw AppError.unauthorized();
  }

  const { weddingId } = req.validated?.params as WeddingIdParams;
  const body = req.validated?.body as CreateEventBody;
  const event = await createEvent(weddingId, req.userId, body);
  sendSuccess(res, { event }, 201);
}

export async function getEvents(req: Request, res: Response): Promise<void> {
  const { weddingId } = req.validated?.params as WeddingIdParams;
  const query = req.validated?.query as PaginationQuery;
  const { items, pagination } = await listEvents(weddingId, query);
  sendList(res, items, pagination);
}

export async function getEventById(req: Request, res: Response): Promise<void> {
  const { weddingId, eventId } = req.validated?.params as EventIdParams;
  const event = await getEvent(weddingId, eventId);
  sendSuccess(res, { event });
}
