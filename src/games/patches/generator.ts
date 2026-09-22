import { createRng, type Rng } from '../../lib/rng';

export type Shape = 'square' | 'wide' | 'tall' | 'any';

export interface Clue {
  r: number;
  c: number;
  /** Required cell count, or null if unconstrained. */
  size: number | null;
  shape: Shape;
  color: string;
}

/** Inclusive cell rectangle. */
export interface Rect {
  r0: number;
  c0: number;
  r1: number;
  c1: number;
}

export interface PatchesPuzzle {
  size: number;
  clues: Clue[];
  /** solution[i] is the patch of clue i. */
  solution: Rect[];
}

export const PALETTE = [
  '#f54545', // red
  '#4a8bf5', // blue
  '#ffc93c', // yellow
  '#34b36b', // green
  '#9b6cf0', // purple
  '#ff8a3d', // orange
  '#f06bb0', // pink
  '#22b8c7', // teal
  '#8bc34a', // lime
  '#7a6ff0', // indigo
];

export const rectW = (r: Rect) => r.c1 - r.c0 + 1;
export const rectH = (r: Rect) => r.r1 - r.r0 + 1;
export const rectArea = (r: Rect) => rectW(r) * rectH(r);
export const sameRect = (a: Rect | null | undefined, b: Rect | null | undefined) =>
  !!a && !!b && a.r0 === b.r0 && a.c0 === b.c0 && a.r1 === b.r1 && a.c1 === b.c1;
export const rectContains = (r: Rect, row: number, col: number) => row >= r.r0 && row <= r.r1 && col >= r.c0 && col <= r.c1;
export const rectsOverlap = (a: Rect, b: Rect) => a.r0 <= b.r1 && b.r0 <= a.r1 && a.c0 <= b.c1 && b.c0 <= a.c1;

export function shapeOf(r: Rect): Exclude<Shape, 'any'> {
  const w = rectW(r);
  const h = rectH(r);
  return w === h ? 'square' : w > h ? 'wide' : 'tall';
}

/** Does rectangle r satisfy the clue's size/shape constraints (ignores clue position)? */
export function fitsClue(r: Rect, clue: Pick<Clue, 'size' | 'shape'>): boolean {
  if (clue.size != null && rectArea(r) !== clue.size) return false;
  return clue.shape === 'any' || shapeOf(r) === clue.shape;
}

// ---------- Bit masks (two 32-bit words cover up to 8×8) ----------

interface Cand {
  rect: Rect;
  lo: number;
  hi: number;
}

function maskOf(rect: Rect, n: number): [number, number] {
  let lo = 0;
  let hi = 0;
  for (let r = rect.r0; r <= rect.r1; r++) {
    for (let c = rect.c0; c <= rect.c1; c++) {
      const i = r * n + c;
      if (i < 32) lo |= 1 << i;
      else hi |= 1 << (i - 32);
    }
  }
  return [lo, hi];
}

const hasBit = (lo: number, hi: number, i: number) => (i < 32 ? (lo >>> i) & 1 : (hi >>> (i - 32)) & 1) === 1;

/** All rectangles that could be the patch of clue `idx` (contain it, fit it, contain no other clue). */
function candidatesFor(n: number, clues: readonly Pick<Clue, 'r' | 'c' | 'size' | 'shape'>[], idx: number, clueAt: Int16Array): Cand[] {
  const k = clues[idx];
  const out: Cand[] = [];
  for (let r0 = k.r; r0 >= 0; r0--) {
    for (let r1 = k.r; r1 < n; r1++) {
      for (let c0 = k.c; c0 >= 0; c0--) {
        for (let c1 = k.c; c1 < n; c1++) {
          const rect = { r0, c0, r1, c1 };
          if (!fitsClue(rect, k)) continue;
          let ok = true;
          for (let r = r0; r <= r1 && ok; r++) {
            for (let c = c0; c <= c1; c++) {
              const o = clueAt[r * n + c];
              if (o >= 0 && o !== idx) {
                ok = false;
                break;
              }
            }
          }
          if (!ok) continue;
          const [lo, hi] = maskOf(rect, n);
          out.push({ rect, lo, hi });
        }
      }
    }
  }
  return out;
}

