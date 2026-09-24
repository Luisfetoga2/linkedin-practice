/**
 * Drawing helpers for Wend's smoothly animated stroke. The animation model (a line state that
 * chases its target with an ease-out, plus the live "tip" toward the pointer) is shared with Zip;
 * this module adapts it to Wend's board (walls, locked found words, many lines) and turns line
 * states into SVG path data in board cell units (tile centres at x + 0.5).
 */
import { lineFor, lineGeometry, tipTarget, type LineState, type Segment } from '../zip/lineAnim';
import type { Grid, Line, Pt, Stroke } from './lines';

/** The tip re-arms once the pointer is this close (cell units) to the head's centre. */
export const TIP_ARM_RADIUS = 0.3;

const f = (v: number) => +v.toFixed(3);

/** Orthogonal neighbour of `cell` on the board, or -1 off the edge. */
export function neighbor(size: number, cell: number, dx: number, dy: number): number {
  const r = Math.floor(cell / size) + dy;
  const c = (cell % size) + dx;
  return r < 0 || c < 0 || r >= size || c >= size ? -1 : r * size + c;
}

/** Can the live tip reach toward v? Open tiles only: not a wall, a found word or the stroke itself. */
export function canTip(g: Grid, s: Pick<Stroke, 'active' | 'locked'>, v: number): boolean {
  return v >= 0 && !g.walls[v] && !s.locked.has(v) && !s.active.includes(v);
}

/** Is the pointer near enough to the head's centre for the tip to follow it? */
export function nearHead(size: number, head: number, p: Pt): boolean {
  const ox = Math.abs(p.x - ((head % size) + 0.5));
  const oy = Math.abs(p.y - (Math.floor(head / size) + 0.5));
  return Math.max(ox, oy) < TIP_ARM_RADIUS;
}

/**
 * Where the stroke's line should be drawn while the pointer is at `p`: the committed cells plus a
 * partial segment toward the legal neighbour the pointer is heading to (at most to the shared edge),
 * or the last segment shrinking when heading back to the previous tile.
 */
export function strokeTarget(g: Grid, s: Pick<Stroke, 'active' | 'locked'>, p: Pt | null): LineState {
  if (!p || s.active.length === 0) return lineFor(s.active);
  return tipTarget(
    s.active,
    g.size,
    p.x,
    p.y,
    (cell, dx, dy) => neighbor(g.size, cell, dx, dy),
    (v) => canTip(g, s, v),
  ).line;
}

/**
 * A merge (or un-merge) swaps whole lines in at once; the tiles were already drawn, so the line
 * jumps there instead of re-growing over them.
 */
export function shouldSnap(prev: Stroke | null, next: Stroke | null): boolean {
  if (!prev || !next) return false;
  return !!prev.merge !== !!next.merge || (!!next.merge && prev.merge?.before !== next.merge.before);
}

/** SVG path for a (possibly partially drawn) line; a single tile is a dot (round cap). */
export function linePathD(line: LineState, size: number): string {
  if (line.cells.length === 0) return '';
  const geo = lineGeometry(line, size, 1);
  const [sx, sy] = geo.start!;
  if (geo.segments.length === 0) return `M ${f(sx)} ${f(sy)} l 0 0`;
  return `M ${f(sx)} ${f(sy)} ` + geo.segments.map((sg) => `L ${f(sg.x2)} ${f(sg.y2)}`).join(' ');
}

const CHEV_H = 0.06; // half depth along the segment
const CHEV_W = 0.12; // half width across it (~24% of a tile overall)

/**
 * One small ">" per segment, at its midpoint, pointing in reading direction. A partially drawn
 * segment gets its chevron once the line has grown past the midpoint (so the live tip, which stops
 * at the tile edge, never shows one, and a growing segment shows it without flicker).
 */
export function chevronsD(segments: readonly Segment[]): string {
  let d = '';
  for (const sg of segments) {
    if (sg.frac <= 0.5 + 1e-3) continue;
    const dx = Math.sign(sg.x2 - sg.x1);
    const dy = Math.sign(sg.y2 - sg.y1);
    const mx = sg.x1 + dx / 2;
    const my = sg.y1 + dy / 2;
    // Back corners, tip, back corners: perpendicular is (-dy, dx).
    d += `M ${f(mx - dx * CHEV_H - dy * CHEV_W)} ${f(my - dy * CHEV_H + dx * CHEV_W)} L ${f(mx + dx * CHEV_H)} ${f(my + dy * CHEV_H)} L ${f(mx - dx * CHEV_H + dy * CHEV_W)} ${f(my - dy * CHEV_H - dx * CHEV_W)} `;
  }
  return d.trim();
}

export function lineChevronsD(line: LineState, size: number): string {
  return line.cells.length > 1 ? chevronsD(lineGeometry(line, size, 1).segments) : '';
}

/** Static (fully drawn) versions for the lines that aren't animating. */
export const staticPathD = (l: Line, size: number) => linePathD(lineFor(l), size);
export const staticChevronsD = (l: Line, size: number) => lineChevronsD(lineFor(l), size);
