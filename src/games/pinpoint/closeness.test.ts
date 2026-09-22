import { describe, expect, it } from 'vitest';
import { CATEGORIES, type Category } from './data';
import { closeness, temperature } from './closeness';
import { isMatch } from './match';
import { NEAR, nearFor } from './near';

function cat(name: string): Category {
  const c = CATEGORIES.find((x) => x.name === name);
  if (!c) throw new Error(`missing category ${name}`);
  return c;
}
const score = (guess: string, name: string) => closeness(guess, cat(name), nearFor(name)).pct;

/** [category, related guesses (should be warm/hot), unrelated guesses (should be cold)] */
const cases: [string, string[], string[]][] = [
  ['Things with keys', ['locks', 'musical instruments', 'instruments', 'computers', 'things with locks'], ['planets', 'sandwiches', 'football', 'animals']],
  ['Things with shells', ['sea creatures', 'shellfish', 'ocean', 'animals', 'things with armor'], ['cars', 'music', 'planets']],
  ['Things with wings', ['birds', 'flying things', 'things that fly', 'feathers'], ['food', 'colors']],
  ['Things with teeth', ['animals', 'sharp things', 'tools', 'mouths'], ['colors', 'planets']],
  ['Things you can shuffle', ['cards', 'music', 'mix'], ['fruit', 'rivers']],
  ['Planets', ['stars', 'space', 'roman gods', 'astronomy'], ['cheese', 'shoes', 'football']],
  ['Types of cheese', ['dairy', 'milk', 'dairy products', 'food'], ['planets', 'cars', 'singers']],
  ['Coffee drinks', ['drinks', 'hot drinks', 'caffeine', 'beverages'], ['planets', 'animals', 'tools']],
  ['Card games', ['games', 'board games'], ['vegetables', 'weather']],
];

describe('pinpoint closeness', () => {
  it('scores accepted answers as 100 / correct', () => {
    for (const c of CATEGORIES) {
      for (const a of [c.name, ...c.accept.filter((x) => !x.includes('*'))]) {
        const r = closeness(a, c, nearFor(c.name));
        expect(r, `${c.name}: ${a}`).toEqual({ pct: 100, temp: 'correct' });
      }
    }
  });

  for (const [name, related, unrelated] of cases) {
    it(`ranks related guesses above unrelated ones for ${name}`, () => {
      const lo = Math.min(...related.map((g) => score(g, name)));
      const hi = Math.max(...unrelated.map((g) => score(g, name)));
      for (const g of related) {
        const s = score(g, name);
        expect(s, `${g} → ${s}`).toBeGreaterThanOrEqual(35);
        expect(s, `${g} → ${s}`).toBeLessThan(100);
      }
      for (const g of unrelated) expect(score(g, name), g).toBeLessThanOrEqual(25);
      expect(lo).toBeGreaterThan(hi);
    });
  }

  it('an answer-adjacent guess beats a merely topical one', () => {
    expect(score('things with locks', 'Things with keys')).toBeGreaterThan(score('computers', 'Things with keys'));
    expect(score('card', 'Card games')).toBeGreaterThan(score('vegetables', 'Card games'));
  });

  it('never gives a wrong guess 100', () => {
    for (const c of CATEGORIES.slice(0, 120)) {
      for (const w of c.words) {
        if (isMatch(w, c)) continue;
        expect(closeness(w, c, nearFor(c.name)).pct).toBeLessThan(100);
      }
    }
  });

  it('is deterministic', () => {
    expect(score('musical instruments', 'Things with keys')).toBe(score('musical instruments', 'Things with keys'));
  });

  it('maps percentages to temperatures', () => {
    expect(temperature(100)).toBe('correct');
    expect(temperature(80)).toBe('hot');
    expect(temperature(50)).toBe('warm');
    expect(temperature(10)).toBe('cold');
  });
});

describe('pinpoint related-concept data', () => {
  it('every category has 8+ related concepts', () => {
    const bad = CATEGORIES.filter((c) => nearFor(c.name).length < 8).map((c) => `${c.name} (${nearFor(c.name).length})`);
    expect(bad).toEqual([]);
  });

  it('has no entries for unknown categories', () => {
    const names = new Set(CATEGORIES.map((c) => c.name));
    expect([...NEAR.keys()].filter((n) => !names.has(n))).toEqual([]);
  });

  it('related concepts are not themselves accepted answers', () => {
    const bad: string[] = [];
    for (const c of CATEGORIES) for (const t of nearFor(c.name)) if (isMatch(t, c)) bad.push(`${c.name}: ${t}`);
    expect(bad).toEqual([]);
  });

  it('related concepts use plain characters only', () => {
    for (const [name, terms] of NEAR) for (const t of terms) expect(t, name).toMatch(/^[a-z0-9 '-]+$/);
  });
});