function clueGrid(n: number, clues: readonly Pick<Clue, 'r' | 'c'>[]): Int16Array {
  const g = new Int16Array(n * n).fill(-1);
  clues.forEach((k, i) => (g[k.r * n + k.c] = i));
  return g;
}

/** Counts solutions (up to `limit`) with an exact-cover backtracking search. */
export function countSolutions(n: number, clues: readonly Pick<Clue, 'r' | 'c' | 'size' | 'shape'>[], limit = 2): { count: number; solutions: Rect[][] } {
  const g = clueGrid(n, clues);
  const cands = clues.map((_, i) => candidatesFor(n, clues, i, g));
  const total = n * n;
  // For each cell, candidates (clue, cand) covering it.
  const byCell: { clue: number; cand: Cand }[][] = Array.from({ length: total }, () => []);
  cands.forEach((list, ci) =>
    list.forEach((cand) => {
      for (let r = cand.rect.r0; r <= cand.rect.r1; r++) for (let c = cand.rect.c0; c <= cand.rect.c1; c++) byCell[r * n + c].push({ clue: ci, cand });
    }),
  );
  const used = new Uint8Array(clues.length);
  const chosen: Rect[] = new Array(clues.length);
  const solutions: Rect[][] = [];
  let count = 0;
  const rec = (lo: number, hi: number, from: number) => {
    if (count >= limit) return;
    let cell = from;
    while (cell < total && hasBit(lo, hi, cell)) cell++;
    if (cell === total) {
      count++;
      solutions.push(chosen.slice());
      return;
    }
    for (const { clue, cand } of byCell[cell]) {
      if (used[clue] || cand.lo & lo || cand.hi & hi) continue;
      used[clue] = 1;
      chosen[clue] = cand.rect;
      rec(lo | cand.lo, hi | cand.hi, cell + 1);
      used[clue] = 0;
      if (count >= limit) return;
    }
  };
  rec(0, 0, 0);
  return { count, solutions };
}

export type Reason = 'only' | 'claimed' | 'reach';

export interface LogicResult {
  solved: boolean;
  contradiction: boolean;
  /** Remaining candidate rectangles per clue. */
  candidates: Rect[][];
  /** Order in which clues became fixed, with the rule that fixed them. */
  steps: { clue: number; rect: Rect; reason: Reason; round: number }[];
}

/**
 * Human-style deduction: (1) cells every candidate of a clue covers belong to it, so other clues lose
 * candidates touching them; (2) a cell reachable by only one clue forces that clue to cover it.
 * `fixed[i]` pins clue i to a rectangle (e.g. patches the player already placed correctly).
 */
