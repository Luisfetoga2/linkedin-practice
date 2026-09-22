import { describe, expect, it } from 'vitest';
import { CATEGORIES } from './data';
import { clean, isMatch, tokenize } from './match';

describe('pinpoint dataset integrity', () => {
  it('has at least 350 categories', () => {
    expect(CATEGORIES.length).toBeGreaterThanOrEqual(350);
  });

  it('every category has 6–9 distinct members and a non-empty name', () => {
    const bad: string[] = [];
    for (const c of CATEGORIES) {
      const keys = c.words.map((w) => clean(w));
      if (!c.name || c.words.length < 6 || c.words.length > 9 || new Set(keys).size !== keys.length || keys.some((k) => !k))
        bad.push(`${c.name} (${c.words.length})`);
    }
    expect(bad).toEqual([]);
  });

  it('every category has at least one usable answer (its own name matches)', () => {
    const bad = CATEGORIES.filter((c) => tokenize(c.name).length === 0 || !isMatch(c.name, c)).map((c) => c.name);
    expect(bad).toEqual([]);
  });

  it('names are unique, even after normalisation', () => {
    const seen = new Map<string, string>();
    const dupes: string[] = [];
    for (const c of CATEGORIES) {
      const key = tokenize(c.name).sort().join(' ');
      if (seen.has(key)) dupes.push(`${seen.get(key)} ~ ${c.name}`);
      seen.set(key, c.name);
    }
    expect(dupes).toEqual([]);
  });

  it('no clue word is itself accepted as the answer', () => {
    const bad: string[] = [];
    for (const c of CATEGORIES) for (const w of c.words) if (isMatch(w, c)) bad.push(`${c.name}: ${w}`);
    expect(bad).toEqual([]);
  });

  it('every accepted answer matches its category', () => {
    const bad: string[] = [];
    for (const c of CATEGORIES)
      for (const a of c.accept) if (!a.includes('*') && !isMatch(a, c)) bad.push(`${c.name}: ${a}`);
    expect(bad).toEqual([]);
  });

  it('data contains no format artefacts', () => {
    for (const c of CATEGORIES) {
      expect(c.name).not.toMatch(/[|;]/);
      for (const w of c.words) expect(w).not.toMatch(/[|;]|^\s|\s$/);
    }
  });
});
