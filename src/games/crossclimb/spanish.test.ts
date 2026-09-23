import { beforeAll, describe, expect, it } from 'vitest';
import { getClueBank, getPairs, loadWords, wordsLoaded, type WordLength } from './data';
import { CLUES, PAIRS } from './data/es';
import { countLadderOrders, findPairLadder, generateLadder, getGraph, goodLinks, isLadder, oneApart } from './generator';
import { keyToLetter } from './logic';

const LENGTHS: WordLength[] = [4, 5];
/** Minimum clued vocabulary per word length. */
const MIN_WORDS: Record<WordLength, number> = { 4: 700, 5: 600 };
/** Minimum number of curated (and feasible) end pairs per word length. */
const MIN_PAIRS = 60;

/** Uppercase without accents or diaeresis, but with Ñ kept (the form used on the tiles). */
const plain = (s: string) =>
  s
    .normalize('NFC')
    .toUpperCase()
    .replace(/Ñ/g, '#')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/#/g, 'Ñ');

beforeAll(async () => {
  await loadWords('es');
});

describe('crossclimb spanish data', () => {
  it('is loaded on demand', () => {
    expect(wordsLoaded('en')).toBe(true);
    expect(wordsLoaded('es')).toBe(true);
  });

  for (const L of LENGTHS) {
    it(`has a large clued ${L}-letter vocabulary`, () => {
      const bank = getClueBank(L, 'es');
      expect(bank.size).toBeGreaterThanOrEqual(MIN_WORDS[L]);
      for (const [word, clues] of bank) {
        expect(word).toMatch(new RegExp(`^[A-ZÑ]{${L}}$`));
        expect(clues.length).toBeGreaterThan(0);
        for (const clue of clues) {
          expect(clue.trim().length).toBeGreaterThan(1);
          expect(clue).toBe(clue.normalize('NFC'));
          // Accents don't hide the answer: "Café" still gives away CAFE.
          expect(plain(clue).includes(word), `${word}: ${clue}`).toBe(false);
        }
      }
    });

    it(`lists every ${L}-letter word once, with no stray lines`, () => {
      const seen = new Set<string>();
      for (const text of CLUES[L]) {
        for (const raw of text.split('\n')) {
          const line = raw.trim();
          if (!line) continue;
          const [word, ...clues] = line.split('|');
          expect(word, line).toMatch(new RegExp(`^[A-ZÑ]{${L}}$`));
          expect(clues.length, line).toBeGreaterThan(0);
          expect(seen.has(word), `duplicate ${word}`).toBe(false);
          seen.add(word);
        }
      }
      expect(seen.size).toBe(getClueBank(L, 'es').size);
    });

    it(`builds a well-connected ${L}-letter graph`, () => {
      expect(getGraph(L, 'es').starts.length).toBeGreaterThan(500);
    });

    it(`has well-formed ${L}-letter end pairs from the clued vocabulary`, () => {
      const bank = getClueBank(L, 'es');
      const pairs = getPairs(L, 'es');
      expect(pairs.length).toBe(PAIRS[L].split('\n').filter((l) => l.trim()).length);
      expect(pairs.length).toBeGreaterThanOrEqual(MIN_PAIRS);
      const seen = new Set<string>();
      for (const { top, bottom, clue } of pairs) {
        expect(top).not.toBe(bottom);
        expect(bank.has(top), `${top} needs vocabulary clues`).toBe(true);
        expect(bank.has(bottom), `${bottom} needs vocabulary clues`).toBe(true);
        const key = [top, bottom].sort().join('|');
        expect(seen.has(key), `duplicate pair ${key}`).toBe(false);
        seen.add(key);
        expect(clue.trim().length).toBeGreaterThan(5);
        const up = plain(clue);
        expect(up.includes(top) || up.includes(bottom), `${top}/${bottom}: ${clue}`).toBe(false);
      }
    });

    it(`only lists ${L}-letter end pairs that admit a valid ladder`, () => {
      const g = getGraph(L, 'es');
      const pairs = getPairs(L, 'es');
      const infeasible = pairs.filter((p) => !findPairLadder(g, g.index.get(p.top)!, g.index.get(p.bottom)!, null, 1_000_000));
      console.info(`crossclimb (es): ${pairs.length - infeasible.length}/${pairs.length} feasible ${L}-letter end pairs`);
      expect(infeasible.map((p) => `${p.top}/${p.bottom}`)).toEqual([]);
      expect(pairs.length - infeasible.length).toBeGreaterThanOrEqual(MIN_PAIRS);
    });
  }
});

