import { describe, expect, it } from 'vitest';
import { getClueBank, type WordLength } from './data';
import { countLadderOrders, generateLadder, getGraph, goodLinks, isLadder, oneApart } from './generator';

const LENGTHS: WordLength[] = [4, 5];

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
  }
});

describe('crossclimb generator', () => {
  for (const L of LENGTHS) {
    it(`is deterministic for a fixed seed (${L} letters)`, () => {
      expect(generateLadder(12345, L)).toEqual(generateLadder(12345, L));
      expect(generateLadder(777, L)).toEqual(generateLadder(777, L));
      expect(generateLadder(1, L).words).not.toEqual(generateLadder(2, L).words);
    });

    it(`produces valid, uniquely ordered ladders quickly (${L} letters)`, () => {
      const bank = getClueBank(L);
      getGraph(L); // build once so timing measures generation
      let worst = 0;
      let total = 0;
      const seeds = 40;
      for (let s = 1; s <= seeds; s++) {
        const seed = s * 7919 + L;
        const t0 = performance.now();
        const lad = generateLadder(seed, L);
        const dt = performance.now() - t0;
        worst = Math.max(worst, dt);
        total += dt;

        const { words, clues, order } = lad;
        expect(words).toHaveLength(7);
        expect(new Set(words).size).toBe(7);
        expect(isLadder(words)).toBe(true);
        words.forEach((w, i) => {
          expect(w).toHaveLength(L);
          expect(bank.get(w)).toContain(clues[i]);
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
      expect(total / seeds).toBeLessThan(20);
      expect(worst).toBeLessThan(150);
    });

    it(`reaches a wide variety of words (${L} letters)`, () => {
      const used = new Set<string>();
      for (let s = 1; s <= 150; s++) generateLadder(s * 31 + 5, L).words.forEach((w) => used.add(w));
      expect(used.size).toBeGreaterThan(450);
    });
  }
});
