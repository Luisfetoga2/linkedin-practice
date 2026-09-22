import { createRng, type Rng } from '../../lib/rng';

export const N = 6;
export const CELLS = N * N;
/** Boxes are 2 rows × 3 columns. */
export const BOX_H = 2;
export const BOX_W = 3;
export const ALL = (1 << N) - 1; // candidate bitmask, bit d-1 = digit d

export type Difficulty = 'easy' | 'medium' | 'hard';

export interface SudokuPuzzle {
  solution: number[];
  /** 0 = empty. */
  givens: number[];
  difficulty: Difficulty;
}

export const rowOf = (i: number) => Math.floor(i / N);
export const colOf = (i: number) => i % N;
export const boxOf = (i: number) => Math.floor(rowOf(i) / BOX_H) * (N / BOX_W) + Math.floor(colOf(i) / BOX_W);

export type HouseKind = 'row' | 'column' | 'box';
export interface House {
  kind: HouseKind;
  cells: number[];
}

/** 18 houses: rows 0-5, columns 6-11, boxes 12-17. */
export const HOUSES: House[] = [];
for (let r = 0; r < N; r++) HOUSES.push({ kind: 'row', cells: Array.from({ length: N }, (_, c) => r * N + c) });
for (let c = 0; c < N; c++) HOUSES.push({ kind: 'column', cells: Array.from({ length: N }, (_, r) => r * N + c) });
for (let b = 0; b < N; b++) HOUSES.push({ kind: 'box', cells: Array.from({ length: CELLS }, (_, i) => i).filter((i) => boxOf(i) === b) });

export const PEERS: number[][] = Array.from({ length: CELLS }, (_, i) =>
  Array.from({ length: CELLS }, (_, j) => j).filter(
    (j) => j !== i && (rowOf(j) === rowOf(i) || colOf(j) === colOf(i) || boxOf(j) === boxOf(i)),
  ),
);

/** Houses (indexes into HOUSES) a cell belongs to: [row, column, box]. */
export const cellHouses = (i: number) => [rowOf(i), N + colOf(i), 2 * N + boxOf(i)];

const bit = (d: number) => 1 << (d - 1);
const popcount = (x: number) => {
  let n = 0;
  while (x) {
    x &= x - 1;
    n++;
  }
  return n;
};
const digitsOf = (mask: number) => {
  const out: number[] = [];
  for (let d = 1; d <= N; d++) if (mask & bit(d)) out.push(d);
  return out;
};
const onlyDigit = (mask: number) => digitsOf(mask)[0];

