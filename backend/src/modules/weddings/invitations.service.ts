/**
 * Closes backend/CLAUDE.md's open decision G1: inviting someone by email who
 * may not have an account yet. Distinct from members.service.ts's
 * addMember(), which requires an existing account and adds them
 * immediately — this sends an email with a single-use token and only
 * creates a WeddingMember once acceptInvitation() runs. Both coexist:
 * addMember() is unchanged and still works for adding an already-registered
 * user directly.
 */
import mongoose, { Types } from 'mongoose';

import { env, isProduction } from '#config/env.js';
import { AppError, ErrorCode, isDuplicateKeyError } from '#core/errors/index.js';
import { buildPagination, toSkip, type PaginationQuery } from '#core/http/pagination.js';
import { logger } from '#core/logger/logger.js';

import { findUserByEmail, findUserById, getCurrentUser } from '../auth/auth.service.js';

import { sendInvitationEmail } from './invitations.email.js';
import {
  WeddingInvitation,
  type InvitationStatus,
  type WeddingInvitationDocument,
} from './invitations.model.js';
import {
  generateInvitationToken,
  hashInvitationToken,
  INVITATION_TOKEN_TTL_MS,
} from './invitations.token.js';
import type { CreateInvitationBody } from './invitations.validation.js';
import { WeddingMember, type MemberRole } from './members.model.js';
import { Wedding, type WeddingCouple, type WeddingDocument } from './weddings.model.js';

