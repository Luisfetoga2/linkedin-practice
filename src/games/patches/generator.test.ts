import { describe, expect, it } from 'vitest';
import { countSolutions, fitsClue, generatePatches, logicSolve, rectContains, rectsOverlap, type PatchesPuzzle } from './generator';

function checkSolution(p: PatchesPuzzle) {
  const n = p.size;
  expect(p.solution).toHaveLength(p.clues.length);
  // Rectangles tile the grid exactly.
  const cover = new Array<number>(n * n).fill(0);
  p.solution.forEach((r) => {
    expect(r.r0).toBeGreaterThanOrEqual(0);
    expect(r.c1).toBeLessThan(n);
    for (let y = r.r0; y <= r.r1; y++) for (let x = r.c0; x <= r.c1; x++) cover[y * n + x]++;
  });
  expect(cover.every((v) => v === 1)).toBe(true);
  // Each patch holds exactly its own clue and satisfies it.
  p.solution.forEach((r, i) => {
    const inside = p.clues.filter((k) => rectContains(r, k.r, k.c));
    expect(inside).toEqual([p.clues[i]]);
    expect(fitsClue(r, p.clues[i])).toBe(true);
  });
  // Neighbouring patches get different colours.
  p.solution.forEach((a, i) =>
    p.solution.forEach((b, j) => {
      if (i >= j) return;
      const sharesEdge =
        (rectsOverlap({ ...a, r0: a.r0 - 1, r1: a.r1 + 1 }, b) && a.c0 <= b.c1 && b.c0 <= a.c1) ||
        (rectsOverlap({ ...a, c0: a.c0 - 1, c1: a.c1 + 1 }, b) && a.r0 <= b.r1 && b.r0 <= a.r1);
      if (sharesEdge) expect(p.clues[i].color).not.toBe(p.clues[j].color);
    }),
  );
}

describe('patches generator', () => {
  it('is deterministic for a fixed seed', () => {
    for (const size of [5, 6, 8]) expect(generatePatches(size, 987)).toEqual(generatePatches(size, 987));
    expect(generatePatches(6, 1)).not.toEqual(generatePatches(6, 2));
  });

  for (const size of [5, 6, 7, 8]) {
    it(`produces valid, unique, deducible ${size}x${size} boards quickly`, () => {
      const times: number[] = [];
      for (let seed = 1; seed <= 30; seed++) {
        const t = performance.now();
        const p = generatePatches(size, seed * 37);
        times.push(performance.now() - t);
        checkSolution(p);
        const { count, solutions } = countSolutions(size, p.clues, 2);
        expect(count).toBe(1);
        expect(solutions[0]).toEqual(p.solution);
        const logic = logicSolve(size, p.clues);
        expect(logic.solved).toBe(true);
        expect(logic.candidates.map((c) => c[0])).toEqual(p.solution);
      }
      times.sort((a, b) => a - b);
      expect(times[15]).toBeLessThan(50);
    });
  }

  it('logic solver respects fixed patches and reports steps', () => {
    const p = generatePatches(6, 5);
    const fixed = p.solution.map((r, i) => (i === 0 ? r : null));
    const res = logicSolve(6, p.clues, fixed);
    expect(res.solved).toBe(true);
    expect(res.steps.find((s) => s.clue === 0)).toBeUndefined();
    expect(res.steps).toHaveLength(p.clues.length - 1);
  });
});
