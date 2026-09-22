/**
 * Wend board model: a set of drawn LINES. Each line is an ordered list of
 * orthogonally adjacent open cells; no cell belongs to two lines. Lines persist
 * after the pointer is released, whether or not they spell a word.
 *
 * A stroke (pointer down -> up) edits the set:
 * - Starting on an empty tile begins a new line there.
 * - Starting on tile k of an existing line L continues L from that tile:
 *   L is truncated to L[0..k] and the stroke extends from L[k].
 * - Stepping onto an endpoint of another line M merges: onto M's first tile ->
 *   current + M; onto M's last tile -> current + reverse(M). The head jumps to
 *   the far end of the merged line ("merge mode"): while the pointer rides along
 *   the merged tiles nothing changes, reaching the head (or a free neighbour of
 *   it) keeps extending from there, and backing out onto the tile the stroke
 *   came from undoes the merge (M is restored).
 * - Stepping onto a middle tile of another line M deletes M entirely and the
 *   stroke continues through that tile.
 * - Stepping onto a tile of the stroke's own line retracts back to that tile.
 * - Walls can't be entered; steps must be orthogonal to the head (except
 *   retracting, which works from anywhere).
 */

export type Line = number[];

export interface Grid {
  size: number;
  /** true = wall tile. */
  walls: boolean[];
}

export interface Stroke {
  /** Lines that aren't being drawn. */
  others: Line[];
  /** The line being drawn; its last cell is the head. */
  active: Line;
  /** Set right after a merge carried the head away from the pointer. */
  merge: { before: Stroke; from: number } | null;
}

export function adjacent(size: number, a: number, b: number): boolean {
  const dr = Math.abs(Math.floor(a / size) - Math.floor(b / size));
  const dc = Math.abs((a % size) - (b % size));
  return dr + dc === 1;
}

const isOpen = (g: Grid, c: number) => Number.isInteger(c) && c >= 0 && c < g.size * g.size && !g.walls[c];

/** Begin a stroke on cell c. Returns null when c can't be drawn on (a wall). */
export function beginStroke(g: Grid, lines: Line[], c: number): Stroke | null {
  if (!isOpen(g, c)) return null;
  // Single-tile lines are just a "selected tile"; they don't outlive the next stroke.
  const kept = lines.filter((l) => l.length > 1 || l[0] === c);
  const i = kept.findIndex((l) => l.includes(c));
  if (i < 0) return { others: kept, active: [c], merge: null };
  const L = kept[i];
  return { others: kept.filter((_, j) => j !== i), active: L.slice(0, L.indexOf(c) + 1), merge: null };
}

/**
 * Move the stroke onto cell d (the pointer entered it). Returns `s` itself
 * when nothing changes, so callers can compare by identity.
 */
export function stepStroke(g: Grid, s: Stroke, d: number): Stroke {
  if (!isOpen(g, d)) return s;
  const head = s.active[s.active.length - 1];
  if (d === head) return s.merge ? { ...s, merge: null } : s;
  if (s.merge) {
    if (d === s.merge.from) return s.merge.before;
    // Riding along the tiles that were just merged in.
    if (s.active.includes(d)) return s;
  }
  const idx = s.active.indexOf(d);
  if (idx >= 0) return { others: s.others, active: s.active.slice(0, idx + 1), merge: null };
  if (!adjacent(g.size, head, d)) return s;
  const mi = s.others.findIndex((l) => l.includes(d));
  if (mi < 0) return { others: s.others, active: [...s.active, d], merge: null };
  const M = s.others[mi];
  const rest = s.others.filter((_, j) => j !== mi);
  const j = M.indexOf(d);
  if (j === 0 || j === M.length - 1) {
    const tail = j === 0 ? M : [...M].reverse();
    return { others: rest, active: [...s.active, ...tail], merge: tail.length > 1 ? { before: s, from: head } : null };
  }
  return { others: rest, active: [...s.active, d], merge: null };
}

/** True when entering d would move the stroke backwards (retract / un-merge). */
export function isBackStep(s: Stroke, d: number): boolean {
  if (s.merge) return d === s.merge.from;
  return s.active.includes(d) && d !== s.active[s.active.length - 1];
}

export function strokeLines(s: Stroke): Line[] {
  return [...s.others, s.active];
}

