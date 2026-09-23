import { createRng, type Rng } from '../../lib/rng';
import type { Picture } from './pictures/types';

/** Cell knowledge: -1 unknown, 0 empty, 1 filled. */
export type Known = -1 | 0 | 1;

export interface NonogramPuzzle {
  size: number;
  /** Row-major solution, 1 = filled. */
  solution: Uint8Array;
  rows: number[][];
  cols: number[][];
  /** Name of the hand-drawn picture ("cat"), when the puzzle came from the library. */
  name?: string;
}

/** Run lengths of filled cells; an empty line has no runs (shown as "0"). */
export function runsOf(line: ArrayLike<number>): number[] {
  const out: number[] = [];
  let run = 0;
  for (let i = 0; i < line.length; i++) {
    if (line[i] === 1) run++;
    else if (run) {
      out.push(run);
      run = 0;
    }
  }
  if (run) out.push(run);
  return out;
}

export function rowOf(grid: ArrayLike<number>, n: number, r: number): number[] {
  return Array.from({ length: n }, (_, c) => grid[r * n + c]);
}

export function colOf(grid: ArrayLike<number>, n: number, c: number): number[] {
  return Array.from({ length: n }, (_, r) => grid[r * n + c]);
}

export function sameRuns(a: number[], b: number[]): boolean {
  return a.length === b.length && a.every((v, i) => v === b[i]);
}

/**
 * Exhaustive single-line deduction: which cells are filled / empty in EVERY arrangement of
 * `clue` consistent with `known`. Returns null when no arrangement fits (contradiction).
 */
export function solveLine(clue: number[], known: Known[]): Known[] | null {
  const L = known.length;
  const B = clue.length;
  const allowsEmpty = (i: number) => known[i] !== 1;
  const allowsFill = (i: number) => known[i] !== 0;
  // ok[b][p]: blocks b..B-1 fit in cells p..L-1 (p may be L).
  const ok: boolean[][] = Array.from({ length: B + 1 }, () => new Array<boolean>(L + 2).fill(false));
  ok[B][L] = true;
  ok[B][L + 1] = true;
  for (let p = L - 1; p >= 0; p--) ok[B][p] = ok[B][p + 1] && allowsEmpty(p);
  const blockFits = (b: number, p: number) => {
    const len = clue[b];
    if (p + len > L) return false;
    for (let i = p; i < p + len; i++) if (!allowsFill(i)) return false;
    return p + len === L || allowsEmpty(p + len);
  };
  for (let b = B - 1; b >= 0; b--) {
    for (let p = L; p >= 0; p--) {
      let v = false;
      if (p < L && allowsEmpty(p) && ok[b][p + 1]) v = true;
      if (!v && blockFits(b, p)) v = ok[b + 1][Math.min(L + 1, p + clue[b] + 1)];
      ok[b][p] = v;
    }
  }
  if (!ok[0][0]) return null;

  const canFill = new Array<boolean>(L).fill(false);
  const canEmpty = new Array<boolean>(L).fill(false);
  const seen: boolean[][] = Array.from({ length: B + 1 }, () => new Array<boolean>(L + 2).fill(false));
  const stack: [number, number][] = [[0, 0]];
  seen[0][0] = true;
  while (stack.length) {
    const [b, p] = stack.pop()!;
    if (b === B) {
      for (let i = p; i < L; i++) canEmpty[i] = true;
      continue;
    }
    if (p < L && allowsEmpty(p) && ok[b][p + 1]) {
      canEmpty[p] = true;
      if (!seen[b][p + 1]) {
        seen[b][p + 1] = true;
        stack.push([b, p + 1]);
      }
    }
    if (blockFits(b, p)) {
      const next = Math.min(L + 1, p + clue[b] + 1);
      if (ok[b + 1][next]) {
        for (let i = p; i < p + clue[b]; i++) canFill[i] = true;
        if (p + clue[b] < L) canEmpty[p + clue[b]] = true;
        if (!seen[b + 1][next]) {
          seen[b + 1][next] = true;
          stack.push([b + 1, next]);
        }
      }
    }
  }
  return known.map((k, i) => (k !== -1 ? k : canFill[i] && !canEmpty[i] ? 1 : !canFill[i] && canEmpty[i] ? 0 : -1)) as Known[];
}