/** Cells whose digit also appears in one of their houses. */
export function findConflicts(values: ArrayLike<number>): Set<number> {
  const out = new Set<number>();
  for (const h of HOUSES) {
    for (let a = 0; a < N; a++) {
      const va = values[h.cells[a]];
      if (!va) continue;
      for (let b = a + 1; b < N; b++) {
        if (values[h.cells[b]] === va) {
          out.add(h.cells[a]);
          out.add(h.cells[b]);
        }
      }
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Brute-force solver
// ---------------------------------------------------------------------------

export function countSolutions(givens: ArrayLike<number>, limit = 2): number {
  const v = Array.from(givens);
  let count = 0;
  const rec = () => {
    if (count >= limit) return;
    let best = -1;
    let bestMask = 0;
    let bestCount = 99;
    for (let i = 0; i < CELLS; i++) {
      if (v[i]) continue;
      let used = 0;
      for (const p of PEERS[i]) if (v[p]) used |= bit(v[p]);
      const mask = ALL & ~used;
      const c = popcount(mask);
      if (c < bestCount) {
        best = i;
        bestMask = mask;
        bestCount = c;
        if (c <= 1) break;
      }
    }
    if (best < 0) {
      count++;
      return;
    }
    for (const d of digitsOf(bestMask)) {
      v[best] = d;
      rec();
      v[best] = 0;
      if (count >= limit) return;
    }
  };
  rec();
  return count;
}

function randomGrid(rng: Rng): number[] {
  // Seed the first row with a shuffled permutation, then fill the rest by randomized backtracking.
  const v = new Array(CELLS).fill(0);
  rng.shuffle([1, 2, 3, 4, 5, 6]).forEach((d, c) => (v[c] = d));
  const rec = (i: number): boolean => {
    if (i === CELLS) return true;
    let used = 0;
    for (const p of PEERS[i]) if (v[p]) used |= bit(v[p]);
    for (const d of rng.shuffle(digitsOf(ALL & ~used))) {
      v[i] = d;
      if (rec(i + 1)) return true;
    }
    v[i] = 0;
    return false;
  };
  rec(N);
  return v;
}

// ---------------------------------------------------------------------------
// Logic solver (human techniques)
// ---------------------------------------------------------------------------

export type Technique = 'fullHouse' | 'nakedSingle' | 'hiddenSingle' | 'pointing' | 'claiming' | 'nakedPair' | 'hiddenPair';

/** 1 = obvious singles, 2 = hidden singles, 3 = candidate eliminations. */
export const RANK: Record<Technique, 1 | 2 | 3> = {
  fullHouse: 1,
  nakedSingle: 1,
  hiddenSingle: 2,
  pointing: 3,
  claiming: 3,
  nakedPair: 3,
  hiddenPair: 3,
};

export interface Placement {
  type: 'place';
  cell: number;
  digit: number;
  technique: Technique;
  /** House index that explains the placement (for highlighting), if any. */
  house: number | null;
  message: string;
}

export interface Elimination {
  type: 'eliminate';
  technique: Technique;
  /** [cell, mask of digits removed] */
  removals: [number, number][];
  /** Cells forming the pattern (pair cells, pointing cells). */
  pattern: number[];
  house: number;
  message: string;
}

export type Step = Placement | Elimination;

const houseName = (h: number) => HOUSES[h].kind;

/** Candidate masks for the given values, with any extra eliminations applied. */
export function candidates(values: ArrayLike<number>, eliminated?: number[]): number[] {
  const cand = new Array(CELLS).fill(0);
  for (let i = 0; i < CELLS; i++) {
    if (values[i]) continue;
    let used = 0;
    for (const p of PEERS[i]) if (values[p]) used |= bit(values[p]);
    cand[i] = ALL & ~used & ~(eliminated?.[i] ?? 0);
  }
  return cand;
}

function findPlacement(values: ArrayLike<number>, cand: number[], maxRank: number): Placement | null {
  // Full house: last empty cell in a house.
  for (let h = 0; h < HOUSES.length; h++) {
    const empty = HOUSES[h].cells.filter((c) => !values[c]);
    if (empty.length !== 1 || popcount(cand[empty[0]]) !== 1) continue;
    const digit = onlyDigit(cand[empty[0]]);
    return {
      type: 'place',
      cell: empty[0],
      digit,
      technique: 'fullHouse',
      house: h,
      message: `This is the last empty cell in the highlighted ${houseName(h)}, so it must be ${digit}.`,
    };
  }
  // Naked single.
  for (let i = 0; i < CELLS; i++) {
    if (values[i] || popcount(cand[i]) !== 1) continue;
    const digit = onlyDigit(cand[i]);
    return {
      type: 'place',
      cell: i,
      digit,
      technique: 'nakedSingle',
      house: null,
      message: `The row, column and box of this cell already rule out every number except ${digit}.`,
    };
  }
  if (maxRank < 2) return null;
  // Hidden single: boxes first (most natural to spot), then rows, then columns.
  const order = [...HOUSES.keys()].sort((a, b) => (HOUSES[a].kind === 'box' ? -1 : 0) - (HOUSES[b].kind === 'box' ? -1 : 0));
  for (const h of order) {
    for (let d = 1; d <= N; d++) {
      const cells = HOUSES[h].cells;
      if (cells.some((c) => values[c] === d)) continue;
      const spots = cells.filter((c) => !values[c] && cand[c] & bit(d));
      if (spots.length !== 1) continue;
      return {
        type: 'place',
        cell: spots[0],
        digit: d,
        technique: 'hiddenSingle',
        house: h,
        message: `${d} can only go in this cell in the highlighted ${houseName(h)}.`,
      };
    }
  }
  return null;
}

function findElimination(values: ArrayLike<number>, cand: number[]): Elimination | null {
  // Pointing (box → line) and claiming (line → box).
  for (let b = 2 * N; b < 3 * N; b++) {
    for (let d = 1; d <= N; d++) {
      const spots = HOUSES[b].cells.filter((c) => !values[c] && cand[c] & bit(d));
      if (spots.length < 2) continue;
      for (const [kind, key] of [
        ['row', rowOf],
        ['column', colOf],
      ] as const) {
        if (!spots.every((c) => key(c) === key(spots[0]))) continue;
        const line = kind === 'row' ? rowOf(spots[0]) : N + colOf(spots[0]);
        const removals: [number, number][] = HOUSES[line].cells
          .filter((c) => boxOf(c) !== b - 2 * N && !values[c] && cand[c] & bit(d))
          .map((c) => [c, bit(d)]);
        if (!removals.length) continue;
        return {
          type: 'eliminate',
          technique: 'pointing',
          removals,
          pattern: spots,
          house: b,
          message: `In the highlighted box, ${d} must go in this ${kind}, so it can't go anywhere else in the ${kind}.`,
        };
      }
    }
  }
  for (let l = 0; l < 2 * N; l++) {
    for (let d = 1; d <= N; d++) {
      const spots = HOUSES[l].cells.filter((c) => !values[c] && cand[c] & bit(d));
      if (spots.length < 2 || !spots.every((c) => boxOf(c) === boxOf(spots[0]))) continue;
      const box = 2 * N + boxOf(spots[0]);
      const removals: [number, number][] = HOUSES[box].cells
        .filter((c) => !HOUSES[l].cells.includes(c) && !values[c] && cand[c] & bit(d))
        .map((c) => [c, bit(d)]);
      if (!removals.length) continue;
      return {
        type: 'eliminate',
        technique: 'claiming',
        removals,
        pattern: spots,
        house: l,
        message: `In the highlighted ${houseName(l)}, ${d} must go inside one box, so it can't go anywhere else in that box.`,
      };
    }
  }
  // Naked pairs.
  for (let h = 0; h < HOUSES.length; h++) {
    const cells = HOUSES[h].cells.filter((c) => !values[c]);
    for (let a = 0; a < cells.length; a++) {
      const m = cand[cells[a]];
      if (popcount(m) !== 2) continue;
      for (let b = a + 1; b < cells.length; b++) {
        if (cand[cells[b]] !== m) continue;
        const removals: [number, number][] = cells
          .filter((c) => c !== cells[a] && c !== cells[b] && cand[c] & m)
          .map((c) => [c, cand[c] & m]);
        if (!removals.length) continue;
        const [x, y] = digitsOf(m);
        return {
          type: 'eliminate',
          technique: 'nakedPair',
          removals,
          pattern: [cells[a], cells[b]],
          house: h,
          message: `The two highlighted cells can only be ${x} or ${y}, so no other cell in the ${houseName(h)} can be ${x} or ${y}.`,
        };
      }
    }
  }
  // Hidden pairs.
  for (let h = 0; h < HOUSES.length; h++) {
    const cells = HOUSES[h].cells;
    const where = (d: number) => cells.filter((c) => !values[c] && cand[c] & bit(d));
    for (let x = 1; x <= N; x++) {
      const wx = where(x);
      if (wx.length !== 2) continue;
      for (let y = x + 1; y <= N; y++) {
        const wy = where(y);
        if (wy.length !== 2 || wy[0] !== wx[0] || wy[1] !== wx[1]) continue;
        const keep = bit(x) | bit(y);
        const removals: [number, number][] = wx.filter((c) => cand[c] & ~keep).map((c) => [c, cand[c] & ~keep]);
        if (!removals.length) continue;
        return {
          type: 'eliminate',
          technique: 'hiddenPair',
          removals,
          pattern: wx,
          house: h,
          message: `In the highlighted ${houseName(h)}, ${x} and ${y} can only go in these two cells, so nothing else fits there.`,
        };
      }
    }
  }
  return null;
}

/** Next step: placements first (by rank), then eliminations when allowed. */
export function findStep(values: ArrayLike<number>, cand: number[], maxRank: 1 | 2 | 3 = 3): Step | null {
  return findPlacement(values, cand, maxRank) ?? (maxRank >= 3 ? findElimination(values, cand) : null);
}

export interface SolveReport {
  solved: boolean;
  values: number[];
  maxRank: number;
  uses: Record<number, number>;
}

export function solveLogic(givens: ArrayLike<number>, maxRank: 1 | 2 | 3 = 3): SolveReport {
  const values = Array.from(givens);
  const eliminated = new Array(CELLS).fill(0);
  const uses: Record<number, number> = { 1: 0, 2: 0, 3: 0 };
  let top = 0;
  for (let guard = 0; guard < 500; guard++) {
    const cand = candidates(values, eliminated);
    if (values.some((v, i) => !v && !cand[i])) break; // contradiction
    const step = findStep(values, cand, maxRank);
    if (!step) break;
    const rank = RANK[step.technique];
    uses[rank]++;
    top = Math.max(top, rank);
    if (step.type === 'place') values[step.cell] = step.digit;
    else for (const [c, m] of step.removals) eliminated[c] |= m;
  }
  const solved = values.every(Boolean) && findConflicts(values).size === 0;
  return { solved, values, maxRank: top, uses };
}

/**
 * Hint helper: the next placement, running eliminations on a scratch candidate grid if singles
 * alone don't suffice. Returns the placement and the first elimination used (for the explanation).
 */
export function nextPlacement(values: ArrayLike<number>): { placement: Placement; via: Elimination | null } | null {
  const eliminated = new Array(CELLS).fill(0);
  let via: Elimination | null = null;
  for (let guard = 0; guard < 100; guard++) {
    const cand = candidates(values, eliminated);
    const step = findStep(values, cand, 3);
    if (!step) return null;
    if (step.type === 'place') return { placement: step, via };
    via ??= step;
    for (const [c, m] of step.removals) eliminated[c] |= m;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Generator
// ---------------------------------------------------------------------------

interface DiffCfg {
  givens: [number, number];
  maxRank: 1 | 2 | 3;
  /** Prefer puzzles whose hardest step reaches this rank. */
  wantRank: number;
  /** Pick the removal that makes the puzzle hardest (instead of the first that works). */
  greedy: boolean;
}

const CONFIG: Record<Difficulty, DiffCfg> = {
  easy: { givens: [16, 18], maxRank: 2, wantRank: 1, greedy: false },
  medium: { givens: [13, 15], maxRank: 2, wantRank: 2, greedy: true },
  hard: { givens: [10, 12], maxRank: 3, wantRank: 3, greedy: true },
};

const difficultyScore = (rep: SolveReport) => rep.maxRank * 1000 + rep.uses[3] * 30 + rep.uses[2];

export function generateSudoku(seed: number, difficulty: Difficulty = 'medium'): SudokuPuzzle {
  const cfg = CONFIG[difficulty];
  const rng = createRng(seed);
  let best: { puzzle: SudokuPuzzle; score: number } | null = null;

  for (let attempt = 0; attempt < 12; attempt++) {
    const r = rng.fork();
    const solution = randomGrid(r);
    const givens = solution.slice();
    const target = r.int(cfg.givens[0], cfg.givens[1]);
    let count = CELLS;

    // Remove 180°-symmetric pairs while possible, then single cells to hit the exact count.
    const pairs = Array.from({ length: CELLS / 2 }, (_, i) => [i, CELLS - 1 - i]);
    const singles = Array.from({ length: CELLS }, (_, i) => [i]);
    let usePairs = true;
    while (count > target) {
      const pairMode = usePairs && count - 2 >= target;
      const pool = r.shuffle(pairMode ? pairs : singles).filter((g) => g.every((i) => givens[i]));
      let pick: number[] | null = null;
      let pickScore = -1;
      for (const group of pool) {
        const saved = group.map((i) => givens[i]);
        for (const i of group) givens[i] = 0;
        const rep = solveLogic(givens, cfg.maxRank);
        group.forEach((i, k) => (givens[i] = saved[k]));
        if (!rep.solved) continue;
        const score = difficultyScore(rep);
        if (score > pickScore) {
          pick = group;
          pickScore = score;
        }
        if (!cfg.greedy) break;
      }
      if (!pick) {
        if (pairMode) {
          usePairs = false; // no symmetric pair works any more; fine-tune with single cells
          continue;
        }
        break;
      }
      for (const i of pick) givens[i] = 0;
      count -= pick.length;
    }

    const puzzle: SudokuPuzzle = { solution, givens, difficulty };
    const report = solveLogic(givens, cfg.maxRank);
    const inRange = count >= cfg.givens[0] && count <= cfg.givens[1];
    if (inRange && report.maxRank >= cfg.wantRank) return puzzle;
    const score = (inRange ? 0 : 10000) + difficultyScore(report);
    const adjusted = inRange ? score : -Math.abs(count - target);
    if (!best || adjusted > best.score) best = { puzzle, score: adjusted };
  }
  return best!.puzzle;
}
