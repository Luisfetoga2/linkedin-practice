import { CROSS, EMPTY, QUEEN } from './hints';
import { attacks, findClashes, type Puzzle } from './puzzle';

export interface BoardState {
  /** EMPTY / CROSS / QUEEN per cell. */
  cells: number[];
  /** For auto-placed ✕: the queen cell that placed it, else -1. */
  owner: number[];
}

export function emptyBoard(n: number): BoardState {
  return { cells: new Array(n * n).fill(EMPTY), owner: new Array(n * n).fill(-1) };
}

export function isEmptyBoard(b: BoardState): boolean {
  return b.cells.every((v) => v === EMPTY);
}

/** Sets one cell, maintaining auto-✕ ownership. Returns a new state (or the same one if nothing changed). */
export function setCell(puzzle: Puzzle, b: BoardState, i: number, value: number, autoX: boolean): BoardState {
  const old = b.cells[i];
  if (old === value) return b;
  const n = puzzle.size;
  const cells = b.cells.slice();
  const owner = b.owner.slice();
  cells[i] = value;
  owner[i] = -1;
  if (old === QUEEN) {
    // Remove the ✕s this queen auto-placed, unless another queen still rules them out.
    const queens: number[] = [];
    for (let j = 0; j < cells.length; j++) if (cells[j] === QUEEN) queens.push(j);
    for (let j = 0; j < cells.length; j++) {
      if (owner[j] !== i) continue;
      owner[j] = -1;
      if (cells[j] !== CROSS) continue;
      const other = queens.find((q) => attacks(n, puzzle.regions, q, j));
      if (other !== undefined) owner[j] = other;
      else cells[j] = EMPTY;
    }
  }
  if (value === QUEEN && autoX) {
    for (let j = 0; j < cells.length; j++) {
      if (cells[j] === EMPTY && attacks(n, puzzle.regions, i, j)) {
        cells[j] = CROSS;
        owner[j] = i;
      }
    }
  }
  return { cells, owner };
}

/** Tap cycle: empty → ✕ → queen → empty. */
export function nextValue(v: number): number {
  return v === EMPTY ? CROSS : v === CROSS ? QUEEN : EMPTY;
}

/** Drag painting: 'add' turns empty cells into ✕, 'erase' clears ✕s. Queens are never touched. */
export function paint(puzzle: Puzzle, b: BoardState, i: number, mode: 'add' | 'erase'): BoardState {
  const v = b.cells[i];
  if (mode === 'add' && v === EMPTY) return setCell(puzzle, b, i, CROSS, false);
  if (mode === 'erase' && v === CROSS) return setCell(puzzle, b, i, EMPTY, false);
  return b;
}

export function queensOf(b: BoardState): number[] {
  const out: number[] = [];
  for (let i = 0; i < b.cells.length; i++) if (b.cells[i] === QUEEN) out.push(i);
  return out;
}

export function isWin(puzzle: Puzzle, b: BoardState): boolean {
  const qs = queensOf(b);
  if (qs.length !== puzzle.size) return false;
  return findClashes(puzzle.size, puzzle.regions, qs).queens.size === 0;
}

/** Cells on the straight line between two cells (inclusive), so fast drags don't skip any. */
export function cellsBetween(n: number, a: number, b: number): number[] {
  const r0 = Math.floor(a / n);
  const c0 = a % n;
  const r1 = Math.floor(b / n);
  const c1 = b % n;
  const steps = Math.max(Math.abs(r1 - r0), Math.abs(c1 - c0));
  const out: number[] = [];
  for (let s = 0; s <= steps; s++) {
    const t = steps === 0 ? 0 : s / steps;
    const cell = Math.round(r0 + (r1 - r0) * t) * n + Math.round(c0 + (c1 - c0) * t);
    if (out[out.length - 1] !== cell) out.push(cell);
  }
  return out;
}
