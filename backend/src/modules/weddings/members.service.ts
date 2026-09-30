/**
 * api_design.docx §9: invite/add, list, update role, remove wedding members.
 * This is the first real call site for middleware/authorize.ts — every
 * mutating operation here is ADMIN-only (PRD §8: "The Admin can invite
 * Managers"; api_design.docx §9: "Only ADMIN can change roles or remove
 * members" — extended here to also cover adding, consistent with the PRD).
 */
import { Types } from 'mongoose';

import { AppError, ErrorCode, isDuplicateKeyError } from '#core/errors/index.js';
import { buildPagination, toSkip, type PaginationQuery } from '#core/http/pagination.js';

import { findUserByEmail } from '../auth/auth.service.js';

import { WeddingMember, type MemberRole } from './members.model.js';
import type { AddMemberBody } from './members.validation.js';

export interface MemberSummary {
  id: string;
  userId: string;
  name: string;
  email: string;
  role: MemberRole;
  createdAt: Date;
  updatedAt: Date;
}

interface PopulatedUser {
  _id: Types.ObjectId;
  name: string;
  email: string;
}

function toSummary(member: {
  _id: Types.ObjectId;
  userId: PopulatedUser;
  role: MemberRole;
  createdAt: Date;
  updatedAt: Date;
}): MemberSummary {
  return {
    id: String(member._id),
    userId: String(member.userId._id),
    name: member.userId.name,
    email: member.userId.email,
    role: member.role,
    createdAt: member.createdAt,
    updatedAt: member.updatedAt,
  };
}

/**
 * At least one other ACTIVE ADMIN must remain after the operation on
 * `excludingMemberId` — covers both removal and demotion-to-MANAGER, since
 * either would otherwise leave a wedding with zero active Admins.
 *
 * Not transactionally guarded against two concurrent requests each
 * individually passing this check (e.g. exactly two Admins, each demoting
 * the other at the same instant) — accepted as an exceedingly unlikely race,
 * same category of residual-race reasoning as weddings.service.ts's slug
 * reservation, rather than adding transactional locking for it.
 */
async function assertWouldNotRemoveLastAdmin(
  weddingId: string,
  excludingMemberId: string,
): Promise<void> {
  const remainingActiveAdmins = await WeddingMember.countDocuments({
    weddingId,
    role: 'ADMIN',
    status: 'ACTIVE',
    _id: { $ne: excludingMemberId },
  });
  if (remainingActiveAdmins === 0) {
    throw AppError.conflict(
      'This wedding must always have at least one active Admin.',
      ErrorCode.CANNOT_REMOVE_LAST_ADMIN,
    );
  }
}

export async function listMembers(
  weddingId: string,
  query: PaginationQuery,
): Promise<{ items: MemberSummary[]; pagination: ReturnType<typeof buildPagination> }> {
  const skip = toSkip(query);

  // Independent reads (neither depends on the other's result) — run
  // concurrently rather than paying two sequential round trips.
  const [totalItems, members] = await Promise.all([
    WeddingMember.countDocuments({ weddingId, status: 'ACTIVE' }),
    WeddingMember.find({ weddingId, status: 'ACTIVE' })
      .sort({ createdAt: 1 })
      .skip(skip)
      .limit(query.limit)
      .populate<{ userId: PopulatedUser }>('userId', 'name email'),
  ]);

  return {
    items: members.map((m) => toSummary(m)),
    pagination: buildPagination(query, totalItems),
  };
}

export async function addMember(
  weddingId: string,
  requestedByUserId: string,
  body: AddMemberBody,
): Promise<MemberSummary> {
  const target = await findUserByEmail(body.email);
  if (!target) {
    // findUserByEmail() also returns null for an existing-but-SUSPENDED
    // account (same treatment as auth.service.ts#getCurrentUser) — the
    // message stays deliberately generic rather than claiming "they need to
    // sign up", which would be actively wrong for that case.
    throw AppError.notFound('No active account found with this email.', ErrorCode.USER_NOT_FOUND);
  }

  // {weddingId, userId} is uniquely indexed regardless of `status`, so a
  // previously REMOVED member can't just be re-inserted — it has to be
  // reactivated in place instead.
  const existing = await WeddingMember.findOne({ weddingId, userId: target.id });
  if (existing?.status === 'ACTIVE') {
    throw AppError.duplicate('This person is already a member of this wedding.');
  }

  let member: { _id: Types.ObjectId; role: MemberRole; createdAt: Date; updatedAt: Date };
  try {
    if (existing) {
      existing.role = body.role;
      existing.status = 'ACTIVE';
      existing.createdBy = new Types.ObjectId(requestedByUserId);
      member = await existing.save();
    } else {
      member = await WeddingMember.create({
        weddingId: new Types.ObjectId(weddingId),
        userId: new Types.ObjectId(target.id),
        role: body.role,
        status: 'ACTIVE',
        createdBy: new Types.ObjectId(requestedByUserId),
      });
    }
  } catch (error) {
    // A concurrent add racing past the check above — this module knows the
    // collision is the compound {weddingId, userId} unique index (not two
    // independent single-field indexes), so it's this specific duplicate
    // membership, not any other unique-index violation.
    if (isDuplicateKeyError(error, ['weddingId', 'userId'])) {
      throw AppError.duplicate('This person is already a member of this wedding.');
    }
    throw error;
  }

  return {
    id: String(member._id),
    userId: target.id,
    name: target.name,
    email: target.email,
    role: member.role,
    createdAt: member.createdAt,
    updatedAt: member.updatedAt,
  };
}

export async function updateMemberRole(
  weddingId: string,
  memberId: string,
  newRole: MemberRole,
): Promise<MemberSummary> {
  const member = await WeddingMember.findOne({
    _id: memberId,
    weddingId,
    status: 'ACTIVE',
  }).populate<{ userId: PopulatedUser }>('userId', 'name email');
  if (!member) {
    throw AppError.notFound('Member not found.', ErrorCode.MEMBER_NOT_FOUND);
  }

  if (member.role === 'ADMIN' && newRole !== 'ADMIN') {
    await assertWouldNotRemoveLastAdmin(weddingId, memberId);
  }

  member.role = newRole;
  await member.save();
  return toSummary(member);
}

export async function removeMember(weddingId: string, memberId: string): Promise<void> {
  const member = await WeddingMember.findOne({ _id: memberId, weddingId, status: 'ACTIVE' });
  if (!member) {
    throw AppError.notFound('Member not found.', ErrorCode.MEMBER_NOT_FOUND);
  }

  if (member.role === 'ADMIN') {
    await assertWouldNotRemoveLastAdmin(weddingId, memberId);
  }

  member.status = 'REMOVED';
  await member.save();
}
