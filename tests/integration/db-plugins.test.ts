import mongoose from 'mongoose';
import { beforeAll, describe, expect, it } from 'vitest';

import {
  softArchivePlugin,
  type SoftArchiveDocument,
  type SoftArchiveQueryHelpers,
} from '../../src/db/plugins/soft-archive.js';
import { toJsonPlugin } from '../../src/db/plugins/to-json.js';

// The reference pattern for typing a schema that uses this plugin: fold
// SoftArchiveDocument into the document interface (for .archive()/.restore()
// and the isArchived/archivedAt/archivedBy fields), and thread
// SoftArchiveQueryHelpers through Schema's/Model's TQueryHelpers generic slot
// (for .excludeArchived()/.onlyArchived() on a query chain) — Mongoose can't
// infer either from a plain `schema.plugin(softArchivePlugin)` call, since
// plugins are opaque `(schema: Schema) => void` functions from a type-checker
// perspective.
interface TestItemDoc extends mongoose.Document, SoftArchiveDocument {
  name: string;
}

type TestItemModel = mongoose.Model<TestItemDoc, SoftArchiveQueryHelpers>;

let TestItem: TestItemModel;

beforeAll(() => {
  // Registering against the shared connection from tests/setup/test-setup.ts.
  const schema = new mongoose.Schema<TestItemDoc, TestItemModel, object, SoftArchiveQueryHelpers>(
    { name: String },
    { timestamps: true },
  );
  schema.plugin(softArchivePlugin);
  schema.plugin(toJsonPlugin);
  TestItem =
    (mongoose.models.DbPluginsTestItem as TestItemModel | undefined) ??
    mongoose.model<TestItemDoc, TestItemModel>('DbPluginsTestItem', schema);
});

describe('softArchivePlugin', () => {
  it('excludeArchived/onlyArchived partition documents by isArchived', async () => {
    await TestItem.create({ name: 'alpha' });
    const beta = await TestItem.create({ name: 'beta' });

    beta.archive('507f1f77bcf86cd799439011');
    await beta.save();

    const active = await TestItem.find().excludeArchived();
    const archived = await TestItem.find().onlyArchived();

    expect(active.map((d) => d.name)).toEqual(['alpha']);
    expect(archived.map((d) => d.name)).toEqual(['beta']);
    expect(archived[0]?.archivedAt).toBeInstanceOf(Date);
    expect(String(archived[0]?.archivedBy)).toBe('507f1f77bcf86cd799439011');
  });

  it('restore() clears isArchived, archivedAt, and archivedBy', async () => {
    const doc = await TestItem.create({ name: 'gamma' });
    doc.archive();
    await doc.save();

    doc.restore();
    await doc.save();

    expect(doc.isArchived).toBe(false);
    expect(doc.archivedAt).toBeNull();
    expect(doc.archivedBy).toBeNull();
  });
});

describe('toJsonPlugin', () => {
  it('maps _id to a string id and strips __v', async () => {
    const doc = await TestItem.create({ name: 'delta' });
    const json = doc.toJSON() as unknown as Record<string, unknown>;

    expect(typeof json.id).toBe('string');
    expect(json._id).toBeUndefined();
    expect(json.__v).toBeUndefined();
  });
});
