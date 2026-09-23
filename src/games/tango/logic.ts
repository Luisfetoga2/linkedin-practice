import { createRng, type Rng } from '../../lib/rng';
import { STR, type DeductionMsg, type TangoStrings } from './i18n';

/** 0 = empty, 1 = sun, 2 = moon. */
export type Val = 0 | 1 | 2;
export const SUN = 1 as const;
export const MOON = 2 as const;
export const N = 6;
export const CELLS = N * N;

export type Difficulty = 'easy' | 'medium' | 'hard';

/** Sign between two orthogonally adjacent cells. `b` is `a + 1` (horizontal) or `a + N` (vertical). */
export interface Sign {
  a: number;
  b: number;
  eq: boolean;
}

export interface TangoPuzzle {
  solution: Val[];
  /** Locked, pre-filled cells (0 where the player fills). */
  givens: Val[];
  signs: Sign[];
  difficulty: Difficulty;
}

export const opp = (v: Val): Val => (v === SUN ? MOON : v === MOON ? SUN : 0);

// ---------------------------------------------------------------------------
// Lines & valid line patterns
// ---------------------------------------------------------------------------

/** 12 lines: rows 0-5 then columns 0-5; each lists its 6 cell indexes in order. */
export const LINES: number[][] = [];
for (let r = 0; r < N; r++) LINES.push(Array.from({ length: N }, (_, c) => r * N + c));
for (let c = 0; c < N; c++) LINES.push(Array.from({ length: N }, (_, r) => r * N + c));

const popcount = (x: number) => {
  let n = 0;
  while (x) {
    n += x & 1;
    x >>= 1;
  }
  return n;
};

/** Bit i set = sun at position i. Only balanced patterns without three in a row. */
const BALANCED_PATTERNS: number[] = [];
for (let p = 0; p < 1 << N; p++) {
  if (popcount(p) !== N / 2) continue;
  let ok = true;
  for (let i = 0; i + 2 < N; i++) {
    const a = (p >> i) & 1;
    if (((p >> (i + 1)) & 1) === a && ((p >> (i + 2)) & 1) === a) ok = false;
  }
  if (ok) BALANCED_PATTERNS.push(p);
}

/** Per-puzzle precomputation: which signs belong to each line, and patterns allowed by those signs. */
export interface Ctx {
  signs: Sign[];
  /** For each line, the in-line signs as [posA, posB, eq]. */
  lineSigns: [number, number, boolean][][];
  /** For each line, balanced patterns that also satisfy the line's signs. */
  linePatterns: number[][];
  /** For each cell, signs touching it. */
  cellSigns: Sign[][];
}

export function makeCtx(signs: Sign[]): Ctx {
  const lineSigns: [number, number, boolean][][] = LINES.map(() => []);
  const cellSigns: Sign[][] = Array.from({ length: CELLS }, () => []);
  for (const s of signs) {
    cellSigns[s.a].push(s);
    cellSigns[s.b].push(s);
    const horizontal = s.b === s.a + 1;
    const li = horizontal ? Math.floor(s.a / N) : N + (s.a % N);
    const pos = horizontal ? s.a % N : Math.floor(s.a / N);
    lineSigns[li].push([pos, pos + 1, s.eq]);
  }
  const linePatterns = lineSigns.map((ls) =>
    BALANCED_PATTERNS.filter((p) => ls.every(([i, j, eq]) => (((p >> i) & 1) === ((p >> j) & 1)) === eq)),
  );
  return { signs, lineSigns, linePatterns, cellSigns };
}

/** Patterns (from `pool`) consistent with the known cells of a line. */
function consistent(board: ArrayLike<number>, li: number, pool: number[]): number[] {
  const cells = LINES[li];
  let known = 0;
  let suns = 0;
  for (let i = 0; i < N; i++) {
    const v = board[cells[i]];
    if (v) {
      known |= 1 << i;
      if (v === SUN) suns |= 1 << i;
    }
  }
  if (!known) return pool;
  return pool.filter((p) => (p & known) === suns);
}

// ---------------------------------------------------------------------------
// Rule checking (for error display)
// ---------------------------------------------------------------------------

export type ViolationKind = 'triple' | 'count' | 'eq' | 'neq';
export interface Violation {
  kind: ViolationKind;
  cells: number[];
  line?: number;
}

