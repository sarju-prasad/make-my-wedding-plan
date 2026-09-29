/**
 * users — db_design.docx §5: registered Admin and Manager accounts.
 * Indexes per db_design.docx §6: `email` unique; `status`.
 *
 * `passwordResetTokenHash`/`passwordResetExpiresAt` are an addition beyond
 * db_design.docx's field list — api_design.docx §5.5 fully specifies
 * forgot/reset-password behavior ("short-lived, single-use reset token...
 * store only a hash of the reset token if persisted") but db_design.docx's
 * schema has nowhere to put it. Same category of gap as `weddings.slug`
 * (G5): a real behavior the docs describe but didn't wire a field for.
 */
import mongoose, { Schema, type HydratedDocument, type Model } from 'mongoose';

import { toJsonPlugin } from '#db/plugins/to-json.js';

export const USER_STATUS = ['ACTIVE', 'SUSPENDED'] as const;
export type UserStatus = (typeof USER_STATUS)[number];

export interface UserAttrs {
  name: string;
  email: string;
  /** Argon2id hash — never selected by default; see the schema's `select: false` below. */
  passwordHash: string;
  status: UserStatus;
  /** Bumped on password reset / security events to invalidate outstanding refresh tokens. */
  tokenVersion: number;
  lastLoginAt: Date | null;
  /** SHA-256 hash of the raw reset token (auth.reset-token.ts) — never the raw token itself. */
  passwordResetTokenHash: string | null;
  passwordResetExpiresAt: Date | null;
}

export type UserDocument = HydratedDocument<UserAttrs>;

const userSchema = new Schema<UserAttrs>(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, trim: true, lowercase: true },
    // `select: false` — a plain `User.findById()` never pulls the hash back
    // across the wire; auth.service.ts opts in explicitly with `.select('+passwordHash')`
    // for the one place (login) that actually needs it.
    passwordHash: { type: String, required: true, select: false },
    status: { type: String, enum: USER_STATUS, default: 'ACTIVE', required: true },
    tokenVersion: { type: Number, default: 0, required: true },
    lastLoginAt: { type: Date, default: null },
    // No `default: null` here (unlike lastLoginAt above): a sparse index only
    // excludes documents where the field is genuinely *absent*, not ones
    // where it's explicitly set to `null` — a schema default would give
    // every single user an explicit `null`, defeating the sparse index
    // below entirely. Left unset, only users who've actually gone through
    // a request-reset/complete-reset cycle ever have this key at all.
    passwordResetTokenHash: { type: String, select: false },
    passwordResetExpiresAt: { type: Date, select: false },
  },
  { timestamps: true },
);

userSchema.index({ email: 1 }, { unique: true });
userSchema.index({ status: 1 });
// Sparse: most users never have a pending reset, and `null` shouldn't be
// indexed as a collision-prone shared value.
userSchema.index({ passwordResetTokenHash: 1 }, { sparse: true });

// `hide` is defense in depth on top of `select: false` above for
// passwordHash/passwordResetTokenHash/passwordResetExpiresAt — belt and
// braces for fields that must never reach a response body. `tokenVersion`
// is hidden too: it's an internal revocation counter (auth.tokens.ts), not
// something a client has any use for.
userSchema.plugin(toJsonPlugin, {
  hide: ['passwordHash', 'tokenVersion', 'passwordResetTokenHash', 'passwordResetExpiresAt'],
});

// Guarded registration: tsx watch's hot reload re-evaluates this module on
// every save while the underlying mongoose instance persists, which throws
// `OverwriteModelError` on a second bare `mongoose.model()` call — the same
// hot-reload hazard db/connection.ts documents for the connection cache.
export const User: Model<UserAttrs> =
  (mongoose.models.User as Model<UserAttrs> | undefined) ??
  mongoose.model<UserAttrs>('User', userSchema);
