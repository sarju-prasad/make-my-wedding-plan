/**
 * wedding_members — db_design.docx §5: wedding-specific user membership and
 * roles. This, not `weddings.createdBy` alone, is the actual authorization
 * boundary — api_design.docx §6.1: "All wedding access must be checked
 * through wedding_members... Only ACTIVE members may access active wedding
 * operations."
 *
 * Its own `status` (ACTIVE|REMOVED) already fully captures this collection's
 * lifecycle, and — unlike weddings/events/guests/etc. — it isn't listed in
 * db_design.docx §8's archive/deletion policy table, so the soft-archive
 * plugin is deliberately not applied here.
 *
 * Indexes per db_design.docx §6: `weddingId + userId` unique; `userId +
 * status`; `weddingId + role + status`.
 */
import mongoose, { Schema, type Model, type Types } from 'mongoose';

import { toJsonPlugin } from '#db/plugins/to-json.js';

export const MEMBER_ROLE = ['ADMIN', 'MANAGER'] as const;
export type MemberRole = (typeof MEMBER_ROLE)[number];

export const MEMBER_STATUS = ['ACTIVE', 'REMOVED'] as const;
export type MemberStatus = (typeof MEMBER_STATUS)[number];

export interface WeddingMemberAttrs {
  weddingId: Types.ObjectId;
  userId: Types.ObjectId;
  role: MemberRole;
  status: MemberStatus;
  createdBy: Types.ObjectId;
}

export type WeddingMemberModel = Model<WeddingMemberAttrs>;

const weddingMemberSchema = new Schema<WeddingMemberAttrs>(
  {
    weddingId: { type: 'ObjectId', ref: 'Wedding', required: true },
    userId: { type: 'ObjectId', ref: 'User', required: true },
    role: { type: String, enum: MEMBER_ROLE, required: true },
    status: { type: String, enum: MEMBER_STATUS, default: 'ACTIVE', required: true },
    createdBy: { type: 'ObjectId', ref: 'User', required: true },
  },
  { timestamps: true },
);

weddingMemberSchema.index({ weddingId: 1, userId: 1 }, { unique: true });
weddingMemberSchema.index({ userId: 1, status: 1 });
weddingMemberSchema.index({ weddingId: 1, role: 1, status: 1 });

weddingMemberSchema.plugin(toJsonPlugin);

// Guarded registration — see modules/auth/auth.model.ts for why.
export const WeddingMember: WeddingMemberModel =
  (mongoose.models.WeddingMember as WeddingMemberModel | undefined) ??
  mongoose.model<WeddingMemberAttrs>('WeddingMember', weddingMemberSchema);
