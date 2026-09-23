import { describe, expect, it } from 'vitest';
import { CATEGORIES_ES as CATEGORIES } from './data.es';
import { spanishMatcher } from './match.es';
import { NEAR_ES, nearForEs } from './near.es';

describe('pinpoint Spanish related-concept data', () => {
  it('every category has 8+ related concepts', () => {
    const bad = CATEGORIES.filter((c) => nearForEs(c.name).length < 8).map((c) => `${c.name} (${nearForEs(c.name).length})`);
    expect(bad).toEqual([]);
  });

  it('has no entries for unknown categories', () => {
    const names = new Set(CATEGORIES.map((c) => c.name));
    expect([...NEAR_ES.keys()].filter((n) => !names.has(n))).toEqual([]);
  });

  it('related concepts are not themselves accepted answers', () => {
    const bad: string[] = [];
    for (const c of CATEGORIES) for (const t of nearForEs(c.name)) if (spanishMatcher.isMatch(t, c)) bad.push(`${c.name}: ${t}`);
    expect(bad).toEqual([]);
  });

  it('related concepts are lowercase words (Spanish letters allowed), no duplicates', () => {
    const bad: string[] = [];
    for (const [name, terms] of NEAR_ES) {
      for (const t of terms) if (!/^[a-z0-9áéíóúüñ '-]+$/.test(t)) bad.push(`${name}: ${t}`);
      if (new Set(terms).size !== terms.length) bad.push(`${name}: duplicate terms`);
    }
    expect(bad).toEqual([]);
  });
});
