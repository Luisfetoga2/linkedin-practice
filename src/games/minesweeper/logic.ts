import { createRng } from '../../lib/rng';

export type Level = 'easy' | 'medium' | 'hard';
export const LEVELS: Record<Level, { w: number; h: number; mines: number }> = {
  easy: { w: 9, h: 9, mines: 10 },
  medium: { w: 16, h: 16, mines: 40 },
  hard: { w: 30, h: 16, mines: 99 },
};

export function levelOf(v: string | undefined): Level {
  return v === 'easy' || v === 'medium' || v === 'hard' ? v : 'easy';
}

export interface Board {
  w: number;
  h: number;
  mineCount: number;
  /** 1 = mine. Index = row * w + col. */
  mines: Uint8Array;
  /** Mines among the 8 neighbours (0 for mines themselves). */
  counts: Uint8Array;
  /** Neighbour indices of every cell. */
  nb: number[][];
  /** The first square opened; always a 0, so it opens an area. */
  start: number;
}

/** What the solver (or the player) knows about each square. */
export const HIDDEN = 0;
export const OPEN = 1;
export const MINE = 2;
export type Knowledge = Uint8Array;

export function neighbourTable(w: number, h: number): number[][] {
  const nb: number[][] = [];
  for (let r = 0; r < h; r++) {
    for (let c = 0; c < w; c++) {
      const list: number[] = [];
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          if (!dr && !dc) continue;
          const rr = r + dr;
          const cc = c + dc;
          if (rr >= 0 && rr < h && cc >= 0 && cc < w) list.push(rr * w + cc);
        }
      }
      nb.push(list);
    }
  }
  return nb;
}

export function boardFrom(w: number, h: number, mines: Uint8Array, start: number, nb = neighbourTable(w, h)): Board {
  const counts = new Uint8Array(w * h);
  let mineCount = 0;
  for (let i = 0; i < w * h; i++) {
    if (mines[i]) {
      mineCount++;
      continue;
    }
    let k = 0;
    for (const j of nb[i]) k += mines[j];
    counts[i] = k;
  }
  return { w, h, mineCount, mines, counts, nb, start };
}

/** Opens `i` in `know`, flooding outward from zeros like the real game. Returns the cells opened. */
export function openFrom(b: Board, know: Knowledge, i: number): number[] {
  const opened: number[] = [];
  const stack = [i];
  while (stack.length) {
    const k = stack.pop()!;
    if (know[k] !== HIDDEN || b.mines[k]) continue;
    know[k] = OPEN;
    opened.push(k);
    if (b.counts[k] === 0) for (const j of b.nb[k]) if (know[j] === HIDDEN) stack.push(j);
  }
  return opened;
}

// ---------------------------------------------------------------------------------------------
// Solver. Each pass returns every deduction it can make; later passes only run when earlier ones
// find nothing, so the first result is also the simplest explanation for a hint.
// ---------------------------------------------------------------------------------------------

export type Deduction =
  /** One number: its hidden neighbours are all safe, or all mines. */
  | { kind: 'single'; source: number; cells: number[]; mine: boolean }
  /** Two overlapping numbers compared. */
  | { kind: 'pair'; source: number; other: number; cells: number[]; mine: boolean }
  /** The total mine count settles every hidden square. */
  | { kind: 'count'; cells: number[]; mine: boolean }
  /** Every mine layout consistent with the numbers in `sources` agrees on these squares. */
  | { kind: 'enum'; sources: number[]; cells: number[]; mine: boolean };

interface Constraint {
  src: number;
  cells: number[];
  need: number;
}

function constraintsOf(b: Board, know: Knowledge): Constraint[] {
  const out: Constraint[] = [];
  for (let i = 0; i < know.length; i++) {
    if (know[i] !== OPEN || b.counts[i] === 0) continue;
    const cells: number[] = [];
    let found = 0;
    for (const j of b.nb[i]) {
      if (know[j] === HIDDEN) cells.push(j);
      else if (know[j] === MINE) found++;
    }
    if (cells.length) out.push({ src: i, cells, need: b.counts[i] - found });
  }
  return out;
}

function singles(cons: Constraint[]): Deduction[] {
  const out: Deduction[] = [];
  for (const k of cons) {
    if (k.need === 0) out.push({ kind: 'single', source: k.src, cells: k.cells, mine: false });
    else if (k.need === k.cells.length) out.push({ kind: 'single', source: k.src, cells: k.cells, mine: true });
  }
  return out;
}

