/**
 * Soft-archive plugin — the mechanics behind "no destructive deletion for
 * business resources" (db_design.docx §8, and the architecture decision this
 * project was scoped under).
 *
 * Deliberately adds ONE boolean archival axis (`isArchived`), separate from
 * whatever domain-specific status enum a model defines for itself (e.g. an
 * event's DRAFT/ACTIVE/CANCELLED lifecycle, or a vendor's
 * Shortlisted/Confirmed/Completed pipeline). Several of the source documents
 * conflate a resource's lifecycle status with its archival state for some
 * collections — see CLAUDE.md "Open decisions", C10 — and that conflict is
 * for the product owner to resolve, not for this plugin to presuppose. Every
 * model gets a consistent, independent archive/restore mechanism it can
 * layer under its own status field once that decision lands.
 *
 * Adds:
 *   - isArchived: boolean, default false
 *   - archivedAt: Date | null
 *   - archivedBy: ObjectId | null   (no hard `ref` — the User model doesn't
 *     exist yet; pass `{ archivedByRef: 'User' }` once it does)
 *   - instance methods:  doc.archive(byId?)   doc.restore()
 *   - query helpers:     Model.find().excludeArchived()
 *                         Model.find().onlyArchived()
 *     Opt-in and explicit by design — this plugin never silently rewrites a
 *     query. The service layer decides, per query, whether archived
 *     documents belong in the result set.
 */
import type { Query, Schema, Types } from 'mongoose';

export interface SoftArchiveOptions {
  /** Model name to reference from `archivedBy`, once a User model exists. */
  archivedByRef?: string;
}

export interface SoftArchiveFields {
  isArchived: boolean;
  archivedAt: Date | null;
  archivedBy: Types.ObjectId | null;
}

export interface SoftArchiveMethods {
  archive(this: SoftArchiveDocument, archivedBy?: Types.ObjectId | string): void;
  restore(this: SoftArchiveDocument): void;
}

export type SoftArchiveDocument = SoftArchiveFields & SoftArchiveMethods;

export interface SoftArchiveQueryHelpers {
  excludeArchived<ResultType, RawDocType>(
    this: Query<ResultType, RawDocType>,
  ): Query<ResultType, RawDocType>;
  onlyArchived<ResultType, RawDocType>(
    this: Query<ResultType, RawDocType>,
  ): Query<ResultType, RawDocType>;
}

export function softArchivePlugin(schema: Schema, options: SoftArchiveOptions = {}): void {
  schema.add({
    isArchived: { type: Boolean, default: false, required: true, index: true },
    archivedAt: { type: Date, default: null },
    // `ref` must be omitted entirely when there's no target model — merely
    // setting it to `undefined` still makes Mongoose validate it as a ref
    // and throw "Invalid ref at path" during schema construction.
    archivedBy: options.archivedByRef
      ? { type: 'ObjectId', ref: options.archivedByRef, default: null }
      : { type: 'ObjectId', default: null },
  });

  schema.methods.archive = function (
    this: SoftArchiveDocument,
    archivedBy?: Types.ObjectId | string,
  ) {
    this.isArchived = true;
    this.archivedAt = new Date();
    this.archivedBy = archivedBy ? (archivedBy as Types.ObjectId) : null;
  };

  schema.methods.restore = function (this: SoftArchiveDocument) {
    this.isArchived = false;
    this.archivedAt = null;
    this.archivedBy = null;
  };

  // Mongoose's own generic plugin signature can't thread a caller-specific
  // TQueryHelpers type through `schema.query`, which is why `function
  // myPlugin(schema: Schema)` sees it typed as `{}` — this is the documented
  // Mongoose + TypeScript pattern for a reusable plugin (see their "Plugins"
  // guide): assign through a narrow cast here, and let callers who want
  // compile-time access to `.excludeArchived()`/`.onlyArchived()` on their
  // own model parameterise their schema with SoftArchiveQueryHelpers (see
  // tests/integration/db-plugins.test.ts for the pattern).
  const queryHelpers = schema.query as unknown as SoftArchiveQueryHelpers;

  queryHelpers.excludeArchived = function <ResultType, RawDocType>(
    this: Query<ResultType, RawDocType>,
  ) {
    return this.where({ isArchived: { $ne: true } });
  };

  queryHelpers.onlyArchived = function <ResultType, RawDocType>(
    this: Query<ResultType, RawDocType>,
  ) {
    return this.where({ isArchived: true });
  };
}