export function findViolations(board: ArrayLike<number>, signs: Sign[]): Violation[] {
  const out: Violation[] = [];
  LINES.forEach((cells, li) => {
    for (let i = 0; i + 2 < N; i++) {
      const v = board[cells[i]];
      if (v && board[cells[i + 1]] === v && board[cells[i + 2]] === v) {
        out.push({ kind: 'triple', cells: [cells[i], cells[i + 1], cells[i + 2]], line: li });
      }
    }
    for (const v of [SUN, MOON]) {
      const hits = cells.filter((c) => board[c] === v);
      if (hits.length > N / 2) out.push({ kind: 'count', cells: hits, line: li });
    }
  });
  for (const s of signs) {
    const x = board[s.a];
    const y = board[s.b];
    if (!x || !y) continue;
    if (s.eq && x !== y) out.push({ kind: 'eq', cells: [s.a, s.b] });
    if (!s.eq && x === y) out.push({ kind: 'neq', cells: [s.a, s.b] });
  }
  return out;
}

/** Short rule-break message shown under the board, in the language of `t`. */
export function violationMessage(v: Violation, t: TangoStrings = STR.en): string {
  return t.violation(v.kind === 'count' ? { kind: 'count', line: v.line ?? 0 } : { kind: v.kind });
}

// ---------------------------------------------------------------------------
// Logic solver
// ---------------------------------------------------------------------------

export interface Deduction {
  cell: number;
  value: Val;
  /** 1 = basic (pairs, sandwiches, signs, counts); 2 = whole-line reasoning; 3 = what-if across lines. */
  level: 1 | 2 | 3;
  technique: 'sign' | 'pair' | 'sandwich' | 'count' | 'line' | 'trial';
  /** Cells that justify the deduction (highlighted by the hint). */
  related: number[];
  /** Structured explanation; format it with STR[lang].deduction(). */
  msg: DeductionMsg;
}

function basicDeduction(board: ArrayLike<number>, ctx: Ctx): Deduction | null {
  // Sign propagation.
  for (const s of ctx.signs) {
    const x = board[s.a] as Val;
    const y = board[s.b] as Val;
    if (!!x === !!y) continue;
    const known = x ? x : y;
    const target = x ? s.b : s.a;
    const value = s.eq ? known : opp(known);
    return {
      cell: target,
      value,
      level: 1,
      technique: 'sign',
      related: [x ? s.a : s.b],
      msg: { key: 'sign', eq: s.eq, value },
    };
  }
  for (let li = 0; li < LINES.length; li++) {
    const cells = LINES[li];
    // Pairs: X X _ or _ X X.
    for (let i = 0; i + 1 < N; i++) {
      const v = board[cells[i]] as Val;
      if (!v || board[cells[i + 1]] !== v) continue;
      for (const t of [i - 1, i + 2]) {
        if (t < 0 || t >= N || board[cells[t]]) continue;
        return {
          cell: cells[t],
          value: opp(v),
          level: 1,
          technique: 'pair',
          related: [cells[i], cells[i + 1]],
          msg: { key: 'pair', v },
        };
      }
    }
    // Sandwich: X _ X.
    for (let i = 0; i + 2 < N; i++) {
      const v = board[cells[i]] as Val;
      if (!v || board[cells[i + 1]] || board[cells[i + 2]] !== v) continue;
      return {
        cell: cells[i + 1],
        value: opp(v),
        level: 1,
        technique: 'sandwich',
        related: [cells[i], cells[i + 2]],
        msg: { key: 'sandwich', v },
      };
    }
    // Count completion.
    for (const v of [SUN, MOON] as const) {
      const hits = cells.filter((c) => board[c] === v);
      if (hits.length !== N / 2) continue;
      const empty = cells.find((c) => !board[c]);
      if (empty === undefined) continue;
      return {
        cell: empty,
        value: opp(v),
        level: 1,
        technique: 'count',
        related: hits,
        msg: { key: 'count', v, line: li },
      };
    }
  }
  return null;
}

function lineDeduction(board: ArrayLike<number>, ctx: Ctx): Deduction | null {
  for (let li = 0; li < LINES.length; li++) {
    const cells = LINES[li];
    if (cells.every((c) => board[c])) continue;
    const pats = consistent(board, li, ctx.linePatterns[li]);
    if (!pats.length) continue; // contradiction; nothing sensible to deduce
    let all = (1 << N) - 1;
    let none = (1 << N) - 1;
    for (const p of pats) {
      all &= p;
      none &= ~p;
    }
    for (let i = 0; i < N; i++) {
      const c = cells[i];
      if (board[c]) continue;
      let value: Val = 0;
      if ((all >> i) & 1) value = SUN;
      else if ((none >> i) & 1) value = MOON;
      if (!value) continue;
      // Why: would the wrong symbol fail even without the signs?
      const trial = Array.from(board);
      trial[c] = opp(value);
      const withoutSigns = consistent(trial, li, BALANCED_PATTERNS).length > 0;
      return {
        cell: c,
        value,
        level: 2,
        technique: 'line',
        related: cells.filter((x) => x !== c),
        msg: { key: 'line', value, line: li, withoutSigns },
      };
    }
  }
  return null;
}

