import { describe, expect, it } from 'vitest';
import { buildAdjacency, generateZip, solveZip, type ZipPuzzle } from './generator';

function checkSolution(p: ZipPuzzle) {
  const total = p.size * p.size;
  const adj = buildAdjacency(p.size, p.walls);
  expect(p.solution.length).toBe(total);
  expect(new Set(p.solution).size).toBe(total);
  for (let i = 0; i + 1 < total; i++) expect(adj[p.solution[i]]).toContain(p.solution[i + 1]);
  // Numbers appear in ascending order along the path, starting at 1 and ending at count.
  const seq = p.solution.map((c) => p.numbers[c]).filter(Boolean);
  expect(seq).toEqual(Array.from({ length: p.count }, (_, i) => i + 1));
  expect(p.numbers[p.solution[0]]).toBe(1);
  expect(p.numbers[p.solution[total - 1]]).toBe(p.count);
  // Walls are symmetric.
  for (let c = 0; c < total; c++) {
    for (const n of adj[c]) expect(adj[n]).toContain(c);
  }
}

describe('zip generator', () => {
  it('is deterministic for a fixed seed', () => {
    for (const size of [5, 7, 8]) {
      expect(generateZip(size, 12345)).toEqual(generateZip(size, 12345));
    }
    expect(generateZip(7, 1).solution).not.toEqual(generateZip(7, 2).solution);
  });

  for (const size of [5, 6, 7, 8]) {
    it(`produces valid, unique ${size}x${size} puzzles quickly`, () => {
      const times: number[] = [];
      for (let seed = 1; seed <= 30; seed++) {
        const t = performance.now();
        const p = generateZip(size, seed * 101);
        times.push(performance.now() - t);
        checkSolution(p);
        expect(p.count).toBeGreaterThanOrEqual(3);
        const res = solveZip(size, p.numbers, p.walls, 2, 5_000_000);
        expect(res.complete).toBe(true);
        expect(res.solutions).toHaveLength(1);
        expect(res.solutions[0]).toEqual(p.solution);
      }
      times.sort((a, b) => a - b);
      const median = times[Math.floor(times.length / 2)];
      expect(median).toBeLessThan(size === 8 ? 200 : 60);
    });
  }
});
