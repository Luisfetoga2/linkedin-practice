import { describe, expect, it } from 'vitest';
import { generateNonogram, hintFor, isSolved, lineSolve, runsOf, solveLine, type Known } from './logic';

const u = (s: string): Known[] => [...s].map((ch) => (ch === '?' ? -1 : ch === '#' ? 1 : 0)) as Known[];
const show = (k: Known[] | null) => (k ? k.map((v) => (v === -1 ? '?' : v ? '#' : '.')).join('') : null);

describe('runsOf', () => {
  it('counts filled runs', () => {
    expect(runsOf([1, 1, 0, 1, 0, 0, 1, 1, 1])).toEqual([2, 1, 3]);
    expect(runsOf([0, 0, 0])).toEqual([]);
  });
});

describe('solveLine', () => {
  it('finds overlaps', () => {
    expect(show(solveLine([4], u('?????')))).toBe('?###?');
    expect(show(solveLine([2, 2], u('?????')))).toBe('##.##');
  });
  it('uses known cells', () => {
    expect(show(solveLine([1], u('?#???')))).toBe('.#...');
    expect(show(solveLine([3], u('????.')))).toBe('?##?.');
  });
  it('handles empty clues and contradictions', () => {
    expect(show(solveLine([], u('???')))).toBe('...');
    expect(solveLine([3], u('?.?.?'))).toBeNull();
  });
});

describe('generator', () => {
  it('is deterministic', () => {
    expect(generateNonogram(10, 42)).toEqual(generateNonogram(10, 42));
    expect(generateNonogram(10, 42).solution).not.toEqual(generateNonogram(10, 43).solution);
  });

  for (const n of [5, 10, 15]) {
    it(`makes line-solvable (hence unique) ${n}x${n} puzzles quickly`, () => {
      const t0 = performance.now();
      let worst = 0;
      for (let seed = 1; seed <= 25; seed++) {
        const s = performance.now();
        const p = generateNonogram(n, seed);
        worst = Math.max(worst, performance.now() - s);
        const known = lineSolve(p);
        expect(known).not.toBeNull();
        expect(known!.every((k, i) => k === p.solution[i])).toBe(true);
        expect(p.rows.every((r) => r.length > 0) && p.cols.every((c) => c.length > 0)).toBe(true);
      }
      const avg = (performance.now() - t0) / 25;
      expect(avg).toBeLessThan(n === 15 ? 80 : 20);
      expect(worst).toBeLessThan(n === 15 ? 400 : 100);
    });
  }
});

describe('hints', () => {
  it('points out mistakes first, then deduces, and a hinted game completes', () => {
    const p = generateNonogram(10, 7);
    const board = new Uint8Array(100);
    const wrong = p.solution.findIndex((v) => v === 0);
    board[wrong] = 1;
    expect(hintFor(p, board)).toMatchObject({ kind: 'mistake', cell: wrong });
    board[wrong] = 0;
    for (let guard = 0; guard < 200 && !isSolved(p, board); guard++) {
      const h = hintFor(p, board)!;
      expect(h.kind).toBe('deduce');
      expect(p.solution[h.cell]).toBe(h.value);
      board[h.cell] = h.value === 1 ? 1 : 2;
    }
    expect(isSolved(p, board)).toBe(true);
  });
});
