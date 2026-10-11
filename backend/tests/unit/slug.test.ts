import { describe, expect, it } from 'vitest';

import { buildWeddingSlugBase, slugify } from '../../src/utils/slug.js';

describe('slugify', () => {
  it('lowercases and hyphenates', () => {
    expect(slugify('Ananya Sharma')).toBe('ananya-sharma');
  });

  it('strips diacritics', () => {
    expect(slugify('Zoé')).toBe('zoe');
  });

  it('collapses runs of non-alphanumeric characters into one hyphen', () => {
    expect(slugify("O'Brien  & Co.")).toBe('o-brien-co');
  });

  it('trims leading and trailing hyphens', () => {
    expect(slugify('--Hello--')).toBe('hello');
  });

  it('returns an empty string for input with no alphanumeric characters', () => {
    expect(slugify('!!!')).toBe('');
  });
});

describe('buildWeddingSlugBase', () => {
  it('joins both partner names', () => {
    expect(buildWeddingSlugBase('Ananya', 'Arjun')).toBe('ananya-arjun');
  });

  it('falls back to "wedding" when both names slugify to nothing', () => {
    expect(buildWeddingSlugBase('!!!', '???')).toBe('wedding');
  });

  it('uses whichever name is non-empty when only one slugifies to nothing', () => {
    expect(buildWeddingSlugBase('Ananya', '!!!')).toBe('ananya');
  });
});
