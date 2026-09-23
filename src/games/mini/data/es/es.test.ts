import { describe, expect, it } from 'vitest';
import { checkPuzzle, generateMini } from '../../generator';
import { clueLeaksAnswer, foldAccents, parseEntries } from '../parse';
import { ENTRIES, MORE_CHUNKS, OWN_CHUNKS, SHARED_CHUNKS } from './index';

const WORD_RE = /^[A-ZÑ]{3,5}$/;

/** Raw `WORD|clue|clue` lines of some chunks (comments and blank lines skipped). */
function rawLines(chunks: readonly string[]): { word: string; clues: string[] }[] {
  return chunks
    .flatMap((text) => text.split('\n'))
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#'))
    .map((l) => {
      const [word, ...clues] = l.split('|');
      return { word, clues };
    });
}

describe('Spanish Mini vocabulary', () => {
  it('has clean words: 3–5 letters, A–Z plus Ñ, uppercase, no accents, no duplicates', () => {
    const seen = new Set<string>();
    for (const e of ENTRIES) {
      expect(e.word, e.word).toMatch(WORD_RE);
      expect(foldAccents(e.word)).toBe(e.word);
      expect(seen.has(e.word), `duplicate ${e.word}`).toBe(false);
      seen.add(e.word);
    }
  });

  it('every entry has at least one usable clue that does not give the answer away', () => {
    for (const e of ENTRIES) {
      expect(e.clues.length, e.word).toBeGreaterThan(0);
      for (const c of e.clues) {
        expect(c.trim(), e.word).toBe(c);
        expect(c.length, `${e.word}: "${c}"`).toBeGreaterThan(1);
        expect(c.includes('|'), `${e.word}: "${c}"`).toBe(false);
        expect(clueLeaksAnswer(e.word, c), `${e.word}: "${c}"`).toBe(false);
      }
      expect(new Set(e.clues).size, `repeated clue for ${e.word}`).toBe(e.clues.length);
    }
  });

  it('the Mini-only chunks parse without silently dropping anything', () => {
    const shared = new Set(rawLines(SHARED_CHUNKS).map((l) => l.word));
    const own = new Set<string>();
    for (const { word, clues } of rawLines(OWN_CHUNKS)) {
      expect(word, `bad word "${word}"`).toMatch(WORD_RE);
      expect(own.has(word) || shared.has(word), `${word} is listed twice`).toBe(false);
      own.add(word);
      expect(clues.length, word).toBeGreaterThan(0);
      for (const c of clues) {
        expect(c.trim().length, `${word}: empty clue`).toBeGreaterThan(1);
        expect(clueLeaksAnswer(word, c), `${word}: "${c}" contains the answer`).toBe(false);
      }
    }
  });

  it('the extra chunks only add clues: each word once, no clue already known for it, no leaks', () => {
    const before = new Map(
      parseEntries([...SHARED_CHUNKS, ...OWN_CHUNKS]).map((e) => [e.word, e.clues] as const),
    );
    const seen = new Set<string>();
    for (const { word, clues } of rawLines(MORE_CHUNKS)) {
      expect(word, `bad word "${word}"`).toMatch(WORD_RE);
      expect(seen.has(word), `${word} is listed twice in the extra chunks`).toBe(false);
      seen.add(word);
      expect(clues.length, word).toBeGreaterThan(0);
      if (!before.has(word)) expect(clues.length, `new word ${word}`).toBeGreaterThanOrEqual(3);
      for (const c of clues) {
        expect(c.trim().length, `${word}: empty clue`).toBeGreaterThan(1);
        expect(clueLeaksAnswer(word, c), `${word}: "${c}" contains the answer`).toBe(false);
        expect(before.get(word)?.includes(c.trim()) ?? false, `${word}: "${c}" is not new`).toBe(false);
      }
    }
  });

  it('gives every word at least two clues, so repeats across games are rarer', () => {
    for (const e of ENTRIES) expect(e.clues.length, e.word).toBeGreaterThanOrEqual(2);
  });

  it('is dense enough for 5×5 grids with few black squares', () => {
    const count = (n: number) => ENTRIES.filter((e) => e.word.length === n).length;
    expect(count(3)).toBeGreaterThanOrEqual(230);
    expect(count(4)).toBeGreaterThanOrEqual(1100);
    expect(count(5)).toBeGreaterThanOrEqual(3000);
  });

  it('fills valid puzzles quickly for 300 seeds per size', () => {
    for (const size of [4, 5] as const) {
      const t0 = performance.now();
      for (let seed = 1; seed <= 300; seed++) {
        const p = generateMini(seed, size, ENTRIES);
        expect(checkPuzzle(p, ENTRIES), `seed ${seed} size ${size}`).toEqual([]);
      }
      // Generous bound (typical is well under 1 ms per puzzle) so slow CI machines don't flake.
      expect((performance.now() - t0) / 300).toBeLessThan(50);
    }
  });
});
