/**
 * Pure helpers for the smoothly animated Zip line.
 *
 * The line is described by a `LineState`: a list of cells plus a continuous `pos` measured in
 * segments along that list (0 = only the start cell, 2.4 = two full segments and 40% of the third).
 * The displayed state chases the target state along the board: when the two diverge it first
 * retracts back to their common prefix, then grows along the new cells.
 */

export interface LineState {
  cells: readonly number[];
  pos: number;
}

export const EMPTY_LINE: LineState = { cells: [], pos: 0 };

const EPS = 1e-6;

export function lineFor(cells: readonly number[]): LineState {
  return { cells, pos: Math.max(0, cells.length - 1) };
}

function commonPrefix(a: readonly number[], b: readonly number[]): number {
  const n = Math.min(a.length, b.length);
  let k = 0;
  while (k < n && a[k] === b[k]) k++;
  return k;
}

export function sameLine(a: LineState, b: LineState): boolean {
  if (a.cells.length !== b.cells.length || Math.abs(a.pos - b.pos) > EPS) return false;
  return commonPrefix(a.cells, b.cells) === a.cells.length;
}

/** Total distance (in segments) the displayed line has to travel to reach the target. */
export function routeDistance(d: LineState, t: LineState): number {
  if (d.cells.length === 0) return t.cells.length === 0 ? 0 : t.pos;
  const k = commonPrefix(d.cells, t.cells);
  if (t.cells.length === 0 || k === 0) return d.pos + (t.cells.length ? t.pos : 0);
  if (d.pos <= k - 1 + EPS) return Math.abs(t.pos - d.pos);
  return d.pos - (k - 1) + Math.abs(t.pos - (k - 1));
}

/** Moves the displayed line `dist` segments along the route toward the target. */
export function advanceLine(disp: LineState, t: LineState, dist: number): LineState {
  let d = disp;
  let s = Math.max(0, dist);
  if (d.cells.length === 0) {
    if (t.cells.length === 0) return EMPTY_LINE;
    d = { cells: t.cells, pos: 0 };
  }
  for (let guard = 0; guard < 4; guard++) {
    const k = commonPrefix(d.cells, t.cells);
    if (t.cells.length === 0 || k === 0) {
      // Different start (or cleared): shrink to the start cell, then jump.
      if (d.pos > s + EPS) return { cells: d.cells, pos: d.pos - s };
      s -= d.pos;
      if (t.cells.length === 0) return EMPTY_LINE;
      d = { cells: t.cells, pos: 0 };
      continue;
    }
    if (d.pos <= k - 1 + EPS) {
      const delta = t.pos - d.pos;
      if (Math.abs(delta) <= s + EPS) return { cells: t.cells, pos: t.pos };
      return { cells: t.cells, pos: d.pos + Math.sign(delta) * s };
    }
    const r = d.pos - (k - 1);
    if (r > s + EPS) return { cells: d.cells, pos: d.pos - s };
    s -= r;
    d = { cells: t.cells, pos: k - 1 };
  }
  return t;
}

export const TAU_MS = 24;
const MIN_SPEED = 1 / 220; // segments per ms, so the exponential tail finishes promptly

/**
 * One animation frame: ease-out (exponential approach) toward the target, so the time to settle is
 * roughly independent of distance (≈ 90 ms for one cell, ≲ 180 ms even when many cells change).
 */
export function stepLine(disp: LineState, t: LineState, dtMs: number): LineState {
  const r = routeDistance(disp, t);
  if (r <= EPS) return sameLine(disp, t) ? disp : t;
  const dt = Math.min(Math.max(dtMs, 0), 64);
  let move = r * (1 - Math.exp(-dt / TAU_MS));
  move = Math.max(move, dt * MIN_SPEED);
  if (r - move < 0.003) return t;
  return advanceLine(disp, t, move);
}

export interface Segment {
  /** Index of the segment along the line (its colour runs from index to index + frac). */
  index: number;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  frac: number;
}

export interface LineGeometry {
  segments: Segment[];
  start: [number, number] | null;
  head: [number, number] | null;
  /** How many cells (from the start) the line has reached, for the cell tints. */
  reached: number;
}

/** Converts a line state into drawable segments, in SVG units with `unit` per cell. */
export function lineGeometry(line: LineState, size: number, unit: number): LineGeometry {
  const { cells } = line;
  if (cells.length === 0) return { segments: [], start: null, head: null, reached: 0 };
  const cx = (c: number) => (c % size) * unit + unit / 2;
  const cy = (c: number) => Math.floor(c / size) * unit + unit / 2;
  const pos = Math.min(Math.max(line.pos, 0), cells.length - 1);
  const segments: Segment[] = [];
  const whole = Math.floor(pos + EPS);
  for (let i = 0; i < whole; i++) {
    segments.push({ index: i, x1: cx(cells[i]), y1: cy(cells[i]), x2: cx(cells[i + 1]), y2: cy(cells[i + 1]), frac: 1 });
  }
  let head: [number, number] = [cx(cells[whole]), cy(cells[whole])];
  const frac = pos - whole;
  if (frac > EPS && whole + 1 < cells.length) {
    const a = cells[whole];
    const b = cells[whole + 1];
    const x2 = cx(a) + (cx(b) - cx(a)) * frac;
    const y2 = cy(a) + (cy(b) - cy(a)) * frac;
    segments.push({ index: whole, x1: cx(a), y1: cy(a), x2, y2, frac });
    head = [x2, y2];
  }
  // A cell counts as reached once the line crosses into it (past the shared edge).
  const reached = Math.min(cells.length, Math.floor(pos + 0.5 - EPS) + 1);
  return { segments, start: [cx(cells[0]), cy(cells[0])], head, reached };
}

export const MAX_TIP = 0.5;
const MAX_RETRACT_TIP = 0.45;

/**
 * The live "tip" while dragging: the committed path plus a partial segment toward the neighbour the
 * pointer is heading to. `fx`/`fy` are the pointer coordinates in cell units. `neighbor(dir)` returns
 * the adjacent cell in that direction (or -1), `canExtend(v)` whether v is a legal next cell.
 */
export function tipTarget(
  path: readonly number[],
  size: number,
  fx: number,
  fy: number,
  neighbor: (cell: number, dx: number, dy: number) => number,
  canExtend: (cell: number) => boolean,
): { line: LineState; virtual: number } {
  const base = lineFor(path);
  if (path.length === 0) return { line: base, virtual: -1 };
  const head = path[path.length - 1];
  const ox = fx - ((head % size) + 0.5);
  const oy = fy - (Math.floor(head / size) + 0.5);
  const horiz = Math.abs(ox) >= Math.abs(oy);
  const amount = horiz ? Math.abs(ox) : Math.abs(oy);
  if (amount < 0.02) return { line: base, virtual: -1 };
  const v = horiz ? neighbor(head, Math.sign(ox), 0) : neighbor(head, 0, Math.sign(oy));
  if (v < 0) return { line: base, virtual: -1 };
  if (path.length >= 2 && v === path[path.length - 2]) {
    return { line: { cells: path, pos: path.length - 1 - Math.min(amount, MAX_RETRACT_TIP) }, virtual: -1 };
  }
  if (!canExtend(v)) return { line: base, virtual: -1 };
  return { line: { cells: [...path, v], pos: path.length - 1 + Math.min(amount, MAX_TIP) }, virtual: v };
}