function pairs(b: Board, cons: Constraint[]): Deduction[] {
  const out: Deduction[] = [];
  const bySrc = new Map<number, Constraint>();
  for (const k of cons) bySrc.set(k.src, k);
  for (const a of cons) {
    const ar = Math.floor(a.src / b.w);
    const ac = a.src % b.w;
    for (let dr = -2; dr <= 2; dr++) {
      for (let dc = -2; dc <= 2; dc++) {
        if (!dr && !dc) continue;
        const r = ar + dr;
        const c = ac + dc;
        if (r < 0 || r >= b.h || c < 0 || c >= b.w) continue;
        const o = bySrc.get(r * b.w + c);
        if (!o) continue;
        // If `o` needs exactly as many more mines than `a` as it has squares `a` doesn't see,
        // those squares are all mines and `a`'s squares outside `o` are all safe.
        const onlyA = a.cells.filter((x) => !o.cells.includes(x));
        const onlyO = o.cells.filter((x) => !a.cells.includes(x));
        if (onlyA.length + onlyO.length === 0 || onlyA.length === a.cells.length) continue;
        if (o.need - a.need !== onlyO.length) continue;
        if (onlyO.length) out.push({ kind: 'pair', source: a.src, other: o.src, cells: onlyO, mine: true });
        if (onlyA.length) out.push({ kind: 'pair', source: a.src, other: o.src, cells: onlyA, mine: false });
      }
    }
  }
  return out;
}

function countPass(b: Board, know: Knowledge): Deduction[] {
  let found = 0;
  const hidden: number[] = [];
  for (let i = 0; i < know.length; i++) {
    if (know[i] === MINE) found++;
    else if (know[i] === HIDDEN) hidden.push(i);
  }
  const left = b.mineCount - found;
  if (!hidden.length) return [];
  if (left === 0) return [{ kind: 'count', cells: hidden, mine: false }];
  if (left === hidden.length) return [{ kind: 'count', cells: hidden, mine: true }];
  return [];
}

const MAX_COMPONENT = 26;
const MAX_NODES = 60000;

/** Tries every mine layout on each connected stretch of the frontier. */
function enumerate(b: Board, know: Knowledge, cons: Constraint[]): Deduction[] {
  let found = 0;
  let hiddenTotal = 0;
  for (let i = 0; i < know.length; i++) {
    if (know[i] === MINE) found++;
    else if (know[i] === HIDDEN) hiddenTotal++;
  }
  const left = b.mineCount - found;

  const consOf = new Map<number, number[]>();
  cons.forEach((k, ci) => k.cells.forEach((x) => (consOf.get(x) ?? consOf.set(x, []).get(x)!).push(ci)));
  const seen = new Set<number>();
  const out: Deduction[] = [];

  for (const first of consOf.keys()) {
    if (seen.has(first)) continue;
    // BFS order keeps neighbouring squares together, so constraints close early and prune well.
    const cells: number[] = [];
    const queue = [first];
    seen.add(first);
    while (queue.length) {
      const x = queue.shift()!;
      cells.push(x);
      for (const ci of consOf.get(x)!) {
        for (const y of cons[ci].cells) {
          if (!seen.has(y)) {
            seen.add(y);
            queue.push(y);
          }
        }
      }
    }
    if (cells.length > MAX_COMPONENT) continue;
    const compCons = [...new Set(cells.flatMap((x) => consOf.get(x)!))];
    const assign = new Int8Array(cells.length).fill(-1);
    // Per constraint: mines placed so far and squares still unassigned.
    const placed = new Map<number, number>(compCons.map((ci) => [ci, 0]));
    const open = new Map<number, number>(compCons.map((ci) => [ci, cons[ci].cells.length]));
    const outside = hiddenTotal - cells.length;
    const everMine = new Uint8Array(cells.length);
    const everSafe = new Uint8Array(cells.length);
    let nodes = 0;
    let aborted = false;
    let any = false;

    const recurse = (i: number, mines: number) => {
      if (aborted) return;
      if (++nodes > MAX_NODES) {
        aborted = true;
        return;
      }
      if (i === cells.length) {
        if (mines > left || left - mines > outside) return;
        any = true;
        for (let k = 0; k < cells.length; k++) (assign[k] ? everMine : everSafe)[k] = 1;
        return;
      }
      for (const v of [0, 1]) {
        let ok = true;
        const touched = consOf.get(cells[i])!;
        for (const ci of touched) {
          const p = placed.get(ci)! + v;
          const o = open.get(ci)! - 1;
          if (p > cons[ci].need || p + o < cons[ci].need) ok = false;
        }
        if (!ok) continue;
        assign[i] = v;
        for (const ci of touched) {
          placed.set(ci, placed.get(ci)! + v);
          open.set(ci, open.get(ci)! - 1);
        }
        recurse(i + 1, mines + v);
        for (const ci of touched) {
          placed.set(ci, placed.get(ci)! - v);
          open.set(ci, open.get(ci)! + 1);
        }
        assign[i] = -1;
      }
    };
    recurse(0, 0);
    if (aborted || !any) continue;
    const safe = cells.filter((_, k) => !everMine[k]);
    const mine = cells.filter((_, k) => !everSafe[k]);
    const sources = compCons.map((ci) => cons[ci].src);
    if (safe.length) out.push({ kind: 'enum', sources, cells: safe, mine: false });
    if (mine.length) out.push({ kind: 'enum', sources, cells: mine, mine: true });
  }
  return out;
}

