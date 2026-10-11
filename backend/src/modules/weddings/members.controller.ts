import type { Request, Response } from 'express';

import { AppError } from '#core/errors/index.js';
import type { PaginationQuery } from '#core/http/pagination.js';
import { sendList, sendNoContent, sendSuccess } from '#core/http/response.js';

import { addMember, listMembers, removeMember, updateMemberRole } from './members.service.js';
import type { AddMemberBody, MemberIdParams, UpdateMemberBody } from './members.validation.js';
import type { WeddingIdParams } from './weddings.validation.js';

export async function getMembers(req: Request, res: Response): Promise<void> {
  const { weddingId } = req.validated?.params as WeddingIdParams;
  const query = req.validated?.query as PaginationQuery;
  const { items, pagination } = await listMembers(weddingId, query);
  sendList(res, items, pagination);
}

export async function postMember(req: Request, res: Response): Promise<void> {
  if (!req.userId) {
    throw AppError.unauthorized();
  }
  const { weddingId } = req.validated?.params as WeddingIdParams;
  const body = req.validated?.body as AddMemberBody;
  const member = await addMember(weddingId, req.userId, body);
  sendSuccess(res, { member }, 201);
}

export async function patchMember(req: Request, res: Response): Promise<void> {
  const { weddingId, memberId } = req.validated?.params as MemberIdParams;
  const body = req.validated?.body as UpdateMemberBody;
  const member = await updateMemberRole(weddingId, memberId, body.role);
  sendSuccess(res, { member });
}

export async function deleteMember(req: Request, res: Response): Promise<void> {
  const { weddingId, memberId } = req.validated?.params as MemberIdParams;
  await removeMember(weddingId, memberId);
  sendNoContent(res);
}