/**
 * Line-level propagation to a fixed point. Returns the index of a line with no valid completion
 * (contradiction), or -1. Mutates `board`.
 */
function propagate(board: Val[], ctx: Ctx): number {
  let changed = true;
  while (changed) {
    changed = false;
    for (let li = 0; li < LINES.length; li++) {
      const cells = LINES[li];
      const pats = consistent(board, li, ctx.linePatterns[li]);
      if (!pats.length) return li;
      let all = (1 << N) - 1;
      let none = (1 << N) - 1;
      for (const p of pats) {
        all &= p;
        none &= ~p;
      }
      for (let i = 0; i < N; i++) {
        const c = cells[i];
        if (board[c]) continue;
        if ((all >> i) & 1) {
          board[c] = SUN;
          changed = true;
        } else if ((none >> i) & 1) {
          board[c] = MOON;
          changed = true;
        }
      }
    }
  }
  return -1;
}

function trialDeduction(board: ArrayLike<number>, ctx: Ctx): Deduction | null {
  for (let c = 0; c < CELLS; c++) {
    if (board[c]) continue;
    for (const v of [SUN, MOON] as const) {
      const temp = Array.from(board) as Val[];
      temp[c] = v;
      const bad = propagate(temp, ctx);
      if (bad < 0) continue;
      const value = opp(v);
      const inLine = LINES[bad].includes(c);
      return {
        cell: c,
        value,
        level: 3,
        technique: 'trial',
        related: LINES[bad].filter((x) => x !== c),
        msg: { key: 'trial', tried: v, value, line: bad, inLine },
      };
    }
  }
  return null;
}

/** Next logical step for the current board, trying simpler techniques first. */
export function findDeduction(board: ArrayLike<number>, ctx: Ctx, maxLevel: 1 | 2 | 3 = 3): Deduction | null {
  return (
    basicDeduction(board, ctx) ??
    (maxLevel >= 2 ? lineDeduction(board, ctx) : null) ??
    (maxLevel >= 3 ? trialDeduction(board, ctx) : null)
  );
}

export interface SolveReport {
  solved: boolean;
  board: Val[];
  /** Number of steps used per level (index 1..3). */
  uses: [number, number, number, number];
}

export function solveLogic(givens: ArrayLike<number>, ctx: Ctx, maxLevel: 1 | 2 | 3): SolveReport {
  const board = Array.from(givens) as Val[];
  const uses: [number, number, number, number] = [0, 0, 0, 0];
  for (;;) {
    const d = findDeduction(board, ctx, maxLevel);
    if (!d) break;
    board[d.cell] = d.value;
    uses[d.level]++;
  }
  const solved = board.every((v) => v) && findViolations(board, ctx.signs).length === 0;
  return { solved, board, uses };
}

// ---------------------------------------------------------------------------
// Brute-force solution counter (used by tests and as a safety net)
// ---------------------------------------------------------------------------

export function countSolutions(givens: ArrayLike<number>, signs: Sign[], limit = 2): number {
  const ctx = makeCtx(signs);
  const board = Array.from(givens) as Val[];
  let count = 0;
  const rec = (b: Val[]) => {
    if (count >= limit) return;
    if (propagate(b, ctx) >= 0) return;
    const empty = b.indexOf(0);
    if (empty < 0) {
      if (findViolations(b, signs).length === 0) count++;
      return;
    }
    for (const v of [SUN, MOON] as const) {
      const next = b.slice();
      next[empty] = v;
      rec(next);
    }
  };
  rec(board);
  return count;
}

// ---------------------------------------------------------------------------
// Generator
// ---------------------------------------------------------------------------

