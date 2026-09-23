import { describe, expect, it } from 'vitest';
import { ENTRIES as EN } from './data/en';
import { clueLeaksAnswer } from './data/parse';
import type { ClueEntry } from './data/types';
import { checkPuzzle, generateMini, isValidTemplate, templates, type MiniSize } from './generator';

// Spanish data is written separately; test it too whenever it's present.
const esModules = import.meta.glob<{ ENTRIES: ClueEntry[] }>('./data/es/index.ts', { eager: true });
const ES = esModules['./data/es/index.ts']?.ENTRIES;
const LANGS: [string, ClueEntry[]][] = [['en', EN], ...(ES?.length ? [['es', ES] as [string, ClueEntry[]]] : [])];
const SIZES: MiniSize[] = [4, 5];
const SEEDS = 300;

describe('mini templates', () => {
  for (const size of SIZES) {
    it(`${size}×${size} templates are valid and symmetric`, () => {
      const list = templates(size);
      expect(list.length).toBeGreaterThanOrEqual(2);
      for (const t of list) {
        expect(isValidTemplate(size, t.blocks), t.id).toBe(true);
        // 180° rotational symmetry
        const n = size * size;
        t.blocks.forEach((b, i) => expect(b, t.id).toBe(t.blocks[n - 1 - i]));
        expect(t.blocks.filter(Boolean).length).toBeLessThanOrEqual(6);
      }
    });
  }

  it('rejects grids with 2-letter entries or unchecked squares', () => {
    const b = (rows: string[]) => rows.join('').split('').map((c) => c === '#');
    expect(isValidTemplate(5, b(['#...#', '#....', '.....', '....#', '#...#']))).toBe(false);
    expect(isValidTemplate(4, b(['#..#', '....', '....', '#..#']))).toBe(false);
    expect(isValidTemplate(4, b(['....', '....', '....', '....']))).toBe(true);
  });
});

describe('mini English data', () => {
  it('has a large clued 3–5 letter vocabulary with no leaking clues', () => {
    const counts = [3, 4, 5].map((l) => EN.filter((e) => e.word.length === l).length);
    expect(counts[0]).toBeGreaterThanOrEqual(400);
    expect(counts[1]).toBeGreaterThanOrEqual(1000);
    expect(counts[2]).toBeGreaterThanOrEqual(1000);
    const seen = new Set<string>();
    for (const { word, clues } of EN) {
      expect(word).toMatch(/^[A-Z]{3,5}$/);
      expect(seen.has(word), word).toBe(false);
      seen.add(word);
      expect(clues.length).toBeGreaterThan(0);
      for (const c of clues) {
        expect(c.trim().length).toBeGreaterThan(1);
        expect(clueLeaksAnswer(word, c), `${word}: ${c}`).toBe(false);
        expect(c).not.toMatch(/`|\$\{/);
      }
    }
  });
});

for (const [lang, entries] of LANGS) {
  describe(`mini generator (${lang})`, () => {
    it('is deterministic for a seed', () => {
      for (const size of SIZES) {
        const a = generateMini(12345, size, entries);
        const b = generateMini(12345, size, entries);
        expect(a).toEqual(b);
        const c = generateMini(54321, size, entries);
        expect(c.solution.join('')).not.toBe(a.solution.join(''));
      }
    });

    for (const size of SIZES) {
      it(`fills ${SEEDS} valid ${size}×${size} puzzles quickly`, () => {
        let worst = 0;
        let total = 0;
        const templatesUsed = new Set<string>();
        const answers = new Set<string>();
        for (let seed = 1; seed <= SEEDS; seed++) {
          const t0 = performance.now();
          const p = generateMini(seed, size, entries);
          const dt = performance.now() - t0;
          worst = Math.max(worst, dt);
          total += dt;
          expect(checkPuzzle(p, entries), `seed ${seed}`).toEqual([]);
          expect(p.size).toBe(size);
          templatesUsed.add(p.template.split('~')[0]);
          for (const c of [...p.across, ...p.down]) answers.add(c.answer);
        }
        const avg = total / SEEDS;
        console.info(`mini ${lang} ${size}×${size}: avg ${avg.toFixed(1)} ms, worst ${worst.toFixed(0)} ms, templates ${[...templatesUsed].join(',')}, ${answers.size} distinct answers`);
        expect(avg).toBeLessThan(50);
        expect(worst).toBeLessThan(300);
        expect(templatesUsed.size).toBeGreaterThanOrEqual(2);
        expect(answers.size).toBeGreaterThan(SEEDS);
      });
    }
  });
}

describe('mini generator edge cases', () => {
  it('throws on a word list that cannot fill a grid', () => {
    expect(() => generateMini(1, 4, [{ word: 'CAT', clues: ['Pet'] }])).toThrow();
  });
});
