import { describe, expect, it } from 'vitest';
import { generate, type GenerateStats } from './generator';
import { findSolutions, isValidSolution } from './puzzle';
import { Solver } from './solver';

const SIZES = [6, 7, 8, 9, 10];
const SEEDS = Array.from({ length: 30 }, (_, i) => 1000 + i * 7919);

function connected(n: number, regions: number[], g: number): boolean {
  const cells = regions.map((r, i) => (r === g ? i : -1)).filter((i) => i >= 0);
  const seen = new Set([cells[0]]);
  const stack = [cells[0]];
  while (stack.length) {
    const c = stack.pop()!;
    const r = Math.floor(c / n);
    const col = c % n;
    for (const [dr, dc] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ]) {
      const rr = r + dr;
      const cc = col + dc;
      const nb = rr * n + cc;
      if (rr < 0 || rr >= n || cc < 0 || cc >= n || seen.has(nb) || regions[nb] !== g) continue;
      seen.add(nb);
      stack.push(nb);
    }
  }
  return seen.size === cells.length;
}

describe('queens generator', () => {
  it('is deterministic for a fixed seed', () => {
    for (const n of SIZES) {
      expect(generate(424242, n)).toEqual(generate(424242, n));
    }
    expect(generate(1, 8)).not.toEqual(generate(2, 8));
  });

  for (const n of SIZES) {
    it(`builds valid, unique, deduction-friendly ${n}×${n} puzzles quickly`, () => {
      const times: number[] = [];
      let worstAttempts = 0;
      for (const seed of SEEDS) {
        const stats: GenerateStats = { attempts: 0 };
        const t0 = performance.now();
        const p = generate(seed, n, stats);
        times.push(performance.now() - t0);
        worstAttempts = Math.max(worstAttempts, stats.attempts);
        expect(stats.attempts).toBeGreaterThan(0);
        expect(p.size).toBe(n);
        expect(p.regions).toHaveLength(n * n);
        // n regions, all connected, each containing exactly one solution queen
        expect(new Set(p.regions).size).toBe(n);
        for (let g = 0; g < n; g++) expect(connected(n, p.regions, g)).toBe(true);
        expect(isValidSolution(n, p.regions, p.solution)).toBe(true);
        const sols = findSolutions(n, p.regions, 2);
        expect(sols).toHaveLength(1);
        expect(sols[0]).toEqual(p.solution);
        const res = new Solver(n, p.regions).solve();
        expect(res.solved).toBe(true);
        const found = Array.from({ length: n }, (_, r) => {
          for (let c = 0; c < n; c++) if (res.state.queen[r * n + c]) return c;
          return -1;
        });
        expect(found).toEqual(p.solution);
      }
      times.sort((a, b) => a - b);
      const avg = times.reduce((a, b) => a + b, 0) / times.length;
      const p90 = times[Math.floor(times.length * 0.9)];
      console.log(`${n}x${n}: avg ${avg.toFixed(1)}ms p90 ${p90.toFixed(1)}ms max ${times[times.length - 1].toFixed(1)}ms, worst attempts ${worstAttempts}`);
      expect(avg).toBeLessThan(n >= 9 ? 250 : 150);
    });
  }
});