function randomSolution(rng: Rng): Val[] {
  const b: Val[] = new Array(CELLS).fill(0);
  const rec = (i: number): boolean => {
    if (i === CELLS) return true;
    const r = Math.floor(i / N);
    const c = i % N;
    const order: Val[] = rng.chance(0.5) ? [SUN, MOON] : [MOON, SUN];
    for (const v of order) {
      if (c >= 2 && b[i - 1] === v && b[i - 2] === v) continue;
      if (r >= 2 && b[i - N] === v && b[i - 2 * N] === v) continue;
      let rowCount = 0;
      for (let k = r * N; k < i; k++) if (b[k] === v) rowCount++;
      if (rowCount >= N / 2) continue;
      let colCount = 0;
      for (let k = c; k < i; k += N) if (b[k] === v) colCount++;
      if (colCount >= N / 2) continue;
      b[i] = v;
      if (rec(i + 1)) return true;
      b[i] = 0;
    }
    return false;
  };
  rec(0);
  return b;
}

const ALL_EDGES: [number, number][] = [];
for (let r = 0; r < N; r++)
  for (let c = 0; c < N; c++) {
    const i = r * N + c;
    if (c + 1 < N) ALL_EDGES.push([i, i + 1]);
    if (r + 1 < N) ALL_EDGES.push([i, i + N]);
  }

interface DiffCfg {
  level: 1 | 2 | 3;
  signs: number;
  /** Stop removing givens at this many (inclusive range, picked per puzzle). */
  minGivens: [number, number];
  /** Stop removing signs at this many (inclusive range, picked per puzzle). */
  minSigns: [number, number];
  /** Removal order: 'signs' tries removing signs first, 'givens' givens first. */
  order: 'signs' | 'givens' | 'mixed';
  /** Accept only puzzles that need at least this many steps of `level`. */
  needUses: number;
}

const CONFIG: Record<Difficulty, DiffCfg> = {
  easy: { level: 1, signs: 10, minGivens: [10, 12], minSigns: [4, 6], order: 'givens', needUses: 0 },
  medium: { level: 2, signs: 12, minGivens: [6, 8], minSigns: [6, 8], order: 'mixed', needUses: 2 },
  hard: { level: 3, signs: 14, minGivens: [4, 5], minSigns: [8, 10], order: 'givens', needUses: 1 },
};

type Clue = { kind: 'given'; cell: number } | { kind: 'sign'; idx: number };

export function generateTango(seed: number, difficulty: Difficulty = 'medium'): TangoPuzzle {
  const cfg = CONFIG[difficulty];
  const rng = createRng(seed);
  let fallback: TangoPuzzle | null = null;
  for (let attempt = 0; attempt < 30; attempt++) {
    const r = rng.fork();
    const solution = randomSolution(r);
    const signs: Sign[] = r
      .shuffle(ALL_EDGES)
      .slice(0, cfg.signs)
      .map(([a, b]) => ({ a, b, eq: solution[a] === solution[b] }));
    const givens = solution.slice();
    const minGivens = r.int(cfg.minGivens[0], cfg.minGivens[1]);
    const minSigns = r.int(cfg.minSigns[0], cfg.minSigns[1]);
    const signOn = signs.map(() => true);

    const givenClues: Clue[] = r.shuffle(Array.from({ length: CELLS }, (_, cell) => ({ kind: 'given' as const, cell })));
    const signClues: Clue[] = r.shuffle(signs.map((_, idx) => ({ kind: 'sign' as const, idx })));
    const order =
      cfg.order === 'signs'
        ? [...signClues, ...givenClues]
        : cfg.order === 'givens'
          ? [...givenClues, ...signClues]
          : r.shuffle([...givenClues, ...signClues]);

    const activeSigns = () => signs.filter((_, i) => signOn[i]);
    let givenCount = CELLS;
    let signCount = signs.length;
    for (const clue of order) {
      if (clue.kind === 'given') {
        if (givenCount <= minGivens) continue;
        const keep = givens[clue.cell];
        givens[clue.cell] = 0;
        if (solveLogic(givens, makeCtx(activeSigns()), cfg.level).solved) givenCount--;
        else givens[clue.cell] = keep;
      } else {
        if (signCount <= minSigns) continue;
        signOn[clue.idx] = false;
        if (solveLogic(givens, makeCtx(activeSigns()), cfg.level).solved) signCount--;
        else signOn[clue.idx] = true;
      }
    }

    const puzzle: TangoPuzzle = { solution, givens, signs: activeSigns(), difficulty };
    if (cfg.level > 1) {
      const ctx = makeCtx(puzzle.signs);
      // Must not be solvable with easier techniques, and should use the top level a few times.
      const lower = solveLogic(givens, ctx, (cfg.level - 1) as 1 | 2);
      const full = solveLogic(givens, ctx, cfg.level);
      if (lower.solved || full.uses[cfg.level] < cfg.needUses) {
        fallback ??= puzzle;
        continue;
      }
    }
    return puzzle;
  }
  return fallback!;
}
