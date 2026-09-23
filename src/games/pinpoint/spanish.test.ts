import { describe, expect, it } from 'vitest';
import { CATEGORIES } from './data';
import { CATEGORIES_ES } from './data.es';
import { CLUE_COUNT, generatePuzzle } from './generator';
import { contentIfLoaded, EN_CONTENT, loadContent } from './content';
import { ES_CONTENT } from './spanish';

const seeds = Array.from({ length: 300 }, (_, i) => (i + 1) * 7919);

describe('pinpoint Spanish rounds', () => {
  it('are deterministic for a fixed seed and use the Spanish pool', () => {
    for (const s of [1, 42, 123456, 987654321]) {
      const a = generatePuzzle(s, CATEGORIES_ES);
      expect(generatePuzzle(s, CATEGORIES_ES)).toEqual(a);
      expect(CATEGORIES_ES).toContain(a.category);
    }
  });

  it('produce 5 distinct clues in stored order, ending on an obvious one', () => {
    for (const s of seeds) {
      const p = generatePuzzle(s, CATEGORIES_ES);
      expect(p.clues).toHaveLength(CLUE_COUNT);
      expect(new Set(p.clues).size).toBe(CLUE_COUNT);
      const pos = p.clues.map((w) => p.category.words.indexOf(w));
      expect([...pos].sort((a, b) => a - b)).toEqual(pos);
      expect(pos[CLUE_COUNT - 1]).toBeGreaterThanOrEqual(p.category.words.length - 2);
    }
  });

  it('spread across many categories', () => {
    const names = new Set(seeds.map((s) => generatePuzzle(s, CATEGORIES_ES).category.name));
    expect(names.size).toBeGreaterThan(150);
  });
});

describe('pinpoint content loading', () => {
  it('English is available synchronously and unchanged', () => {
    expect(contentIfLoaded('en')).toBe(EN_CONTENT);
    expect(EN_CONTENT.categories).toBe(CATEGORIES);
    expect(generatePuzzle(42, EN_CONTENT.categories)).toEqual(generatePuzzle(42));
  });

  it('Spanish loads on demand and is cached', async () => {
    const es = await loadContent('es');
    expect(es).toBe(ES_CONTENT);
    expect(contentIfLoaded('es')).toBe(ES_CONTENT);
    expect(await loadContent('es')).toBe(es);
    expect(es.categories).toBe(CATEGORIES_ES);
    const c = es.categories.find((x) => x.name === 'Cosas con llave')!;
    expect(es.matcher.isMatch('llaves', c)).toBe(true);
    expect(es.scorer.closeness('llaves', c, es.nearFor(c.name))).toEqual({ pct: 100, temp: 'correct' });
  });
});