describe('crossclimb spanish generator', () => {
  for (const L of LENGTHS) {
    it(`is deterministic for a fixed seed (${L} letters)`, () => {
      expect(generateLadder(12345, L, 'es')).toEqual(generateLadder(12345, L, 'es'));
      expect(generateLadder(777, L, 'es')).toEqual(generateLadder(777, L, 'es'));
      expect(generateLadder(1, L, 'es').words).not.toEqual(generateLadder(2, L, 'es').words);
    });

    it(`keeps English ladders unchanged by default (${L} letters)`, () => {
      expect(generateLadder(4242, L)).toEqual(generateLadder(4242, L, 'en'));
      expect(generateLadder(4242, L, 'es').words).not.toEqual(generateLadder(4242, L, 'en').words);
    });

    it(`produces valid, uniquely ordered Spanish ladders between an end pair quickly (${L} letters)`, () => {
      const bank = getClueBank(L, 'es');
      const pairs = new Map(getPairs(L, 'es').map((p) => [`${p.top}|${p.bottom}`, p.clue]));
      getGraph(L, 'es'); // build once so timing measures generation
      let worst = 0;
      let total = 0;
      const seeds = 60;
      for (let s = 1; s <= seeds; s++) {
        const seed = s * 7919 + L;
        const t0 = performance.now();
        const lad = generateLadder(seed, L, 'es');
        const dt = performance.now() - t0;
        worst = Math.max(worst, dt);
        total += dt;

        const { words, clues, order, endClue } = lad;
        expect(words).toHaveLength(7);
        expect(new Set(words).size).toBe(7);
        expect(isLadder(words)).toBe(true);
        expect(pairs.get(`${words[0]}|${words[6]}`)).toBe(endClue);
        expect(clues[0]).toBe(endClue);
        expect(clues[6]).toBe(endClue);
        words.forEach((w, i) => {
          expect(w).toMatch(new RegExp(`^[A-ZÑ]{${L}}$`));
          if (i > 0 && i < 6) expect(bank.get(w)).toContain(clues[i]);
        });
        const mids = words.slice(1, 6);
        expect(countLadderOrders(mids)).toBe(2);
        mids.forEach((m, i) => {
          expect(oneApart(words[0], m)).toBe(i === 0);
          expect(oneApart(words[6], m)).toBe(i === 4);
        });
        expect(oneApart(words[0], words[6])).toBe(false);
        expect(countLadderOrders(words)).toBe(2);
        expect([...order].sort()).toEqual([1, 2, 3, 4, 5]);
        expect(isLadder(order.map((i) => words[i]))).toBe(false);
        expect(goodLinks(order)).toBeLessThanOrEqual(1);
        const positions = new Set<number>();
        for (let i = 1; i < 7; i++) for (let p = 0; p < L; p++) if (words[i][p] !== words[i - 1][p]) positions.add(p);
        expect(positions.size).toBeGreaterThanOrEqual(3);
      }
      expect(total / seeds).toBeLessThan(10);
      expect(worst).toBeLessThan(50);
    });

    it(`reaches a wide variety of Spanish words and end pairs (${L} letters)`, () => {
      const used = new Set<string>();
      const ends = new Set<string>();
      for (let s = 1; s <= 150; s++) {
        const lad = generateLadder(s * 31 + 5, L, 'es');
        lad.words.forEach((w) => used.add(w));
        ends.add(`${lad.words[0]}|${lad.words[6]}`);
      }
      console.info(`crossclimb (es): ${used.size} words and ${ends.size} end pairs in 150 ${L}-letter ladders`);
      expect(used.size).toBeGreaterThan(L === 4 ? 300 : 200);
      expect(ends.size).toBeGreaterThan(L === 4 ? 60 : 50);
    });
  }
});

describe('crossclimb physical keys', () => {
  it('maps accented letters to their base letter and keeps Ñ for Spanish only', () => {
    expect(keyToLetter('a', 'en')).toBe('A');
    expect(keyToLetter('á', 'es')).toBe('A');
    expect(keyToLetter('É', 'en')).toBe('E');
    expect(keyToLetter('ü', 'es')).toBe('U');
    expect(keyToLetter('ñ', 'es')).toBe('Ñ');
    expect(keyToLetter('Ñ', 'es')).toBe('Ñ');
    expect(keyToLetter('n\u0303', 'es')).toBe('Ñ');
    expect(keyToLetter('ñ', 'en')).toBeNull();
    expect(keyToLetter('1', 'es')).toBeNull();
    expect(keyToLetter('Enter', 'es')).toBeNull();
    expect(keyToLetter(' ', 'es')).toBeNull();
  });
});
