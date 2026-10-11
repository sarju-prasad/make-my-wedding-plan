/**
 * events — db_design.docx §5: ceremonies and event details, wedding-scoped.
 * Indexes per db_design.docx §6: `weddingId + status + startsAt`;
 * `weddingId + startsAt`.
 *
 * Soft-archive plugin applied now, same precedent as weddings.model.ts:
 * nothing here implements cancel/archive/restore yet (deferred — see
 * doc/project_status.md), but the schema is ready for it rather than
 * needing a later migration. `status`'s DRAFT|ACTIVE|CANCELLED|ARCHIVED
 * enum (db_design.docx's exact wording) folds lifecycle and archival
 * together the same way weddings.model.ts's own comment already flags as
 * an unresolved conflation across the source documents — not re-litigated
 * here either.
 *
 * `venue`/`livestream` sub-fields are all individually optional —
 * api_design.docx §10 says venue "may contain name, address, coordinates,
 * and Google Maps URL" (looser than weddings.location, which requires
 * address+latitude+longitude together as the guest-facing "get
 * directions" target). `livestream` is a nested `{ url }` object, not a
 * bare string field, deliberately leaving room for a later `recordingUrl`
 * (PRD §32) without a schema migration — that field itself isn't added
 * now since livestream management is explicitly out of scope for this
 * slice.
 */
import mongoose, { Schema, type Model, type Types } from 'mongoose';

import {
  softArchivePlugin,
  type SoftArchiveDocument,
  type SoftArchiveQueryHelpers,
} from '#db/plugins/soft-archive.js';
import { toJsonPlugin } from '#db/plugins/to-json.js';

export const EVENT_STATUS = ['DRAFT', 'ACTIVE', 'CANCELLED', 'ARCHIVED'] as const;
export type EventStatus = (typeof EVENT_STATUS)[number];

export interface EventVenue {
  name?: string;
  address?: string;
  latitude?: number;
  longitude?: number;
  googleMapsUrl?: string;
}

export interface EventLivestream {
  url: string;
}

export interface EventFields {
  weddingId: Types.ObjectId;
  name: string;
  startsAt: Date;
  endsAt?: Date;
  timezone: string;
  description?: string;
  coverImageKey?: string;
  venue?: EventVenue;
  livestream?: EventLivestream;
  status: EventStatus;
  createdBy: Types.ObjectId;
}

export interface EventDocument extends mongoose.Document, EventFields, SoftArchiveDocument {}

export type EventModel = Model<EventDocument, SoftArchiveQueryHelpers>;

const eventSchema = new Schema<EventDocument, EventModel, object, SoftArchiveQueryHelpers>(
  {
    weddingId: { type: 'ObjectId', ref: 'Wedding', required: true },
    name: { type: String, required: true, trim: true },
    startsAt: { type: Date, required: true },
    endsAt: { type: Date },
    timezone: { type: String, required: true },
    description: { type: String, trim: true },
    coverImageKey: { type: String },
    venue: {
      name: { type: String, trim: true },
      address: { type: String, trim: true },
      latitude: { type: Number },
      longitude: { type: Number },
      googleMapsUrl: { type: String },
    },
    livestream: {
      url: { type: String },
    },
    status: { type: String, enum: EVENT_STATUS, default: 'ACTIVE', required: true },
    createdBy: { type: 'ObjectId', ref: 'User', required: true },
  },
  { timestamps: true },
);

eventSchema.index({ weddingId: 1, status: 1, startsAt: 1 });
eventSchema.index({ weddingId: 1, startsAt: 1 });

eventSchema.plugin(softArchivePlugin, { archivedByRef: 'User' });
eventSchema.plugin(toJsonPlugin);

// Guarded registration — see modules/auth/auth.model.ts for why.
export const Event: EventModel =
  (mongoose.models.Event as EventModel | undefined) ??
  mongoose.model<EventDocument, EventModel>('Event', eventSchema);
