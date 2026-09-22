import { describe, expect, it } from 'vitest';
import { getClueBank, getPairs, type WordLength } from './data';
import { countLadderOrders, findPairLadder, generateLadder, getGraph, goodLinks, isLadder, oneApart } from './generator';

const LENGTHS: WordLength[] = [4, 5];
/** Minimum number of curated (and feasible) end pairs per word length. */
const MIN_PAIRS: Record<WordLength, number> = { 4: 400, 5: 150 };

describe('crossclimb data', () => {
  for (const L of LENGTHS) {
    it(`has a large clued ${L}-letter vocabulary`, () => {
      const bank = getClueBank(L);
      expect(bank.size).toBeGreaterThanOrEqual(700);
      for (const [word, clues] of bank) {
        expect(word).toMatch(new RegExp(`^[A-Z]{${L}}$`));
        expect(clues.length).toBeGreaterThan(0);
        for (const clue of clues) {
          expect(clue.trim().length).toBeGreaterThan(1);
          expect(clue.toUpperCase().includes(word), `${word}: ${clue}`).toBe(false);
        }
      }
    });

    it(`builds a well-connected ${L}-letter graph`, () => {
      const g = getGraph(L);
      expect(g.starts.length).toBeGreaterThan(500);
    });

    it(`has well-formed ${L}-letter end pairs from the clued vocabulary`, () => {
      const bank = getClueBank(L);
      const pairs = getPairs(L);
      expect(pairs.length).toBeGreaterThanOrEqual(MIN_PAIRS[L]);
      const seen = new Set<string>();
      for (const { top, bottom, clue } of pairs) {
        expect(top).toMatch(new RegExp(`^[A-Z]{${L}}$`));
        expect(bottom).toMatch(new RegExp(`^[A-Z]{${L}}$`));
        expect(top).not.toBe(bottom);
        expect(bank.has(top), `${top} needs vocabulary clues`).toBe(true);
        expect(bank.has(bottom), `${bottom} needs vocabulary clues`).toBe(true);
        const key = [top, bottom].sort().join('|');
        expect(seen.has(key), `duplicate pair ${key}`).toBe(false);
        seen.add(key);
        expect(clue.trim().length).toBeGreaterThan(5);
        const up = clue.toUpperCase();
        expect(up.includes(top) || up.includes(bottom), `${top}/${bottom}: ${clue}`).toBe(false);
      }
    });

    it(`only lists ${L}-letter end pairs that admit a valid ladder`, () => {
      const g = getGraph(L);
      const pairs = getPairs(L);
      const infeasible = pairs.filter((p) => !findPairLadder(g, g.index.get(p.top)!, g.index.get(p.bottom)!, null, 1_000_000));
      console.info(`crossclimb: ${pairs.length - infeasible.length}/${pairs.length} feasible ${L}-letter end pairs`);
      expect(infeasible.map((p) => `${p.top}/${p.bottom}`)).toEqual([]);
      expect(pairs.length - infeasible.length).toBeGreaterThanOrEqual(60);
    });
  }
});

describe('crossclimb generator', () => {
  for (const L of LENGTHS) {
    it(`is deterministic for a fixed seed (${L} letters)`, () => {
      expect(generateLadder(12345, L)).toEqual(generateLadder(12345, L));
      expect(generateLadder(777, L)).toEqual(generateLadder(777, L));
      expect(generateLadder(1, L).words).not.toEqual(generateLadder(2, L).words);
    });

    it(`produces valid, uniquely ordered ladders between an end pair quickly (${L} letters)`, () => {
      const bank = getClueBank(L);
      const pairs = new Map(getPairs(L).map((p) => [`${p.top}|${p.bottom}`, p.clue]));
      getGraph(L); // build once so timing measures generation
      let worst = 0;
      let total = 0;
      const seeds = 60;
      for (let s = 1; s <= seeds; s++) {
        const seed = s * 7919 + L;
        const t0 = performance.now();
        const lad = generateLadder(seed, L);
        const dt = performance.now() - t0;
        worst = Math.max(worst, dt);
        total += dt;

        const { words, clues, order, endClue } = lad;
        expect(words).toHaveLength(7);
        expect(new Set(words).size).toBe(7);
        expect(isLadder(words)).toBe(true);
        // Top and bottom are a curated pair (top first) sharing one clue.
        expect(pairs.get(`${words[0]}|${words[6]}`)).toBe(endClue);
        expect(clues[0]).toBe(endClue);
        expect(clues[6]).toBe(endClue);
        words.forEach((w, i) => {
          expect(w).toHaveLength(L);
          if (i > 0 && i < 6) expect(bank.get(w)).toContain(clues[i]);
        });
        const mids = words.slice(1, 6);
        // Exactly one ordering of the middle rungs (plus its reverse).
        expect(countLadderOrders(mids)).toBe(2);
        // Top/bottom attach only to their own end of the middle chain and not to each other.
        mids.forEach((m, i) => {
          expect(oneApart(words[0], m)).toBe(i === 0);
          expect(oneApart(words[6], m)).toBe(i === 4);
        });
        expect(oneApart(words[0], words[6])).toBe(false);
        // Whole 7-rung ladder is unique too.
        expect(countLadderOrders(words)).toBe(2);
        // Shuffled start is a permutation that is not already (nearly) solved.
        expect([...order].sort()).toEqual([1, 2, 3, 4, 5]);
        expect(isLadder(order.map((i) => words[i]))).toBe(false);
        expect(goodLinks(order)).toBeLessThanOrEqual(1);
        // Letter positions that change vary along the ladder.
        const positions = new Set<number>();
        for (let i = 1; i < 7; i++) for (let p = 0; p < L; p++) if (words[i][p] !== words[i - 1][p]) positions.add(p);
        expect(positions.size).toBeGreaterThanOrEqual(3);
      }
      expect(total / seeds).toBeLessThan(10);
      expect(worst).toBeLessThan(50);
    });

    it(`reaches a wide variety of words and end pairs (${L} letters)`, () => {
      const used = new Set<string>();
      const ends = new Set<string>();
      for (let s = 1; s <= 150; s++) {
        const lad = generateLadder(s * 31 + 5, L);
        lad.words.forEach((w) => used.add(w));
        ends.add(`${lad.words[0]}|${lad.words[6]}`);
      }
      // 5-letter ladders are confined to the fewer end pairs that fit in six single-letter steps.
      expect(used.size).toBeGreaterThan(L === 4 ? 450 : 250);
      expect(ends.size).toBeGreaterThan(L === 4 ? 110 : 80);
    });
  }
});
