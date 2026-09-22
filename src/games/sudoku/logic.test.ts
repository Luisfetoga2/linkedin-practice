import { describe, expect, it } from 'vitest';
import { CELLS, HOUSES, countSolutions, findConflicts, generateSudoku, nextPlacement, solveLogic, type Difficulty } from './logic';

const DIFFS: Difficulty[] = ['easy', 'medium', 'hard'];
const SEEDS = Array.from({ length: 30 }, (_, i) => i * 104729 + 3);
const RANGE: Record<Difficulty, [number, number]> = { easy: [16, 18], medium: [13, 15], hard: [10, 12] };

describe('mini sudoku generator', () => {
  it('is deterministic for a seed', () => {
    for (const d of DIFFS) expect(generateSudoku(4242, d)).toEqual(generateSudoku(4242, d));
    expect(generateSudoku(1, 'medium')).not.toEqual(generateSudoku(2, 'medium'));
  });

  for (const d of DIFFS) {
    it(`${d}: valid, unique, logically solvable, right clue count, fast`, () => {
      const times: number[] = [];
      for (const seed of SEEDS) {
        const t0 = performance.now();
        const p = generateSudoku(seed, d);
        times.push(performance.now() - t0);

        for (const h of HOUSES) expect(new Set(h.cells.map((c) => p.solution[c])).size).toBe(6);
        expect(p.solution.every((v) => v >= 1 && v <= 6)).toBe(true);
        p.givens.forEach((v, i) => v && expect(v).toBe(p.solution[i]));

        const n = p.givens.filter(Boolean).length;
        expect(n).toBeGreaterThanOrEqual(RANGE[d][0]);
        expect(n).toBeLessThanOrEqual(RANGE[d][1]);

        expect(countSolutions(p.givens)).toBe(1);
        const rep = solveLogic(p.givens, d === 'hard' ? 3 : 2);
        expect(rep.solved).toBe(true);
        expect(rep.values).toEqual(p.solution);
      }
      times.sort((a, b) => a - b);
      expect(times[Math.floor(times.length / 2)]).toBeLessThan(100);
      expect(times[times.length - 1]).toBeLessThan(300);
    });
  }

  it('hint steps always agree with the solution', () => {
    for (const seed of SEEDS.slice(0, 10)) {
      const p = generateSudoku(seed, 'hard');
      const values = p.givens.slice();
      for (let k = 0; k < CELLS; k++) {
        const next = nextPlacement(values);
        if (!next) break;
        expect(next.placement.digit).toBe(p.solution[next.placement.cell]);
        values[next.placement.cell] = next.placement.digit;
      }
      expect(values).toEqual(p.solution);
    }
  });

  it('finds conflicts', () => {
    const v = new Array(CELLS).fill(0);
    v[0] = 3;
    v[5] = 3;
    v[14] = 2;
    expect([...findConflicts(v)].sort((a, b) => a - b)).toEqual([0, 5]);
  });
});