/** Every deduction of the simplest kind available, or [] if the position needs a guess. */
export function deduce(b: Board, know: Knowledge): Deduction[] {
  const cons = constraintsOf(b, know);
  const s = singles(cons);
  if (s.length) return s;
  const p = pairs(b, cons);
  if (p.length) return p;
  const c = countPass(b, know);
  if (c.length) return c;
  return enumerate(b, know, cons);
}

/** Can the whole board be cleared from `b.start` without guessing? */
export function solvable(b: Board): boolean {
  const know = new Uint8Array(b.w * b.h);
  openFrom(b, know, b.start);
  let safeLeft = b.w * b.h - b.mineCount;
  for (let i = 0; i < know.length; i++) if (know[i] === OPEN) safeLeft--;
  while (safeLeft > 0) {
    const ds = deduce(b, know);
    if (!ds.length) return false;
    for (const d of ds) {
      for (const x of d.cells) {
        if (know[x] !== HIDDEN) continue;
        if (d.mine) know[x] = MINE;
        else safeLeft -= openFrom(b, know, x).length;
      }
    }
  }
  return true;
}

// ---------------------------------------------------------------------------------------------
// Generator
// ---------------------------------------------------------------------------------------------

/**
 * A board with no guessing needed, built around the first square the player opens: that square
 * and its neighbours are mine-free, so it always opens an area. Same seed + same start = same board.
 */
export function generateBoard(seed: number, level: Level, start: number): Board {
  const { w, h, mines: count } = LEVELS[level];
  const nb = neighbourTable(w, h);
  const rng = createRng((Math.imul(seed | 0, 0x9e3779b1) ^ Math.imul(start + 1, 0x85ebca6b)) >>> 0);
  const banned = new Set([start, ...nb[start]]);
  const pool: number[] = [];
  for (let i = 0; i < w * h; i++) if (!banned.has(i)) pool.push(i);
  let last: Board | null = null;
  for (let attempt = 0; attempt < 4000; attempt++) {
    const mines = new Uint8Array(w * h);
    for (const i of rng.shuffle(pool).slice(0, count)) mines[i] = 1;
    const b = boardFrom(w, h, mines, start, nb);
    if (solvable(b)) return b;
    last = b;
  }
  return last!;
}

// ---------------------------------------------------------------------------------------------
// Hints
// ---------------------------------------------------------------------------------------------

export type Hint =
  | { kind: 'wrongFlag'; cell: number }
  | { kind: 'deduce'; cell: number; d: Deduction }
  | { kind: 'reveal'; cell: number };

/**
 * The next thing the player can be sure about, given what they've opened and flagged (`st` uses
 * HIDDEN / OPEN / MINE for flags). Wrong flags come first; then the simplest deduction, preferring
 * a safe square over a mine.
 */
export function hintFor(b: Board, st: Knowledge): Hint | null {
  for (let i = 0; i < st.length; i++) if (st[i] === MINE && !b.mines[i]) return { kind: 'wrongFlag', cell: i };
  const ds = deduce(b, st);
  const d = ds.find((x) => !x.mine) ?? ds[0];
  if (d) return { kind: 'deduce', cell: d.cells[0], d };
  for (let i = 0; i < st.length; i++) if (st[i] === HIDDEN && !b.mines[i]) return { kind: 'reveal', cell: i };
  return null;
}