export function logicSolve(n: number, clues: readonly Pick<Clue, 'r' | 'c' | 'size' | 'shape'>[], fixed: (Rect | null)[] = []): LogicResult {
  const g = clueGrid(n, clues);
  const total = n * n;
  let cands: Cand[][] = clues.map((_, i) => {
    const all = candidatesFor(n, clues, i, g);
    const f = fixed[i];
    return f ? all.filter((c) => sameRect(c.rect, f)) : all;
  });
  const steps: LogicResult['steps'] = [];
  const done = new Uint8Array(clues.length);
  const note = (reason: Reason, round: number) => {
    cands.forEach((list, i) => {
      if (!done[i] && list.length === 1) {
        done[i] = 1;
        steps.push({ clue: i, rect: list[0].rect, reason, round });
      }
    });
  };
  // Pre-fixed clues are not reported as steps.
  cands.forEach((list, i) => {
    if (fixed[i] && list.length === 1) done[i] = 1;
  });
  note('only', 0);
  let contradiction = cands.some((l) => l.length === 0);
  for (let round = 1; !contradiction && round < 200; round++) {
    let changed = false;
    // Rule 1: claimed cells.
    const coreLo = cands.map((l) => l.reduce((a, c) => a & c.lo, -1));
    const coreHi = cands.map((l) => l.reduce((a, c) => a & c.hi, -1));
    cands = cands.map((list, i) => {
      let lo = 0;
      let hi = 0;
      for (let j = 0; j < cands.length; j++) {
        if (j === i) continue;
        lo |= coreLo[j];
        hi |= coreHi[j];
      }
      const next = list.filter((c) => !(c.lo & lo) && !(c.hi & hi));
      if (next.length !== list.length) changed = true;
      return next;
    });
    note('claimed', round);
    if (cands.some((l) => l.length === 0)) {
      contradiction = true;
      break;
    }
    // Rule 2: a cell only one clue can reach.
    for (let cell = 0; cell < total; cell++) {
      let owner = -1;
      let owners = 0;
      for (let i = 0; i < cands.length && owners < 2; i++) {
        if (cands[i].some((c) => hasBit(c.lo, c.hi, cell))) {
          owners++;
          owner = i;
        }
      }
      if (owners === 0) {
        contradiction = true;
        break;
      }
      if (owners === 1) {
        const list = cands[owner];
        const next = list.filter((c) => hasBit(c.lo, c.hi, cell));
        if (next.length !== list.length) {
          cands[owner] = next;
          changed = true;
        }
      }
    }
    note('reach', round);
    if (!changed) break;
  }
  const solved = !contradiction && cands.every((l) => l.length === 1);
  return { solved, contradiction, candidates: cands.map((l) => l.map((c) => c.rect)), steps };
}

// ---------- Generation ----------

const CONF: Record<number, { maxArea: number; minPatches: number; maxPatches: number }> = {
  5: { maxArea: 6, minPatches: 6, maxPatches: 9 },
  6: { maxArea: 8, minPatches: 7, maxPatches: 11 },
  7: { maxArea: 9, minPatches: 9, maxPatches: 14 },
  8: { maxArea: 10, minPatches: 11, maxPatches: 17 },
};

function randomPartition(n: number, rng: Rng): Rect[] | null {
  const conf = CONF[n] ?? CONF[6];
  const owner = new Int16Array(n * n).fill(-1);
  const rects: Rect[] = [];
  let ones = 0;
  for (let cell = 0; cell < n * n; cell++) {
    if (owner[cell] >= 0) continue;
    const r = Math.floor(cell / n);
    const c = cell % n;
    let maxW = 0;
    while (c + maxW < n && owner[r * n + c + maxW] < 0) maxW++;
    const opts: { w: number; h: number; weight: number }[] = [];
    for (let w = 1; w <= maxW; w++) {
      for (let h = 1; r + h <= n; h++) {
        let free = true;
        for (let x = 0; x < w && free; x++) if (owner[(r + h - 1) * n + c + x] >= 0) free = false;
        if (!free) break;
        const a = w * h;
        if (a > conf.maxArea) continue;
        let weight = a === 1 ? 0.02 : a <= 3 ? 0.8 : a <= 6 ? 1 : 0.6;
        if (w === h && a > 1) weight *= 1.6;
        if (w > 4 || h > 4) weight *= 0.5;
        opts.push({ w, h, weight });
      }
    }
    const sum = opts.reduce((s, o) => s + o.weight, 0);
    let pickAt = rng.next() * sum;
    let choice = opts[opts.length - 1];
    for (const o of opts) {
      pickAt -= o.weight;
      if (pickAt <= 0) {
        choice = o;
        break;
      }
    }
    if (choice.w * choice.h === 1) ones++;
    const rect = { r0: r, c0: c, r1: r + choice.h - 1, c1: c + choice.w - 1 };
    for (let y = rect.r0; y <= rect.r1; y++) for (let x = rect.c0; x <= rect.c1; x++) owner[y * n + x] = rects.length;
    rects.push(rect);
  }
  if (ones > (n >= 7 ? 1 : 0)) return null;
  if (rects.length < conf.minPatches || rects.length > conf.maxPatches) return null;
  return rects;
}

type Level = 'any' | 'number' | 'shape' | 'full';

