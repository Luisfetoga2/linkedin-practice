import { describe, expect, it } from 'vitest';
import { countTilings, generatePuzzle, hiddenWords, isValidWord, nextHint, SIZE_CONFIG, isAdjacent } from './generator';

const SIZES = [5, 6];

describe('wend generator', () => {
  it('is deterministic for a fixed seed', () => {
    for (const size of SIZES) {
      const a = generatePuzzle(12345, size);
      const b = generatePuzzle(12345, size);
      expect(a).toEqual(b);
      const c = generatePuzzle(12346, size);
      expect(c.letters.join('')).not.toEqual(a.letters.join(''));
    }
  });

  for (const size of SIZES) {
    it(`produces valid, uniquely tileable ${size}x${size} puzzles quickly`, () => {
      const cfg = SIZE_CONFIG[size];
      const times: number[] = [];
      for (let seed = 1; seed <= 30; seed++) {
        const t0 = performance.now();
        const p = generatePuzzle(seed * 101, size);
        times.push(performance.now() - t0);

        expect(p.size).toBe(size);
        expect(p.walls.filter(Boolean).length).toBe(cfg.walls);
        expect(p.words.map((w) => w.word.length)).toEqual(cfg.lengths);

        // Every open cell is covered exactly once, walls never.
        const cover = new Array(size * size).fill(0);
        for (const { word, path } of p.words) {
          expect(path.length).toBe(word.length);
          expect(hiddenWords(word.length)).toContain(word.toLowerCase());
          expect(isValidWord(word)).toBe(true);
          path.forEach((c, i) => {
            cover[c]++;
            expect(p.letters[c]).toBe(word[i]);
            if (i > 0) expect(isAdjacent(size, path[i - 1], c)).toBe(true);
          });
        }
        p.walls.forEach((isWall, i) => expect(cover[i]).toBe(isWall ? 0 : 1));
        expect(new Set(p.words.map((w) => w.word)).size).toBe(p.words.length);

        // Exactly one way to tile the grid with the hidden words.
        expect(countTilings(size, p.letters, p.words.map((w) => w.word), 2)).toBe(1);
      }
      times.sort((a, b) => a - b);
      const median = times[Math.floor(times.length / 2)];
      const max = times[times.length - 1];
      console.log(`size ${size}: median ${median.toFixed(1)}ms, max ${max.toFixed(1)}ms`);
      expect(median).toBeLessThan(150);
      expect(max).toBeLessThan(1000);
    });
  }
});

describe('wend word lists', () => {
  it('has plenty of words per length', () => {
    for (let L = 3; L <= 9; L++) expect(hiddenWords(L).length).toBeGreaterThan(200);
    expect(isValidWord('things')).toBe(true);
    expect(isValidWord('qzxv')).toBe(false);
  });
});

describe('wend hints', () => {
  it('reveals the shortest word tile by tile, then flags blocking words', () => {
    const p = generatePuzzle(777, 5);
    const revealed = p.words.map(() => 0);
    const h1 = nextHint(p, [], revealed);
    expect(h1).toEqual({ kind: 'reveal', w: 0, step: 0 });
    revealed[0] = p.words[0].word.length;
    expect(nextHint(p, [], revealed)).toEqual({ kind: 'reveal', w: 1, step: 0 });
    // Found the first word correctly: next unfound word is hinted.
    expect(nextHint(p, [{ w: 0, path: p.words[0].path }], p.words.map(() => 0))).toEqual({ kind: 'reveal', w: 1, step: 0 });
    // A found word on the wrong tiles is pointed out.
    const wrong = { w: 1, path: p.words[0].path.concat([-1]).slice(0, p.words[1].word.length) };
    expect(nextHint(p, [wrong], revealed).kind).toBe('blocking');
  });
});
