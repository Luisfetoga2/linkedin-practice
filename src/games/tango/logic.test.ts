import { describe, expect, it } from 'vitest';
import {
  CELLS,
  LINES,
  countSolutions,
  findDeduction,
  findViolations,
  generateTango,
  makeCtx,
  solveLogic,
  type Difficulty,
} from './logic';

const DIFFS: Difficulty[] = ['easy', 'medium', 'hard'];
const SEEDS = Array.from({ length: 30 }, (_, i) => i * 7919 + 1);

describe('tango generator', () => {
  it('is deterministic for a seed', () => {
    for (const d of DIFFS) {
      expect(generateTango(12345, d)).toEqual(generateTango(12345, d));
    }
    expect(generateTango(1, 'medium')).not.toEqual(generateTango(2, 'medium'));
  });

  for (const d of DIFFS) {
    it(`${d}: valid, unique, logically solvable, fast`, () => {
      const times: number[] = [];
      for (const seed of SEEDS) {
        const t0 = performance.now();
        const p = generateTango(seed, d);
        times.push(performance.now() - t0);

        // Solution obeys every rule.
        expect(p.solution.every((v) => v === 1 || v === 2)).toBe(true);
        expect(findViolations(p.solution, p.signs)).toEqual([]);
        for (const line of LINES) expect(line.filter((c) => p.solution[c] === 1).length).toBe(3);
        // Givens and signs agree with it.
        p.givens.forEach((v, i) => v && expect(v).toBe(p.solution[i]));
        for (const s of p.signs) expect(p.solution[s.a] === p.solution[s.b]).toBe(s.eq);

        expect(countSolutions(p.givens, p.signs)).toBe(1);
        const ctx = makeCtx(p.signs);
        const report = solveLogic(p.givens, ctx, 3);
        expect(report.solved).toBe(true);
        expect(report.board).toEqual(p.solution);
        if (d === 'easy') expect(solveLogic(p.givens, ctx, 1).solved).toBe(true);
        if (d === 'medium') expect(solveLogic(p.givens, ctx, 1).solved).toBe(false);
        if (d === 'hard') expect(solveLogic(p.givens, ctx, 2).solved).toBe(false);
        expect(p.signs.length).toBeGreaterThan(0);
      }
      times.sort((a, b) => a - b);
      expect(times[Math.floor(times.length / 2)]).toBeLessThan(50);
      expect(times[times.length - 1]).toBeLessThan(250);
    });
  }

  it('harder levels use fewer givens', () => {
    const avg = (d: Difficulty) => SEEDS.reduce((s, seed) => s + generateTango(seed, d).givens.filter(Boolean).length, 0) / SEEDS.length;
    expect(avg('easy')).toBeGreaterThan(avg('medium'));
    expect(avg('medium')).toBeGreaterThan(avg('hard'));
  });
});

describe('tango deductions', () => {
  it('every hint step is consistent with the solution', () => {
    for (const seed of SEEDS.slice(0, 10)) {
      const p = generateTango(seed, 'hard');
      const ctx = makeCtx(p.signs);
      const board = p.givens.slice();
      for (let steps = 0; steps < CELLS; steps++) {
        const d = findDeduction(board, ctx, 3);
        if (!d) break;
        expect(d.value).toBe(p.solution[d.cell]);
        expect(d.message.length).toBeGreaterThan(10);
        board[d.cell] = d.value;
      }
      expect(board).toEqual(p.solution);
    }
  });

  it('detects rule violations', () => {
    const b = new Array(CELLS).fill(0);
    b[0] = b[1] = b[2] = 1;
    expect(findViolations(b, []).map((v) => v.kind)).toContain('triple');
    const c = new Array(CELLS).fill(0);
    c[0] = c[2] = c[4] = c[5] = 2;
    expect(findViolations(c, []).map((v) => v.kind)).toContain('count');
    const e = new Array(CELLS).fill(0);
    e[0] = 1;
    e[1] = 2;
    expect(findViolations(e, [{ a: 0, b: 1, eq: true }])[0].kind).toBe('eq');
    expect(findViolations(e, [{ a: 0, b: 1, eq: false }])).toEqual([]);
  });
});