export interface InvitationSummary {
  id: string;
  email: string;
  role: MemberRole;
  status: InvitationStatus;
  isExpired: boolean;
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface InvitationPreview {
  email: string;
  role: MemberRole;
  status: InvitationStatus;
  isExpired: boolean;
  weddingId: string;
  weddingName: string;
  couple: WeddingCouple;
  invitedByName: string;
}

export interface DeliverInvitationResult {
  emailSent: boolean;
  /** Only ever populated outside production, when no email provider is configured — same reasoning as auth.service.ts's RequestPasswordResetResult. */
  devInviteUrl?: string;
}

function isExpired(invitation: Pick<WeddingInvitationDocument, 'status' | 'expiresAt'>): boolean {
  return invitation.status === 'PENDING' && invitation.expiresAt.getTime() < Date.now();
}

function toInvitationSummary(invitation: WeddingInvitationDocument): InvitationSummary {
  return {
    id: String(invitation._id),
    email: invitation.email,
    role: invitation.role,
    status: invitation.status,
    isExpired: isExpired(invitation),
    expiresAt: invitation.expiresAt,
    createdAt: invitation.createdAt,
    updatedAt: invitation.updatedAt,
  };
}

/**
 * Shared by createInvitation/resendInvitation. Never throws on a send
 * failure — unlike auth.service.ts's requestPasswordReset() (which must
 * mask a provider failure behind the same generic response for
 * anti-enumeration reasons), there's no privacy concern here: the caller is
 * an Admin who already knows this invitation exists, so a real send failure
 * is reported back (`emailSent: false`) rather than hidden, letting the UI
 * tell them to use Resend.
 */
async function deliverInvitationEmail(
  weddingId: Types.ObjectId,
  invitedBy: Types.ObjectId,
  email: string,
  role: MemberRole,
  rawToken: string,
): Promise<DeliverInvitationResult> {
  const inviteUrl = `${env.WEB_BASE_URL}/invitations/${rawToken}`;

  if (!env.RESEND_API_KEY) {
    return { emailSent: false, ...(isProduction ? {} : { devInviteUrl: inviteUrl }) };
  }

  const [wedding, inviter] = await Promise.all([
    Wedding.findById(weddingId).excludeArchived(),
    findUserById(String(invitedBy)),
  ]);

  try {
    await sendInvitationEmail(email, inviteUrl, {
      weddingName: wedding?.name ?? 'their wedding',
      inviterName: inviter?.name ?? 'A wedding Admin',
      role,
    });
    return { emailSent: true };
  } catch (error) {
    logger.error({ err: error }, 'Failed to send wedding invitation email.');
    return { emailSent: false };
  }
}

export async function createInvitation(
  weddingId: string,
  invitedByUserId: string,
  body: CreateInvitationBody,
): Promise<{ invitation: InvitationSummary } & DeliverInvitationResult> {
  // Only checkable when the invitee already has an account — if they don't,
  // they obviously can't already be a member, so there's nothing to block.
  const target = await findUserByEmail(body.email);
  if (target) {
    const existingMembership = await WeddingMember.findOne({ weddingId, userId: target.id });
    if (existingMembership?.status === 'ACTIVE') {
      throw AppError.conflict(
        'This person is already a member of this wedding.',
        ErrorCode.ALREADY_MEMBER,
      );
    }
  }

  const rawToken = generateInvitationToken();
  const weddingObjectId = new Types.ObjectId(weddingId);
  const invitedByObjectId = new Types.ObjectId(invitedByUserId);

  let invitation: WeddingInvitationDocument;
  try {
    invitation = await WeddingInvitation.create({
      weddingId: weddingObjectId,
      email: body.email,
      role: body.role,
      tokenHash: hashInvitationToken(rawToken),
      status: 'PENDING',
      expiresAt: new Date(Date.now() + INVITATION_TOKEN_TTL_MS),
      invitedBy: invitedByObjectId,
    });
  } catch (error) {
    // A concurrent invite racing past the check above, or simply a second
    // invite to an email that already has one PENDING — this module knows
    // the collision is the compound partial {weddingId, email} index.
    if (isDuplicateKeyError(error, ['weddingId', 'email'])) {
      throw AppError.duplicate('An invitation is already pending for this email.');
    }
    throw error;
  }

  const delivery = await deliverInvitationEmail(
    weddingObjectId,
    invitedByObjectId,
    body.email,
    body.role,
    rawToken,
  );

  return { invitation: toInvitationSummary(invitation), ...delivery };
}

export async function listInvitations(
  weddingId: string,
  query: PaginationQuery,
): Promise<{ items: InvitationSummary[]; pagination: ReturnType<typeof buildPagination> }> {
  const skip = toSkip(query);

  const [totalItems, invitations] = await Promise.all([
    WeddingInvitation.countDocuments({ weddingId, status: 'PENDING' }),
    WeddingInvitation.find({ weddingId, status: 'PENDING' })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(query.limit),
  ]);

  return {
    items: invitations.map(toInvitationSummary),
    pagination: buildPagination(query, totalItems),
  };
}

export async function revokeInvitation(weddingId: string, invitationId: string): Promise<void> {
  const invitation = await WeddingInvitation.findOne({
    _id: invitationId,
    weddingId,
    status: 'PENDING',
  });
  if (!invitation) {
    throw AppError.notFound('Invitation not found.', ErrorCode.INVITATION_NOT_FOUND);
  }

  invitation.status = 'REVOKED';
  invitation.revokedAt = new Date();
  await invitation.save();
}

export async function resendInvitation(
  weddingId: string,
  invitationId: string,
): Promise<{ invitation: InvitationSummary } & DeliverInvitationResult> {
  const invitation = await WeddingInvitation.findOne({
    _id: invitationId,
    weddingId,
    status: 'PENDING',
  });
  if (!invitation) {
    throw AppError.notFound('Invitation not found.', ErrorCode.INVITATION_NOT_FOUND);
  }

  const rawToken = generateInvitationToken();
  invitation.tokenHash = hashInvitationToken(rawToken);
  invitation.expiresAt = new Date(Date.now() + INVITATION_TOKEN_TTL_MS);
  await invitation.save();

  const delivery = await deliverInvitationEmail(
    invitation.weddingId,
    invitation.invitedBy,
    invitation.email,
    invitation.role,
    rawToken,
  );

  return { invitation: toInvitationSummary(invitation), ...delivery };
}

/**
 * Public — no auth required. Used to render the Accept Invitation page's
 * context (who invited you, to what, as what role) before the visitor has
 * necessarily signed in, the same way a token alone is enough to land on
 * /reset-password. Never throws for an expired/revoked/already-accepted
 * invitation — those are legitimate states this same page needs to display,
 * not errors; only a token matching no invitation at all is a 404.
 */
export async function previewInvitation(rawToken: string): Promise<InvitationPreview> {
  const invitation = await WeddingInvitation.findOne({
    tokenHash: hashInvitationToken(rawToken),
  });
  if (!invitation) {
    throw AppError.notFound('This invitation link is invalid.', ErrorCode.INVITATION_NOT_FOUND);
  }

  const [wedding, inviter] = await Promise.all([
    Wedding.findById(invitation.weddingId).excludeArchived(),
    findUserById(String(invitation.invitedBy)),
  ]);

  return {
    email: invitation.email,
    role: invitation.role,
    status: invitation.status,
    isExpired: isExpired(invitation),
    weddingId: String(invitation.weddingId),
    weddingName: wedding?.name ?? 'a wedding',
    couple: wedding?.couple ?? { partnerOneName: '', partnerTwoName: '' },
    invitedByName: inviter?.name ?? 'A wedding Admin',
  };
}

/**
 * Requires auth — the caller must already be signed in (or have just signed
 * up) with the exact email the invitation was addressed to.
 *
 * Only a PENDING invitation can ever be accepted. An ACCEPTED one is
 * rejected even if the membership it created was since removed — getting
 * back in after removal always needs a fresh invite, never a replay of the
 * old link (a removed member must not be able to let themselves back in,
 * especially if they were an Admin). Enforced twice: the pre-check below for
 * the common case, and again as the filter on the conditional update inside
 * the transaction, which is what actually closes the race against a
 * concurrent revoke or a second accept from another tab — see the
 * findOneAndUpdate below.
 */
export async function acceptInvitation(
  rawToken: string,
  userId: string,
): Promise<{ wedding: WeddingDocument; role: MemberRole }> {
  const invitation = await WeddingInvitation.findOne({
    tokenHash: hashInvitationToken(rawToken),
  });
  if (!invitation) {
    throw AppError.notFound('This invitation link is invalid.', ErrorCode.INVITATION_NOT_FOUND);
  }

  if (invitation.status === 'REVOKED') {
    throw AppError.conflict('This invitation has been revoked.', ErrorCode.INVITATION_REVOKED);
  }

  if (invitation.status === 'ACCEPTED') {
    throw AppError.conflict(
      'This invitation has already been used.',
      ErrorCode.INVITATION_ALREADY_ACCEPTED,
    );
  }

  if (isExpired(invitation)) {
    throw AppError.conflict('This invitation has expired.', ErrorCode.INVITATION_EXPIRED);
  }

  const user = await getCurrentUser(userId);
  if (user.email !== invitation.email) {
    throw AppError.emailMismatch();
  }

  const wedding = await Wedding.findById(invitation.weddingId).excludeArchived();
  if (!wedding) {
    throw AppError.notFound('Wedding not found.', ErrorCode.WEDDING_NOT_FOUND);
  }

  const existingMembership = await WeddingMember.findOne({
    weddingId: invitation.weddingId,
    userId,
  });
  if (existingMembership?.status === 'ACTIVE') {
    throw AppError.conflict('You are already a member of this wedding.', ErrorCode.ALREADY_MEMBER);
  }

  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      // Atomic, conditional on still being PENDING — the only thing that
      // actually prevents a concurrent revoke (or a second accept racing in
      // from another tab) from sneaking past the pre-checks above and
      // reusing this same invitation.
      const accepted = await WeddingInvitation.findOneAndUpdate(
        { _id: invitation._id, status: 'PENDING' },
        { status: 'ACCEPTED', acceptedBy: new Types.ObjectId(userId), acceptedAt: new Date() },
        { session },
      );
      if (!accepted) {
        const current = await WeddingInvitation.findById(invitation._id, null, { session });
        if (current?.status === 'REVOKED') {
          throw AppError.conflict(
            'This invitation has been revoked.',
            ErrorCode.INVITATION_REVOKED,
          );
        }
        throw AppError.conflict(
          'This invitation has already been used.',
          ErrorCode.INVITATION_ALREADY_ACCEPTED,
        );
      }

      try {
        if (existingMembership) {
          existingMembership.role = invitation.role;
          existingMembership.status = 'ACTIVE';
          existingMembership.createdBy = invitation.invitedBy;
          await existingMembership.save({ session });
        } else {
          await WeddingMember.create(
            [
              {
                weddingId: invitation.weddingId,
                userId: new Types.ObjectId(userId),
                role: invitation.role,
                status: 'ACTIVE',
                createdBy: invitation.invitedBy,
              },
            ],
            { session },
          );
        }
      } catch (error) {
        // A second accept by the same user (two tabs) racing past the
        // ACTIVE-membership check above — same collision members.service.ts's
        // addMember() guards against, just reached from a different route.
        if (isDuplicateKeyError(error, ['weddingId', 'userId'])) {
          throw AppError.conflict(
            'You are already a member of this wedding.',
            ErrorCode.ALREADY_MEMBER,
          );
        }
        throw error;
      }
    });
  } finally {
    await session.endSession();
  }

  return { wedding, role: invitation.role };
}
