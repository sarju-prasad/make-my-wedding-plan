/**
 * api_design.docx §10: create/list/view events, wedding-scoped. Only these
 * three operations exist yet — update/cancel/archive/restore are deferred
 * (see doc/project_status.md).
 *
 * No transaction here (unlike weddings.service.ts's createWedding): a
 * single-document insert with no paired write needs no atomicity beyond
 * what MongoDB already guarantees for one document.
 */
import { Types } from 'mongoose';

import { AppError, ErrorCode } from '#core/errors/index.js';
import { buildPagination, toSkip, type PaginationQuery } from '#core/http/pagination.js';

import { Event, type EventDocument } from './events.model.js';
import type { CreateEventBody } from './events.validation.js';

/**
 * Purely a TypeScript-level fix, not a runtime one: Zod never actually
 * materializes an absent optional key as an explicit `undefined` value at
 * parse time, so `body.venue` never has real `undefined` entries to strip.
 * But its inferred *type* still allows `undefined` for each optional
 * sub-field, and `exactOptionalPropertyTypes` rejects assigning a
 * `T | undefined`-typed value to an optional schema field (`key?: T`) even
 * when the value is never actually undefined — so this narrows the type to
 * satisfy the compiler, one level deeper than a single conditional spread
 * reaches.
 */
function omitUndefinedValues<T extends Record<string, unknown>>(
  obj: T,
): { [K in keyof T]?: Exclude<T[K], undefined> } {
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined)) as {
    [K in keyof T]?: Exclude<T[K], undefined>;
  };
}

/**
 * Does not re-check that the parent Wedding still exists / isn't archived —
 * relies entirely on `loadMembership` having already required an ACTIVE
 * membership for this weddingId. Currently harmless, since nothing can
 * archive a wedding yet (no archive endpoint exists), unlike
 * weddings.service.ts's getWedding()/updateWedding(), which both do
 * `Wedding.findById().excludeArchived()`. Once a wedding-archive endpoint
 * ships, this will need the same guard, or an archived wedding's members
 * could still create events under it.
 */
export async function createEvent(
  weddingId: string,
  userId: string,
  body: CreateEventBody,
): Promise<EventDocument> {
  return await Event.create({
    weddingId: new Types.ObjectId(weddingId),
    name: body.name,
    startsAt: body.startsAt,
    timezone: body.timezone,
    // `exactOptionalPropertyTypes` treats each optional field below as
    // "key absent, or a value" — never "key present as undefined" — so
    // each is spread in only when actually provided, same pattern as
    // weddings.service.ts's createWedding()/description.
    ...(body.endsAt !== undefined ? { endsAt: body.endsAt } : {}),
    ...(body.description !== undefined ? { description: body.description } : {}),
    ...(body.venue !== undefined ? { venue: omitUndefinedValues(body.venue) } : {}),
    ...(body.livestream !== undefined ? { livestream: body.livestream } : {}),
    status: 'ACTIVE',
    createdBy: new Types.ObjectId(userId),
  });
}

export async function listEvents(
  weddingId: string,
  query: PaginationQuery,
): Promise<{ items: EventDocument[]; pagination: ReturnType<typeof buildPagination> }> {
  const skip = toSkip(query);

  // Independent reads — run concurrently rather than paying two sequential
  // round trips (same reasoning as members.service.ts's listMembers).
  const [totalItems, items] = await Promise.all([
    Event.countDocuments({ weddingId }).excludeArchived(),
    Event.find({ weddingId })
      .excludeArchived()
      // `_id: 1` tiebreaker — `startsAt` alone ties whenever two events share
      // a start time, which would otherwise make page boundaries nondeterministic.
      .sort({ startsAt: 1, _id: 1 })
      .skip(skip)
      .limit(query.limit),
  ]);

  return { items, pagination: buildPagination(query, totalItems) };
}

/**
 * `{ _id: eventId, weddingId }` in one filter — not a separate "does this
 * event exist" lookup followed by a weddingId comparison — is what actually
 * enforces weddingId as the tenant boundary: an event belonging to a
 * different wedding fails the query entirely and reports the same
 * EVENT_NOT_FOUND as a truly nonexistent id, never leaking which case it
 * was (same generic-not-found principle as load-membership.ts's
 * WEDDING_NOT_FOUND).
 */
export async function getEvent(weddingId: string, eventId: string): Promise<EventDocument> {
  const event = await Event.findOne({ _id: eventId, weddingId }).excludeArchived();
  if (!event) {
    throw AppError.notFound('Event not found.', ErrorCode.EVENT_NOT_FOUND);
  }
  return event;
}
