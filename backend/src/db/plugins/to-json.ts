/**
 * Base output-shaping plugin, applied to every schema.
 *
 * Strips `__v` (Mongoose's internal version key — an implementation detail
 * that has no place in an API response) and maps `_id` to `id` as a plain
 * string, so every JSON response uses one consistent identifier shape
 * regardless of which model produced it.
 *
 * `options.hide` additionally strips named fields — e.g. `users.passwordHash`
 * or a future `invitations.tokenHash` (db_design.docx's own schema notes
 * flag these as sensitive-at-rest). This belongs on the plugin rather than a
 * one-off `schema.set('toJSON', ...)` in the owning model: `Schema#set`
 * replaces the whole toJSON option rather than merging into it, so a second
 * call would silently drop this plugin's virtuals/versionKey/_id handling —
 * calling toJsonPlugin once, with `hide`, is the only safe way to combine
 * both behaviours on one schema.
 */
import type { Schema } from 'mongoose';

export interface ToJsonPluginOptions {
  hide?: string[];
}

export function toJsonPlugin(schema: Schema, options: ToJsonPluginOptions = {}): void {
  const hide = options.hide ?? [];

  schema.set('toJSON', {
    virtuals: true,
    versionKey: false,
    transform: (_doc, ret: Record<string, unknown>) => {
      if ('_id' in ret) {
        ret.id = String(ret._id);
        delete ret._id;
      }
      for (const field of hide) {
        // `delete ret[field]` trips @typescript-eslint/no-dynamic-delete
        // (field is a runtime string, not a literal key) — Reflect.deleteProperty
        // does the same thing without the "could deopt the object shape" lint concern.
        Reflect.deleteProperty(ret, field);
      }
      return ret;
    },
  });
}
