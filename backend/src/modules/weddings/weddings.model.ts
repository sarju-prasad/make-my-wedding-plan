/**
 * weddings — db_design.docx §5: wedding-level information and lifecycle.
 * Indexes per db_design.docx §6: `status + weddingDate`; `createdBy`.
 *
 * `slug` is an addition beyond db_design.docx's field list, closing open gap
 * G5 (backend/CLAUDE.md): PRD §19's guest-facing `/w/couple-name` URL has no
 * field to come from otherwise. Generated at creation time in
 * weddings.service.ts (see utils/slug.ts), unique-indexed here.
 *
 * `status` folds archival into a domain enum the same way db_design.docx's
 * own `events` schema does (`DRAFT|ACTIVE|CANCELLED|ARCHIVED`) — a
 * conflation between lifecycle and archival state that
 * db/plugins/soft-archive.ts's own comment flags as unresolved across the
 * source documents. Followed here for consistency with that existing
 * precedent rather than re-litigated; the soft-archive plugin (isArchived/
 * archivedAt/archivedBy + archive()/restore()/excludeArchived()) is applied
 * alongside it regardless, since nothing here implements the archive/restore
 * endpoints yet (deferred — see doc/project_status.md).
 *
 * Document/schema typing follows the reference pattern documented in
 * tests/integration/db-plugins.test.ts: SoftArchiveDocument (fields +
 * archive()/restore()) folds into the document interface, and
 * SoftArchiveQueryHelpers threads through Schema's query-helpers generic for
 * a type-safe `.excludeArchived()`/`.onlyArchived()` on query chains.
 */
import mongoose, { Schema, type Model, type Types } from 'mongoose';

import {
  softArchivePlugin,
  type SoftArchiveDocument,
  type SoftArchiveQueryHelpers,
} from '#db/plugins/soft-archive.js';
import { toJsonPlugin } from '#db/plugins/to-json.js';

export const WEDDING_STATUS = ['ACTIVE', 'ARCHIVED'] as const;
export type WeddingStatus = (typeof WEDDING_STATUS)[number];

export interface WeddingCouple {
  partnerOneName: string;
  partnerTwoName: string;
}

export interface WeddingLocation {
  address: string;
  latitude: number;
  longitude: number;
}

export interface WeddingFields {
  name: string;
  slug: string;
  couple: WeddingCouple;
  weddingDate: Date;
  timezone: string;
  location: WeddingLocation;
  // Not in db_design.docx's field list — an additive, optional field (same
  // category as `slug`/G5) rather than a schema deviation: nothing else
  // depends on it, and PRD §21's "couple's story" shows the product already
  // expects free-text wedding description content somewhere.
  description?: string;
  language: string;
  status: WeddingStatus;
  createdBy: Types.ObjectId;
}

export interface WeddingDocument extends mongoose.Document, WeddingFields, SoftArchiveDocument {}

export type WeddingModel = Model<WeddingDocument, SoftArchiveQueryHelpers>;

const weddingSchema = new Schema<WeddingDocument, WeddingModel, object, SoftArchiveQueryHelpers>(
  {
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, trim: true, lowercase: true },
    couple: {
      partnerOneName: { type: String, required: true, trim: true },
      partnerTwoName: { type: String, required: true, trim: true },
    },
    weddingDate: { type: Date, required: true },
    timezone: { type: String, required: true },
    location: {
      address: { type: String, required: true, trim: true },
      latitude: { type: Number, required: true },
      longitude: { type: Number, required: true },
    },
    description: { type: String, trim: true },
    language: { type: String, required: true, default: 'en' },
    status: { type: String, enum: WEDDING_STATUS, default: 'ACTIVE', required: true },
    createdBy: { type: 'ObjectId', ref: 'User', required: true },
  },
  // `optimisticConcurrency: true` — plain `__v` tracking (the default)
  // only guards conflicting *array* operations; it does not, by itself,
  // make a plain `.save()` reject a write based on a stale read of a
  // scalar/embedded field. weddings.service.ts's updateWedding() has a
  // real read-modify-write step (reconciling weddingDate/timezone when a
  // PATCH supplies only one of the two, using the *other's* currently-
  // loaded value) — without this option, two concurrent PATCH requests
  // could each compute their result from the same stale read and the
  // second save would silently overwrite the first rather than erroring.
  // With it, that second `.save()` throws VersionError, mapped to a 409
  // CONCURRENT_UPDATE by core/errors/error-mappers.ts.
  { timestamps: true, optimisticConcurrency: true },
);

weddingSchema.index({ status: 1, weddingDate: 1 });
weddingSchema.index({ createdBy: 1 });
weddingSchema.index({ slug: 1 }, { unique: true });

weddingSchema.plugin(softArchivePlugin, { archivedByRef: 'User' });
weddingSchema.plugin(toJsonPlugin);

// Guarded registration — see modules/auth/auth.model.ts for why (tsx watch's
// hot reload re-evaluates this module while the mongoose instance persists).
export const Wedding: WeddingModel =
  (mongoose.models.Wedding as WeddingModel | undefined) ??
  mongoose.model<WeddingDocument, WeddingModel>('Wedding', weddingSchema);
