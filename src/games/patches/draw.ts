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

/** Share at least one cell (merely touching doesn't count). */
function overlaps(a: Rect, b: Rect): boolean {
  return a.r0 <= b.r1 && b.r0 <= a.r1 && a.c0 <= b.c1 && b.c0 <= a.c1;
}

function cluesIn(clues: readonly Clue[], r: Rect): number[] {
  const out: number[] = [];
  clues.forEach((k, i) => rectContains(r, k.r, k.c) && out.push(i));
  return out;
}

/**
 * What a drag produces, LinkedIn-style (the box already covers every cell the drag passed):
 * - A box holding exactly one clue becomes that clue's patch (replacing whatever it overlaps).
 * - An empty box that overlaps a patch merges with it (the result is the rectangle covering
 *   both), as long as the result still holds exactly one clue.
 */
export function resolveDraw(patches: Patches, clues: readonly Clue[], box: Rect, startCell: number, n: number): DrawOutcome {
  const sr = Math.floor(startCell / n);
  const sc = startCell % n;
  const inside = cluesIn(clues, box);
  if (inside.length === 1) return { kind: 'place', rect: box, clue: inside[0] };
  if (inside.length > 1) return { kind: 'multi' };

  let best: { rect: Rect; clue: number; score: number } | null = null;
  for (let clue = 0; clue < patches.length; clue++) {
    const p = patches[clue];
    if (!p || !overlaps(p, box)) continue;
    const rect = bbox(p, box);
    const held = cluesIn(clues, rect);
    if (held.length !== 1 || held[0] !== clue) continue;
    // Prefer the patch the drag started on, then the tightest result.
    const score = area(rect) - (rectContains(p, sr, sc) ? 1000 : 0);
    if (!best || score < best.score) best = { rect, clue, score };
  }
  if (best) return { kind: 'place', rect: best.rect, clue: best.clue };
  return { kind: 'none' };
}