export interface LineStep {
  kind: 'row' | 'col';
  index: number;
  /** Cells (row-major indices) newly determined, with their values. */
  cells: { cell: number; value: 0 | 1 }[];
}

/** First line (rows first, then columns) that yields a new deduction from `known`. */
export function nextLineStep(p: Pick<NonogramPuzzle, 'size' | 'rows' | 'cols'>, known: Known[]): LineStep | null {
  const n = p.size;
  for (const kind of ['row', 'col'] as const) {
    for (let i = 0; i < n; i++) {
      const idx = Array.from({ length: n }, (_, j) => (kind === 'row' ? i * n + j : j * n + i));
      const line = idx.map((c) => known[c]);
      const solved = solveLine(kind === 'row' ? p.rows[i] : p.cols[i], line);
      if (!solved) continue;
      const cells = idx.flatMap((c, j) => (line[j] === -1 && solved[j] !== -1 ? [{ cell: c, value: solved[j] as 0 | 1 }] : []));
      if (cells.length) return { kind, index: i, cells };
    }
  }
  return null;
}

/** Repeated line solving. Returns the final knowledge (fully solved iff no -1 remains). */
export function lineSolve(p: Pick<NonogramPuzzle, 'size' | 'rows' | 'cols'>, start?: Known[]): Known[] | null {
  const n = p.size;
  const known: Known[] = start ? start.slice() : new Array<Known>(n * n).fill(-1);
  const dirtyRows = new Array<boolean>(n).fill(true);
  const dirtyCols = new Array<boolean>(n).fill(true);
  let progress = true;
  while (progress) {
    progress = false;
    for (let r = 0; r < n; r++) {
      if (!dirtyRows[r]) continue;
      dirtyRows[r] = false;
      const line = known.slice(r * n, r * n + n);
      const out = solveLine(p.rows[r], line);
      if (!out) return null;
      for (let c = 0; c < n; c++) {
        if (line[c] === -1 && out[c] !== -1) {
          known[r * n + c] = out[c];
          dirtyCols[c] = true;
          progress = true;
        }
      }
    }
    for (let c = 0; c < n; c++) {
      if (!dirtyCols[c]) continue;
      dirtyCols[c] = false;
      const line = Array.from({ length: n }, (_, r) => known[r * n + c]);
      const out = solveLine(p.cols[c], line);
      if (!out) return null;
      for (let r = 0; r < n; r++) {
        if (line[r] === -1 && out[r] !== -1) {
          known[r * n + c] = out[r];
          dirtyRows[r] = true;
          progress = true;
        }
      }
    }
  }
  return known;
}

function cluesFor(solution: Uint8Array, n: number) {
  return {
    rows: Array.from({ length: n }, (_, r) => runsOf(rowOf(solution, n, r))),
    cols: Array.from({ length: n }, (_, c) => runsOf(colOf(solution, n, c))),
  };
}

/** Random blobby picture: noise smoothed by a majority filter, so shapes look drawn, not static. */
function randomPicture(n: number, rng: Rng): Uint8Array {
  const density = n <= 5 ? 0.6 : 0.56;
  let g = new Uint8Array(n * n);
  for (let i = 0; i < n * n; i++) g[i] = rng.chance(density) ? 1 : 0;
  if (n > 5) {
    const next = new Uint8Array(n * n);
    for (let r = 0; r < n; r++) {
      for (let c = 0; c < n; c++) {
        let on = 0;
        let tot = 0;
        for (let dr = -1; dr <= 1; dr++) {
          for (let dc = -1; dc <= 1; dc++) {
            const rr = r + dr;
            const cc = c + dc;
            if (rr < 0 || cc < 0 || rr >= n || cc >= n) continue;
            tot++;
            on += g[rr * n + cc];
          }
        }
        const ratio = on / tot;
        next[r * n + c] = ratio > 0.5 ? 1 : ratio < 0.5 ? 0 : g[r * n + c];
      }
    }
    g = next;
  }
  return g;
}

export function pictureGrid(pic: Picture, mirror: boolean): Uint8Array {
  const n = pic.rows.length;
  const g = new Uint8Array(n * n);
  pic.rows.forEach((row, r) => {
    for (let c = 0; c < n; c++) g[r * n + c] = row[mirror ? n - 1 - c : c] === '#' ? 1 : 0;
  });
  return g;
}

