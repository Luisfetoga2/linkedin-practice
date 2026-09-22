import { describe, expect, it } from 'vitest';
import { CATEGORIES } from './data';
import { CLUE_COUNT, generatePuzzle } from './generator';

const seeds = Array.from({ length: 300 }, (_, i) => (i + 1) * 7919);

describe('pinpoint generator', () => {
  it('is deterministic for a fixed seed', () => {
    for (const s of [1, 42, 123456, 987654321]) {
      const a = generatePuzzle(s);
      const b = generatePuzzle(s);
      expect(b.category.name).toBe(a.category.name);
      expect(b.clues).toEqual(a.clues);
    }
  });

  it('produces 5 distinct clues from the category, in stored order', () => {
    for (const s of seeds) {
      const p = generatePuzzle(s);
      expect(p.clues).toHaveLength(CLUE_COUNT);
      expect(new Set(p.clues).size).toBe(CLUE_COUNT);
      const pos = p.clues.map((w) => p.category.words.indexOf(w));
      expect(pos.every((i) => i >= 0)).toBe(true);
      expect([...pos].sort((a, b) => a - b)).toEqual(pos);
      // the last clue is one of the two most obvious members
      expect(pos[CLUE_COUNT - 1]).toBeGreaterThanOrEqual(p.category.words.length - 2);
    }
  });

  it('spreads rounds across many categories', () => {
    const names = new Set(seeds.map((s) => generatePuzzle(s).category.name));
    expect(names.size).toBeGreaterThan(Math.min(150, CATEGORIES.length / 3));
  });

  it('generates instantly', () => {
    const t = performance.now();
    for (const s of seeds) generatePuzzle(s);
    expect((performance.now() - t) / seeds.length).toBeLessThan(5);
  });
});
