/**
 * Business logic for register/login/refresh/me/forgot-password/reset-password.
 * api_design.docx §5.2–§5.5.
 */
import { env, isProduction } from '#config/env.js';
import { AppError, isDuplicateKeyError } from '#core/errors/index.js';
import { logger } from '#core/logger/logger.js';

import { sendPasswordResetEmail } from './auth.email.js';
import { User, type UserDocument } from './auth.model.js';
import { hashPassword, verifyPassword } from './auth.password.js';
import {
  generatePasswordResetToken,
  hashPasswordResetToken,
  RESET_TOKEN_TTL_MS,
} from './auth.reset-token.js';
import { signAccessToken, signRefreshToken, verifyRefreshToken } from './auth.tokens.js';
import type { LoginBody, RegisterBody } from './auth.validation.js';

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface AuthResult {
  user: UserDocument;
  tokens: AuthTokens;
}

async function issueTokens(user: UserDocument): Promise<AuthTokens> {
  const userId = String(user._id);
  const [accessToken, refreshToken] = await Promise.all([
    signAccessToken(userId),
    signRefreshToken(userId, user.tokenVersion),
  ]);
  return { accessToken, refreshToken };
}

export async function registerUser(body: RegisterBody): Promise<AuthResult> {
  // Run concurrently: independent of each other (the hash doesn't depend on
  // the exists() result), and a fresh registration — the common case for
  // this endpoint, unlike a duplicate-email retry — no longer pays
  // existsQueryTime + hashTime in series, only max(existsQueryTime, hashTime).
  const [existing, passwordHash] = await Promise.all([
    User.exists({ email: body.email }),
    hashPassword(body.password),
  ]);
  if (existing) {
    throw AppError.emailAlreadyExists();
  }

  let user: UserDocument;
  try {
    user = await User.create({
      name: body.name,
      email: body.email,
      passwordHash,
      status: 'ACTIVE',
      tokenVersion: 0,
      lastLoginAt: null,
    });
  } catch (error) {
    // A concurrent registration with the same email can still race past
    // the exists() check above; catch that specific case here (this
    // module knows it's users.email) rather than in the shared
    // error-mappers.ts, which has no way to know which collection raised
    // a given field-name collision.
    if (isDuplicateKeyError(error, 'email')) {
      throw AppError.emailAlreadyExists();
    }
    throw error;
  }

  const tokens = await issueTokens(user);
  return { user, tokens };
}

/** Deliberately generic: every failure path (no such user, wrong password, inactive account) throws the same message — api_design.docx §5.3. */
function invalidCredentials(): never {
  throw AppError.unauthorized('Incorrect email or password.');
}

// Computed once, lazily, and cached: a real Argon2id hash to compare
// against when no user was found, so verifyPassword() always does the same
// slow work either way — see loginUser() below. A fresh per-request dummy
// hash would defeat the point (recomputing it every miss is itself
// extra, variable work); a fixed password hashed once at first use is not
// a secret (nothing depends on it being unguessable) and never changes.
let dummyPasswordHash: Promise<string> | null = null;
function getDummyPasswordHash(): Promise<string> {
  // The `.catch()` clears the cache back to null on rejection, so the next
  // call's `??=` recomputes instead of reusing a permanently-rejected
  // promise — without it, one transient hashing failure (e.g. a
  // native-binding hiccup) would be cached forever, permanently breaking
  // login for every nonexistent-email attempt for the rest of the
  // process's life.
  dummyPasswordHash ??= hashPassword('not-a-real-account-timing-safety-only').catch(
    (error: unknown) => {
      dummyPasswordHash = null;
      throw error;
    },
  );
  return dummyPasswordHash;
}

export async function loginUser(body: LoginBody): Promise<AuthResult> {
  const user = await User.findOne({ email: body.email }).select('+passwordHash');

  // Always run the Argon2id comparison, even when no user was found, so
  // response time can't reveal whether the email is registered — the
  // generic invalid-credentials *message* below (api_design.docx §5.3)
  // already hides this from the response body, but a real password
  // comparison is the slowest step in this function by a wide margin, and
  // skipping it only on the "no such user" path would leak account
  // existence through timing even with an identical error message.
  const passwordMatches = await verifyPassword(
    user?.passwordHash ?? (await getDummyPasswordHash()),
    body.password,
  );

  if (!user || !passwordMatches || user.status !== 'ACTIVE') {
    invalidCredentials();
  }

  user.lastLoginAt = new Date();
  await user.save();

  const tokens = await issueTokens(user);
  return { user, tokens };
}