/** True when pure line logic fully solves `solution` (which also proves it's the only solution). */
export function isLineSolvable(solution: Uint8Array, n: number): boolean {
  const known = lineSolve({ size: n, ...cluesFor(solution, n) });
  return !!known && known.every((k) => k !== -1);
}

/**
 * Deterministic generator. With a picture library, the seed picks a hand-drawn picture (sometimes
 * mirrored, when the mirror is still line-solvable). Without one, a random blobby picture is used.
 */
export function generateNonogram(n: number, seed: number, pictures?: readonly Picture[]): NonogramPuzzle {
  const usable = pictures?.filter((p) => p.rows.length === n) ?? [];
  if (usable.length) {
    const rng = createRng(seed * 104729 + n);
    const pic = rng.pick(usable);
    let solution = pictureGrid(pic, rng.chance(0.5));
    if (!isLineSolvable(solution, n)) solution = pictureGrid(pic, false);
    return { size: n, solution, ...cluesFor(solution, n), name: pic.name };
  }
  return randomNonogram(n, seed);
}

/**
 * Random fallback. A picture is accepted only when pure line logic solves it, which also proves
 * the solution is unique. Stuck pictures are repaired by flipping an undetermined cell.
 */
function randomNonogram(n: number, seed: number): NonogramPuzzle {
  const rng = createRng(seed * 7919 + n);
  for (let attempt = 0; attempt < 400; attempt++) {
    const solution = randomPicture(n, rng);
    for (let repair = 0; repair < n * 3; repair++) {
      const filled = solution.reduce((a, v) => a + v, 0);
      if (filled < n * n * 0.35 || filled > n * n * 0.75) break;
      const { rows, cols } = cluesFor(solution, n);
      if (rows.some((r) => r.length === 0) || cols.some((c) => c.length === 0)) break;
      const known = lineSolve({ size: n, rows, cols });
      if (!known) break;
      const unknown: number[] = [];
      known.forEach((k, i) => k === -1 && unknown.push(i));
      if (!unknown.length) return { size: n, solution, rows, cols };
      const flip = rng.pick(unknown);
      solution[flip] ^= 1;
    }
  }
  throw new Error('nonogram generation failed');
}

export interface NonogramHint {
  kind: 'mistake' | 'deduce' | 'reveal';
  cell: number;
  value: 0 | 1;
  line?: { kind: 'row' | 'col'; index: number };
  message: string;
}

/** Board states: 0 empty, 1 filled, 2 crossed. */
export function hintFor(p: NonogramPuzzle, board: ArrayLike<number>): NonogramHint | null {
  const n = p.size;
  for (let i = 0; i < n * n; i++) {
    if (board[i] === 1 && !p.solution[i]) return { kind: 'mistake', cell: i, value: 0, message: 'This square shouldn’t be filled.' };
    if (board[i] === 2 && p.solution[i]) return { kind: 'mistake', cell: i, value: 1, message: 'This square should be filled, not crossed out.' };
  }
  const known: Known[] = Array.from(board, (v) => (v === 1 ? 1 : v === 2 ? 0 : -1)) as Known[];
  const step = nextLineStep(p, known);
  if (step) {
    const pick = step.cells.find((c) => c.value === 1) ?? step.cells[0];
    const clue = (step.kind === 'row' ? p.rows : p.cols)[step.index];
    const name = `${step.kind === 'row' ? 'Row' : 'Column'} ${step.index + 1}`;
    return {
      kind: 'deduce',
      cell: pick.cell,
      value: pick.value,
      line: { kind: step.kind, index: step.index },
      message: `${name} (${clue.join(' ') || '0'}) ${pick.value === 1 ? 'must fill' : 'can’t use'} this square${pick.value === 1 ? '' : ', so it gets an ✕'}.`,
    };
  }
  const missing = Array.from({ length: n * n }, (_, i) => i).find((i) => p.solution[i] && board[i] !== 1);
  if (missing === undefined) return null;
  return { kind: 'reveal', cell: missing, value: 1, message: 'This square is filled.' };
}

export function isSolved(p: NonogramPuzzle, board: ArrayLike<number>): boolean {
  for (let i = 0; i < p.size * p.size; i++) if ((board[i] === 1) !== (p.solution[i] === 1)) return false;
  return true;
}
