/**
 * wedding_invitations — closes backend/CLAUDE.md's open decision G1: an
 * Admin invites someone by email who may not have an account yet, distinct
 * from members.service.ts's addMember() (which requires an existing
 * account and creates membership immediately — no email, no token, no
 * pending state). A WeddingMember row is only ever created once an
 * invitation here is accepted.
 *
 * `status` is PENDING until acted on — ACCEPTED/REVOKED are terminal. There
 * is no separate stored "EXPIRED" status: a PENDING invitation past
 * `expiresAt` is derived at the point of use (invitations.service.ts), the
 * same way auth's password-reset token checks `expiresAt` directly rather
 * than via a background job that flips a status field.
 *
 * `tokenHash` follows auth.reset-token.ts's exact reasoning (SHA-256 is
 * correct here — the raw token is already 256 bits of crypto.randomBytes,
 * not a low-entropy secret to defend against guessing) and is
 * `select: false` plus hidden from JSON output (toJsonPlugin's `hide`) —
 * belt and suspenders, since it's also simply never read back out by any
 * code path (invitations.service.ts always re-derives a hash from a raw
 * token to query by, never reads this field's value).
 *
 * The partial unique index on {weddingId, email} (status: PENDING only) is
 * what actually prevents two simultaneous pending invitations to the same
 * email for the same wedding — an ACCEPTED or REVOKED one doesn't block a
 * fresh invite being sent later, e.g. after someone's access was revoked.
 */
import mongoose, { Schema, type Model, type Types } from 'mongoose';

import { toJsonPlugin } from '#db/plugins/to-json.js';

import { MEMBER_ROLE, type MemberRole } from './members.model.js';

export const INVITATION_STATUS = ['PENDING', 'ACCEPTED', 'REVOKED'] as const;
export type InvitationStatus = (typeof INVITATION_STATUS)[number];

export interface WeddingInvitationFields {
  weddingId: Types.ObjectId;
  email: string;
  role: MemberRole;
  tokenHash: string;
  status: InvitationStatus;
  expiresAt: Date;
  invitedBy: Types.ObjectId;
  acceptedBy?: Types.ObjectId;
  acceptedAt?: Date;
  revokedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface WeddingInvitationDocument extends mongoose.Document, WeddingInvitationFields {}

export type WeddingInvitationModel = Model<WeddingInvitationDocument>;

const weddingInvitationSchema = new Schema<WeddingInvitationDocument, WeddingInvitationModel>(
  {
    weddingId: { type: 'ObjectId', ref: 'Wedding', required: true },
    email: { type: String, required: true, trim: true, lowercase: true },
    role: { type: String, enum: MEMBER_ROLE, required: true },
    tokenHash: { type: String, required: true, select: false },
    status: { type: String, enum: INVITATION_STATUS, default: 'PENDING', required: true },
    expiresAt: { type: Date, required: true },
    invitedBy: { type: 'ObjectId', ref: 'User', required: true },
    acceptedBy: { type: 'ObjectId', ref: 'User' },
    acceptedAt: { type: Date },
    revokedAt: { type: Date },
  },
  { timestamps: true },
);

weddingInvitationSchema.index(
  { weddingId: 1, email: 1 },
  { unique: true, partialFilterExpression: { status: 'PENDING' } },
);
weddingInvitationSchema.index({ tokenHash: 1 }, { unique: true });
weddingInvitationSchema.index({ weddingId: 1, status: 1 });

weddingInvitationSchema.plugin(toJsonPlugin, { hide: ['tokenHash'] });

// Guarded registration — see modules/auth/auth.model.ts for why.
export const WeddingInvitation: WeddingInvitationModel =
  (mongoose.models.WeddingInvitation as WeddingInvitationModel | undefined) ??
  mongoose.model<WeddingInvitationDocument>('WeddingInvitation', weddingInvitationSchema);