function clueFor(rect: Rect, level: Level): Pick<Clue, 'size' | 'shape'> {
  return {
    size: level === 'number' || level === 'full' ? rectArea(rect) : null,
    shape: level === 'shape' || level === 'full' ? shapeOf(rect) : 'any',
  };
}

function tryBuild(n: number, rng: Rng): PatchesPuzzle | null {
  const rects = randomPartition(n, rng);
  if (!rects) return null;
  const pos = rects.map((rect) => ({ r: rng.int(rect.r0, rect.r1), c: rng.int(rect.c0, rect.c1) }));
  const levels: Level[] = rects.map(() => {
    const x = rng.next();
    return x < 0.3 ? 'full' : x < 0.62 ? 'number' : x < 0.85 ? 'shape' : 'any';
  });
  const make = () => rects.map((rect, i) => ({ ...pos[i], ...clueFor(rect, levels[i]) }));

  // Strengthen clues until pure deduction solves the board.
  let res = logicSolve(n, make());
  for (let guard = 0; !res.solved && guard < rects.length * 3; guard++) {
    const open = rects.map((_, i) => i).filter((i) => res.candidates[i].length !== 1 && levels[i] !== 'full');
    if (!open.length) return null;
    const i = rng.pick(open);
    levels[i] = levels[i] === 'any' ? (rng.chance(0.6) ? 'number' : 'shape') : 'full';
    res = logicSolve(n, make());
  }
  if (!res.solved) return null;

  // Loosen clues where deduction still works, for variety.
  for (const i of rng.shuffle(rects.map((_, k) => k))) {
    const prev = levels[i];
    if (!rng.chance(prev === 'full' ? 0.65 : 0.3)) continue;
    const options: Level[] = prev === 'full' ? ['number', 'shape'] : prev === 'any' ? [] : ['any'];
    if (!options.length) continue;
    levels[i] = rng.pick(options);
    if (!logicSolve(n, make()).solved) levels[i] = prev;
  }
  // Keep at least some numbers visible and avoid a board of blank dashed clues.
  const plain = make();
  if (plain.filter((k) => k.size == null && k.shape === 'any').length > Math.ceil(rects.length / 5)) return null;

  // Colours: neighbours differ.
  const colors: string[] = [];
  const order = rng.shuffle(PALETTE);
  const usage = new Map<string, number>();
  rects.forEach((rect, i) => {
    const near = new Set<string>();
    rects.forEach((o, j) => {
      if (j >= i) return;
      const touch = o.r0 <= rect.r1 + 1 && rect.r0 <= o.r1 + 1 && o.c0 <= rect.c1 + 1 && rect.c0 <= o.c1 + 1;
      if (touch) near.add(colors[j]);
    });
    const avail = order.filter((c) => !near.has(c));
    const pool = avail.length ? avail : order;
    let best = pool[0];
    for (const c of pool) if ((usage.get(c) ?? 0) < (usage.get(best) ?? 0)) best = c;
    usage.set(best, (usage.get(best) ?? 0) + 1);
    colors.push(best);
  });

  return {
    size: n,
    clues: plain.map((k, i) => ({ ...k, color: colors[i] })),
    solution: rects,
  };
}

/** Deterministically generates a Patches board that is uniquely solvable by deduction. */
export function generatePatches(size: number, seed: number): PatchesPuzzle {
  const n = Math.min(8, Math.max(5, size));
  const rng = createRng(seed * 104729 + n * 31);
  for (let attempt = 0; attempt < 400; attempt++) {
    const p = tryBuild(n, rng.fork());
    if (p) return p;
  }
  // Fallback: full clues on a simple strip partition (always deducible).
  const rects: Rect[] = [];
  for (let r = 0; r < n; r++) rects.push({ r0: r, c0: 0, r1: r, c1: n - 1 });
  return {
    size: n,
    clues: rects.map((rect, i) => ({ r: rect.r0, c: 0, size: n, shape: 'wide', color: PALETTE[i % PALETTE.length] })),
    solution: rects,
  };
}
