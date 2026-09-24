/**
 * Base output-shaping plugin, applied to every schema.
 *
 * Strips `__v` (Mongoose's internal version key — an implementation detail
 * that has no place in an API response) and maps `_id` to `id` as a plain
 * string, so every JSON response uses one consistent identifier shape
 * regardless of which model produced it.
 */
import type { Schema } from 'mongoose';

export function toJsonPlugin(schema: Schema): void {
  schema.set('toJSON', {
    virtuals: true,
    versionKey: false,
    transform: (_doc, ret: Record<string, unknown>) => {
      if ('_id' in ret) {
        ret.id = String(ret._id);
        delete ret._id;
      }
      return ret;
    },
  });
}
