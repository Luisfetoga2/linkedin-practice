import { rectContains, type Clue, type Rect } from './generator';

export type Patches = (Rect | null)[];

export type DrawOutcome =
  | { kind: 'place'; rect: Rect; clue: number }
  | { kind: 'none' }
  | { kind: 'multi' };

const area = (r: Rect) => (r.r1 - r.r0 + 1) * (r.c1 - r.c0 + 1);

export function bbox(a: Rect, b: Rect): Rect {
  return { r0: Math.min(a.r0, b.r0), c0: Math.min(a.c0, b.c0), r1: Math.max(a.r1, b.r1), c1: Math.max(a.c1, b.c1) };
}

/** Overlapping or sharing an edge. */
function touches(a: Rect, b: Rect): boolean {
  const rowsMeet = a.r0 <= b.r1 + 1 && b.r0 <= a.r1 + 1;
  const colsMeet = a.c0 <= b.c1 + 1 && b.c0 <= a.c1 + 1;
  const rowsOverlap = a.r0 <= b.r1 && b.r0 <= a.r1;
  const colsOverlap = a.c0 <= b.c1 && b.c0 <= a.c1;
  return (rowsOverlap && colsMeet) || (colsOverlap && rowsMeet);
}

function cluesIn(clues: readonly Clue[], r: Rect): number[] {
  const out: number[] = [];
  clues.forEach((k, i) => rectContains(r, k.r, k.c) && out.push(i));
  return out;
}

/**
 * What a drag produces, LinkedIn-style:
 * - Starting on an existing patch extends it to cover every cell the drag went through.
 * - Otherwise the dragged box becomes a patch if it holds exactly one clue.
 * - An empty box merges with a patch it touches (the result is the rectangle covering both),
 *   as long as the result still holds exactly one clue.
 */
export function resolveDraw(patches: Patches, clues: readonly Clue[], box: Rect, startCell: number, n: number): DrawOutcome {
  const sr = Math.floor(startCell / n);
  const sc = startCell % n;
  const startPatch = patches.findIndex((p) => p && rectContains(p, sr, sc));
  if (startPatch >= 0) {
    const rect = bbox(patches[startPatch]!, box);
    const inside = cluesIn(clues, rect);
    if (inside.length === 1 && inside[0] === startPatch) return { kind: 'place', rect, clue: startPatch };
    // Dragging from a patch toward a different clue: treat it as a fresh rectangle.
  }
  const inside = cluesIn(clues, box);
  if (inside.length === 1) return { kind: 'place', rect: box, clue: inside[0] };
  if (inside.length > 1) return { kind: 'multi' };

  let best: { rect: Rect; clue: number; score: number } | null = null;
  for (let clue = 0; clue < patches.length; clue++) {
    const p = patches[clue];
    if (!p || !touches(p, box)) continue;
    const rect = bbox(p, box);
    const held = cluesIn(clues, rect);
    if (held.length !== 1 || held[0] !== clue) continue;
    // Prefer the patch the drag started next to, then the tightest result.
    const nearStart = sr >= p.r0 - 1 && sr <= p.r1 + 1 && sc >= p.c0 - 1 && sc <= p.c1 + 1;
    const score = area(rect) - (nearStart ? 1000 : 0);
    if (!best || score < best.score) best = { rect, clue, score };
  }
  if (best) return { kind: 'place', rect: best.rect, clue: best.clue };
  return { kind: 'none' };
}
