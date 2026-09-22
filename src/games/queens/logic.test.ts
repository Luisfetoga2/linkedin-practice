import { describe, expect, it } from 'vitest';
import { cellsBetween, emptyBoard, isWin, nextValue, paint, setCell } from './board';
import { generate } from './generator';
import { CROSS, EMPTY, QUEEN, getHint } from './hints';
import { attacks } from './puzzle';
import { Solver } from './solver';

const puzzle = generate(777, 8);
const n = puzzle.size;
const solver = new Solver(n, puzzle.regions);
const solCell = (r: number) => r * n + puzzle.solution[r];
const wrongCell = (r: number) => r * n + ((puzzle.solution[r] + 3) % n);

describe('board', () => {
  it('cycles empty → ✕ → queen → empty', () => {
    expect(nextValue(EMPTY)).toBe(CROSS);
    expect(nextValue(CROSS)).toBe(QUEEN);
    expect(nextValue(QUEEN)).toBe(EMPTY);
  });

  it('auto-✕ marks attacked cells and removes them with the queen', () => {
    const q = solCell(0);
    let b = setCell(puzzle, emptyBoard(n), 5 * n + 5, CROSS, false); // manual ✕ stays
    b = setCell(puzzle, b, q, QUEEN, true);
    for (let i = 0; i < n * n; i++) {
      if (attacks(n, puzzle.regions, q, i)) expect(b.cells[i]).toBe(CROSS);
    }
    b = setCell(puzzle, b, q, EMPTY, true);
    expect(b.cells.filter((v) => v !== EMPTY)).toEqual([CROSS]);
    expect(b.cells[5 * n + 5]).toBe(CROSS);
  });

  it('keeps auto-✕s still covered by another queen', () => {
    let b = setCell(puzzle, emptyBoard(n), solCell(0), QUEEN, true);
    b = setCell(puzzle, b, solCell(2), QUEEN, true);
    b = setCell(puzzle, b, solCell(0), EMPTY, true);
    for (let i = 0; i < n * n; i++) {
      const want = attacks(n, puzzle.regions, solCell(2), i) ? CROSS : i === solCell(2) ? QUEEN : EMPTY;
      expect(b.cells[i]).toBe(want);
    }
  });

  it('drag paint adds and erases only ✕', () => {
    let b = setCell(puzzle, emptyBoard(n), 1, QUEEN, false);
    for (const c of cellsBetween(n, 0, n - 1)) b = paint(puzzle, b, c, 'add');
    expect(b.cells.slice(0, n)).toEqual([CROSS, QUEEN, ...new Array(n - 2).fill(CROSS)]);
    for (const c of cellsBetween(n, 0, n - 1)) b = paint(puzzle, b, c, 'erase');
    expect(b.cells.slice(0, n)).toEqual([EMPTY, QUEEN, ...new Array(n - 2).fill(EMPTY)]);
  });

  it('interpolates diagonal drags', () => {
    expect(cellsBetween(n, 0, 3 * n + 3)).toEqual([0, n + 1, 2 * n + 2, 3 * n + 3]);
  });

  it('detects a win only for the valid placement', () => {
    let b = emptyBoard(n);
    for (let r = 0; r < n - 1; r++) b = setCell(puzzle, b, solCell(r), QUEEN, false);
    expect(isWin(puzzle, b)).toBe(false);
    b = setCell(puzzle, b, solCell(n - 1), QUEEN, false);
    expect(isWin(puzzle, b)).toBe(true);
  });
});

describe('hints', () => {
  it('points out a misplaced queen first', () => {
    const b = setCell(puzzle, emptyBoard(n), wrongCell(0), QUEEN, false);
    const h = getHint(puzzle, solver, b.cells)!;
    expect(h.kind).toBe('wrong-queen');
    expect(h.targets).toEqual([wrongCell(0)]);
    expect(h.message).toBe('This queen is in the wrong place.');
  });

  it('points out an ✕ on a solution cell', () => {
    const b = setCell(puzzle, emptyBoard(n), solCell(3), CROSS, false);
    const h = getHint(puzzle, solver, b.cells)!;
    expect(h.kind).toBe('wrong-cross');
    expect(h.message).toBe('A queen belongs where you placed an ✕.');
  });

  it('solves every size by repeatedly applying hints, never touching solution cells with ✕', () => {
    for (const size of [6, 8, 10]) {
      for (const seed of [1, 2, 3, 4, 5]) {
        const p = generate(seed, size);
        const s = new Solver(size, p.regions);
        let b = emptyBoard(size);
        for (let guard = 0; guard < 400 && !isWin(p, b); guard++) {
          const h = getHint(p, s, b.cells);
          expect(h).not.toBeNull();
          expect(h!.kind).toBe('step');
          expect(h!.message.length).toBeGreaterThan(10);
          for (const t of h!.targets) {
            const isSol = p.solution[Math.floor(t / size)] === t % size;
            expect(isSol).toBe(h!.action === 'queen');
            b = setCell(p, b, t, h!.action === 'queen' ? QUEEN : CROSS, false);
          }
        }
        expect(isWin(p, b)).toBe(true);
      }
    }
  });
});
