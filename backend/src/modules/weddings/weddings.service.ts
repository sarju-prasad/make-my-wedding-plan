/**
 * db_design.docx §9, api_design.docx §22: creating a wedding and its first
 * membership record must succeed or fail together, hence the transaction.
 */
import mongoose, { Types } from 'mongoose';

import { AppError, ErrorCode } from '#core/errors/index.js';
import { buildPagination, toSkip, type PaginationQuery } from '#core/http/pagination.js';
import { buildWeddingSlugBase } from '#utils/slug.js';

import { WeddingMember, type MemberRole } from './members.model.js';
import { Wedding, type WeddingDocument } from './weddings.model.js';
import type { CreateWeddingBody } from './weddings.validation.js';

const MAX_SLUG_SUFFIX_ATTEMPTS = 20;

/**
 * Picks a unique slug before the transaction starts: a duplicate-key error
 * from an in-transaction insert aborts the whole transaction, so collision
 * resolution can't happen by retrying inside it. The residual race (two
 * concurrent requests both settling on the same candidate) is accepted as
 * exceedingly unlikely and, if it happens, surfaces as an ordinary
 * DUPLICATE_RESOURCE from the unique index via error-mappers.ts — not
 * corrupted data.
 *
 * All candidates are checked in one batched query rather than up to
 * MAX_SLUG_SUFFIX_ATTEMPTS sequential round trips.
 */
async function reserveUniqueSlug(base: string): Promise<string> {
  const candidates = Array.from({ length: MAX_SLUG_SUFFIX_ATTEMPTS }, (_, i) =>
    i === 0 ? base : `${base}-${i + 1}`,
  );

  const taken = new Set(
    (await Wedding.find({ slug: { $in: candidates } }, { slug: 1 })).map((w) => w.slug),
  );
  const free = candidates.find((candidate) => !taken.has(candidate));
  if (free) return free;

  // Every candidate collided — needs MAX_SLUG_SUFFIX_ATTEMPTS real prior
  // weddings sharing this exact base. Not re-checked against the DB the
  // way every candidate above was: the unique index on `slug`
  // (weddings.model.ts) is the actual backstop here, same residual-race
  // reasoning as above, rather than adding another round trip for a case
  // this unreachable in practice.
  return `${base}-${Math.random().toString(36).slice(2, 10)}`;
}

export async function createWedding(
  userId: string,
  body: CreateWeddingBody,
): Promise<WeddingDocument> {
  const slug = await reserveUniqueSlug(
    buildWeddingSlugBase(body.couple.partnerOneName, body.couple.partnerTwoName),
  );

  const session = await mongoose.startSession();
  try {
    let wedding: WeddingDocument | undefined;

    // session.withTransaction() over manual start/commit/abort: it retries
    // automatically on TransientTransactionError/UnknownTransactionCommitResult,
    // which the hand-rolled version didn't get. `wedding` narrows correctly
    // to WeddingDocument at the `if (!wedding)` check below, after the
    // callback resolves — verified directly (a minimal repro of this exact
    // pattern typechecks clean under --strict) rather than assumed; an
    // earlier version of this function avoided withTransaction() based on a
    // mistaken belief that this narrowing didn't hold.
    await session.withTransaction(async () => {
      const [created] = await Wedding.create(
        [
          {
            name: body.name,
            slug,
            couple: body.couple,
            weddingDate: body.weddingDate,
            timezone: body.timezone,
            location: body.location,
            language: body.language ?? 'en',
            status: 'ACTIVE',
            createdBy: new Types.ObjectId(userId),
          },
        ],
        { session },
      );

      // Mongoose's Model.create(docs[]) types its return as an array
      // without statically tying its length to the input — this can only
      // be empty if the insert didn't throw but also didn't insert, which
      // shouldn't happen; guard rather than assert past it.
      if (!created) {
        throw AppError.internal('Wedding creation did not return a document.');
      }
      wedding = created;

      await WeddingMember.create(
        [
          {
            weddingId: wedding._id,
            userId: new Types.ObjectId(userId),
            role: 'ADMIN',
            status: 'ACTIVE',
            createdBy: new Types.ObjectId(userId),
          },
        ],
        { session },
      );
    });

    if (!wedding) {
      throw AppError.internal('Wedding creation did not return a document.');
    }
    return wedding;
  } finally {
    await session.endSession();
  }
}

export async function listMyWeddings(
  userId: string,
  query: PaginationQuery,
): Promise<{ items: WeddingDocument[]; pagination: ReturnType<typeof buildPagination> }> {
  // Fetched unpaginated and paginated in memory below, deliberately: doing
  // it at the DB level would need to combine "exclude archived" (a Wedding
  // field) with "keep membership order" (Mongo's $in does not preserve
  // array order) across two collections, and a naive split — paginate
  // memberships, then filter archived out of that page — makes
  // totalItems/totalPages count archived weddings that items then silently
  // drops, so a client paginating by totalPages can land on a page with
  // fewer items than expected. A user's own wedding count is realistically
  // small (not the thousands-of-rows case pagination exists for), so
  // trading a paginated membership query for one unpaginated one is
  // deliberate, not an oversight.
  const memberships = await WeddingMember.find({ userId, status: 'ACTIVE' })
    .select('weddingId')
    .sort({ createdAt: -1 });
  const weddingIds = memberships.map((m) => m.weddingId);

  const weddings = await Wedding.find({ _id: { $in: weddingIds } }).excludeArchived();
  // Re-order to match the membership sort — Mongo's $in does not preserve order.
  const byId = new Map(weddings.map((w) => [String(w._id), w]));
  const ordered = weddingIds.map((id) => byId.get(String(id))).filter((w) => w !== undefined);

  const skip = toSkip(query);
  const items = ordered.slice(skip, skip + query.limit);

  return { items, pagination: buildPagination(query, ordered.length) };
}

export interface ActiveMembership {
  weddingId: string;
  role: MemberRole;
}

/**
 * This module's public entry point for resolving wedding membership — see
 * middleware/load-membership.ts, which calls this instead of importing
 * members.model.ts directly (backend/CLAUDE.md: "Modules talk through
 * their public entry point... deep imports into another module's
 * internals... should stay blocked").
 */
export async function findActiveMembership(
  userId: string,
  weddingId: string,
): Promise<ActiveMembership | null> {
  const member = await WeddingMember.findOne({ weddingId, userId, status: 'ACTIVE' });
  if (!member) return null;
  return { weddingId: String(member.weddingId), role: member.role };
}

/** Membership access was already verified by middleware/load-membership.ts. */
export async function getWedding(weddingId: string): Promise<WeddingDocument> {
  const wedding = await Wedding.findById(weddingId).excludeArchived();
  if (!wedding) {
    throw AppError.notFound('Wedding not found.', ErrorCode.WEDDING_NOT_FOUND);
  }
  return wedding;
}
