import type { Request, Response } from 'express';

import { AppError } from '#core/errors/index.js';
import type { PaginationQuery } from '#core/http/pagination.js';
import { sendList, sendNoContent, sendSuccess } from '#core/http/response.js';

import {
  acceptInvitation,
  createInvitation,
  listInvitations,
  previewInvitation,
  resendInvitation,
  revokeInvitation,
} from './invitations.service.js';
import type {
  CreateInvitationBody,
  InvitationIdParams,
  InvitationTokenBody,
} from './invitations.validation.js';
import type { WeddingIdParams } from './weddings.validation.js';

export async function postInvitation(req: Request, res: Response): Promise<void> {
  if (!req.userId) {
    throw AppError.unauthorized();
  }
  const { weddingId } = req.validated?.params as WeddingIdParams;
  const body = req.validated?.body as CreateInvitationBody;
  const result = await createInvitation(weddingId, req.userId, body);
  sendSuccess(res, result, 201);
}

export async function getInvitations(req: Request, res: Response): Promise<void> {
  const { weddingId } = req.validated?.params as WeddingIdParams;
  const query = req.validated?.query as PaginationQuery;
  const { items, pagination } = await listInvitations(weddingId, query);
  sendList(res, items, pagination);
}

export async function deleteInvitation(req: Request, res: Response): Promise<void> {
  const { weddingId, invitationId } = req.validated?.params as InvitationIdParams;
  await revokeInvitation(weddingId, invitationId);
  sendNoContent(res);
}

export async function postResendInvitation(req: Request, res: Response): Promise<void> {
  const { weddingId, invitationId } = req.validated?.params as InvitationIdParams;
  const result = await resendInvitation(weddingId, invitationId);
  sendSuccess(res, result);
}

export async function postInvitationPreview(req: Request, res: Response): Promise<void> {
  const { token } = req.validated?.body as InvitationTokenBody;
  const invitation = await previewInvitation(token);
  sendSuccess(res, { invitation });
}

export async function postAcceptInvitation(req: Request, res: Response): Promise<void> {
  if (!req.userId) {
    throw AppError.unauthorized();
  }
  const { token } = req.validated?.body as InvitationTokenBody;
  const result = await acceptInvitation(token, req.userId);
  sendSuccess(res, result);
}
