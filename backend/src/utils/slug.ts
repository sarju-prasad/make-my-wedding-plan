/**
 * Slug generation — closes db_design.docx gap G5 (open decision, backend
 * CLAUDE.md): PRD §19's guest-facing `/w/couple-name` URL has no field to
 * come from anywhere in the schema. `weddings.slug` (see modules/weddings)
 * is that field; this module is pure string transformation only — collision
 * handling needs a database round trip, so it lives in weddings.service.ts,
 * not here.
 */

/** Lowercases, strips anything that isn't a letter/digit, and hyphenates. */
export function slugify(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '') // strip diacritics (e.g. "é" -> "e")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/** e.g. ("Ananya", "Arjun") -> "ananya-arjun". Falls back to "wedding" if both names slugify to nothing. */
export function buildWeddingSlugBase(partnerOneName: string, partnerTwoName: string): string {
  const base = [slugify(partnerOneName), slugify(partnerTwoName)].filter(Boolean).join('-');
  return base || 'wedding';
}