/** Lines that matter for undo / win (single tiles are just a selection). */
export function sameBoard(a: Line[], b: Line[]): boolean {
  const key = (ls: Line[]) =>
    ls
      .filter((l) => l.length > 1)
      .map((l) => l.join(','))
      .sort()
      .join('|');
  return key(a) === key(b);
}

// ---------------------------------------------------------------------------
// Word evaluation

export interface WordDef {
  word: string;
  path: number[];
}

/**
 * For each line, the index of the hidden word it spells (in its own order), or
 * -1. Each hidden word goes to at most one line: a line on the intended tiles
 * wins, otherwise the earliest line.
 */
export function assignWords(lines: Line[], letters: string[], words: WordDef[]): number[] {
  const out = lines.map(() => -1);
  const spelled = lines.map((l) => l.map((c) => letters[c]).join(''));
  words.forEach((hw, w) => {
    let pick = -1;
    for (let i = 0; i < lines.length; i++) {
      if (out[i] >= 0 || spelled[i] !== hw.word) continue;
      if (lines[i].every((c, k) => hw.path[k] === c)) {
        pick = i;
        break;
      }
      if (pick < 0) pick = i;
    }
    if (pick >= 0) out[pick] = w;
  });
  return out;
}

// ---------------------------------------------------------------------------
// Pointer tracking: board-space pointer samples -> the ordered cells entered.

export interface Pt {
  /** Board coordinates in cell units (0..size). */
  x: number;
  y: number;
}

/** How far past the shared edge (fraction of a cell) the pointer must go. */
export const ENTER_MARGIN = 0.06;
export const BACK_MARGIN = 0.25;
const SAMPLE = 0.08;

export function cellAt(size: number, p: Pt): number {
  const clamp = (v: number) => Math.min(size - 1, Math.max(0, Math.floor(v)));
  return clamp(p.y) * size + clamp(p.x);
}

export interface TrackCallbacks {
  /** Can the pointer enter c at all? (false for walls: the pointer stays put.) */
  canEnter(c: number): boolean;
  /** Is entering c a backwards move (needs the larger margin)? */
  isBack(c: number): boolean;
  /** The pointer entered c (always orthogonally adjacent to the previous cell). */
  enter(c: number): void;
}

/**
 * Walk the pointer from `from` to `to`, starting in cell `cur`, and report each
 * orthogonal cell it enters, in order. Fast moves are sampled finely so skipped
 * tiles still register; a corner cut steps through the orthogonal neighbour the
 * path went furthest into, or the open one when the other is a wall. Returns
 * the new current cell.
 */
export function trackPointer(size: number, cur: number, from: Pt, to: Pt, cb: TrackCallbacks): number {
  const lim = (v: number) => Math.min(size - 1e-3, Math.max(1e-3, v));
  const dist = Math.hypot(to.x - from.x, to.y - from.y);
  const n = Math.max(1, Math.ceil(dist / SAMPLE));
  for (let i = 1; i <= n; i++) {
    const t = i / n;
    const p = { x: lim(from.x + (to.x - from.x) * t), y: lim(from.y + (to.y - from.y) * t) };
    const tx = Math.floor(p.x);
    const ty = Math.floor(p.y);
    for (let guard = 0; guard < 2 * size; guard++) {
      const cr = Math.floor(cur / size);
      const cc = cur % size;
      if (tx === cc && ty === cr) break;
      const opts: { c: number; over: number }[] = [];
      if (tx !== cc) {
        const sx = Math.sign(tx - cc);
        opts.push({ c: cur + sx, over: Math.abs(p.x - (cc + 0.5)) - 0.5 });
      }
      if (ty !== cr) {
        const sy = Math.sign(ty - cr);
        opts.push({ c: cur + sy * size, over: Math.abs(p.y - (cr + 0.5)) - 0.5 });
      }
      const ok = opts
        .filter((o) => cb.canEnter(o.c) && o.over >= (cb.isBack(o.c) ? BACK_MARGIN : ENTER_MARGIN))
        .sort((a, b) => b.over - a.over);
      if (!ok.length) break;
      const pick = ok[0];
      cb.enter(pick.c);
      cur = pick.c;
    }
  }
  return cur;
}