/** api_design.docx §5.4: validates the refresh JWT, re-checks status and tokenVersion against the DB, issues a new access token only (no refresh-token rotation). */
export async function refreshAccessToken(refreshToken: string): Promise<{ accessToken: string }> {
  const payload = await verifyRefreshToken(refreshToken);

  const user = await User.findById(payload.userId);
  if (user?.status !== 'ACTIVE' || user.tokenVersion !== payload.tokenVersion) {
    throw AppError.unauthorized();
  }

  const accessToken = await signAccessToken(String(user._id));
  return { accessToken };
}

export async function getCurrentUser(userId: string): Promise<UserDocument> {
  const user = await User.findById(userId);
  // The access token was valid, but the account is gone or deactivated since
  // it was issued — treat it as "no longer a valid session", not NOT_FOUND.
  if (user?.status !== 'ACTIVE') {
    throw AppError.unauthorized();
  }
  return user;
}

export interface PublicUserSummary {
  id: string;
  name: string;
  email: string;
}

/**
 * This module's public entry point for other modules that need to resolve a
 * user by email without reaching into auth.model.ts directly — e.g.
 * modules/weddings/members.service.ts, adding a Manager by email
 * (api_design.docx §9: "Validate that the target user exists"). Only ACTIVE
 * users resolve; a SUSPENDED account is treated as not found, same as
 * getCurrentUser() above.
 */
export async function findUserByEmail(email: string): Promise<PublicUserSummary | null> {
  const user = await User.findOne({ email, status: 'ACTIVE' });
  if (!user) return null;
  return { id: String(user._id), name: user.name, email: user.email };
}

export interface RequestPasswordResetResult {
  /**
   * Only ever populated outside production, and only when no email
   * provider is configured — a non-production HTTP response isn't a "log"
   * in the sense api_design.docx §5.5 means ("do not log reset tokens"),
   * but it still must never happen in production, where a real email is
   * the only channel a reset link goes out on.
   */
  devResetUrl?: string;
}

/** api_design.docx §5.5: always a generic outcome — never reveals whether the email exists. */
export async function requestPasswordReset(email: string): Promise<RequestPasswordResetResult> {
  const user = await User.findOne({ email });
  if (!user) {
    return {};
  }

  const rawToken = generatePasswordResetToken();
  user.passwordResetTokenHash = hashPasswordResetToken(rawToken);
  user.passwordResetExpiresAt = new Date(Date.now() + RESET_TOKEN_TTL_MS);
  await user.save();

  const resetUrl = `${env.WEB_BASE_URL}/reset-password?token=${rawToken}`;

  if (env.RESEND_API_KEY) {
    try {
      await sendPasswordResetEmail(user.email, resetUrl);
    } catch (error) {
      // Never let a transient email-provider failure turn into a response
      // distinguishable from the "email doesn't exist" case — that would
      // defeat the entire point of this function always returning a
      // generic outcome (api_design.docx §5.5). Logged so a real outage
      // is still visible operationally, without ever surfacing to the caller.
      logger.error({ err: error }, 'Failed to send password reset email.');
    }
    return {};
  }

  return isProduction ? {} : { devResetUrl: resetUrl };
}

/**
 * api_design.docx §5.5: single-use, short-lived; increments tokenVersion to
 * invalidate every outstanding session.
 *
 * "Single-use" is enforced atomically: the token is validated and consumed
 * (cleared) in the same `findOneAndUpdate`, not a `findOne` followed by a
 * separate `save()`. The earlier find-then-save version let two concurrent
 * requests carrying the same token both find the user, both pass the
 * expiry check, and both save — empirically confirmed (firing two
 * requests with the same token via Promise.all both returned success)
 * before this was atomic. `$unset` rather than setting `null` also keeps
 * the field genuinely absent afterward, matching the sparse index on
 * `passwordResetTokenHash` (see auth.model.ts).
 */
export async function resetPassword(rawToken: string, newPassword: string): Promise<void> {
  const tokenHash = hashPasswordResetToken(rawToken);
  const passwordHash = await hashPassword(newPassword);

  const user = await User.findOneAndUpdate(
    { passwordResetTokenHash: tokenHash, passwordResetExpiresAt: { $gt: new Date() } },
    {
      $set: { passwordHash },
      $inc: { tokenVersion: 1 },
      $unset: { passwordResetTokenHash: 1, passwordResetExpiresAt: 1 },
    },
  );

  if (!user) {
    throw AppError.unauthorized('This password reset link is invalid or has expired.');
  }
}
