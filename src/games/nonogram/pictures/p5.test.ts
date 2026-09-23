import { describe, expect, it } from 'vitest';
import { lineSolve, runsOf } from '../logic';
import { PICTURES_5 } from './p5';

const N = 5;

function cluesOf(rows: string[]) {
  const grid = rows.map((r) => [...r].map((ch) => (ch === '#' ? 1 : 0)));
  return {
    grid,
    rows: grid.map((line) => runsOf(line)),
    cols: grid[0].map((_, c) => runsOf(grid.map((line) => line[c]))),
  };
}

describe('PICTURES_5', () => {
  it('has unique names and no duplicate or mirrored drawings', () => {
    const names = PICTURES_5.map((p) => p.name);
    expect(new Set(names).size).toBe(names.length);
    const seen = new Set<string>();
    for (const p of PICTURES_5) {
      const key = p.rows.join('/');
      const mirror = p.rows.map((r) => [...r].reverse().join('')).join('/');
      expect(seen.has(key), `${p.name} duplicates another picture`).toBe(false);
      expect(seen.has(mirror), `${p.name} mirrors another picture`).toBe(false);
      seen.add(key);
    }
  });

  for (const p of PICTURES_5) {
    it(`${p.name}: valid and line-solvable`, () => {
      expect(p.rows).toHaveLength(N);
      for (const r of p.rows) expect(r).toMatch(new RegExp(`^[#.]{${N}}$`));
      const { grid, rows, cols } = cluesOf(p.rows);
      const filled = grid.flat().reduce<number>((a, v) => a + v, 0) / (N * N);
      expect(filled).toBeGreaterThanOrEqual(0.3);
      expect(filled).toBeLessThanOrEqual(0.75);
      const known = lineSolve({ size: N, rows, cols });
      expect(known).not.toBeNull();
      expect(known!.join('')).toBe(grid.flat().join(''));
    });
  }
});
