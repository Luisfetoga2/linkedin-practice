import { fitsClue, rectArea, rectContains, rectsOverlap, shapeOf, type Clue, type Rect } from './generator';

export type Patches = (Rect | null)[];

export type DrawOutcome =
  | { kind: 'place'; rect: Rect; clue: number }
  | { kind: 'none' }
  | { kind: 'multi' };

export function bbox(a: Rect, b: Rect): Rect {
  return { r0: Math.min(a.r0, b.r0), c0: Math.min(a.c0, b.c0), r1: Math.max(a.r1, b.r1), c1: Math.max(a.c1, b.c1) };
}

export function cellRect(cell: number, n: number): Rect {
  const r = Math.floor(cell / n);
  const c = cell % n;
  return { r0: r, c0: c, r1: r, c1: c };
}

function cluesIn(clues: readonly Clue[], r: Rect): number[] {
  const out: number[] = [];
  clues.forEach((k, i) => rectContains(r, k.r, k.c) && out.push(i));
  return out;
}

/** The patch (index = its clue) covering `cell`, or -1. */
export function patchAt(patches: Patches, cell: number, n: number): number {
  const r = Math.floor(cell / n);
  const c = cell % n;
  return patches.findIndex((p) => p && rectContains(p, r, c));
}

/** Does `rect` cover a cell of any patch other than `skip`? */
export function overlapsPatch(patches: Patches, rect: Rect, skip = -1): boolean {
  return patches.some((p, i) => i !== skip && !!p && rectsOverlap(p, rect));
}

/**
 * LinkedIn never lets a rectangle cover a drawn patch, or take in a second clue. Grows `base`
 * toward `cell` as far as it can without either (`skip` = the patch being resized): of the
 * rectangles spanning `base` plus one cell between it and the pointer, the largest allowed one wins
 * (ties: closest to the pointer). `base` itself is assumed allowed, so the result never shrinks
 * below it.
 */
export function clampGrow(base: Rect, cell: number, n: number, patches: Patches, skip = -1, clues: readonly Clue[] = []): Rect {
  const blocked = (rect: Rect) => overlapsPatch(patches, rect, skip) || cluesIn(clues, rect).length > 1;
  const target = bbox(base, cellRect(cell, n));
  if (!blocked(target)) return target;
  const tr = Math.floor(cell / n);
  const tc = cell % n;
  let best = base;
  let bestArea = rectArea(base);
  let bestDist = Infinity;
  for (let r = target.r0; r <= target.r1; r++) {
    for (let c = target.c0; c <= target.c1; c++) {
      const rect = bbox(base, { r0: r, c0: c, r1: r, c1: c });
      const area = rectArea(rect);
      if (area < bestArea) continue;
      const dist = Math.abs(r - tr) + Math.abs(c - tc);
      if (area === bestArea && dist >= bestDist) continue;
      if (blocked(rect)) continue;
      best = rect;
      bestArea = area;
      bestDist = dist;
    }
  }
  return best;
}

/**
 * A new rectangle (drag started on an uncovered cell). `box` already covers every cell the drag
 * passed through. It becomes a patch only if it holds exactly one clue; there is no merging.
 */
export function resolveNew(clues: readonly Clue[], box: Rect): DrawOutcome {
  const inside = cluesIn(clues, box);
  if (inside.length === 1) return { kind: 'place', rect: box, clue: inside[0] };
  return { kind: inside.length ? 'multi' : 'none' };
}

/**
 * Resizing (drag started on an existing patch), as in LinkedIn: the patch spans its original
 * rectangle plus the cell currently under the pointer, so it grows and shrinks back as you move.
 * It stops at other patches and other clues (see clampGrow).
 */
export function resizeRect(base: Rect, clue: number, cell: number, n: number, patches: Patches = [], clues: readonly Clue[] = []): Rect {
  return clampGrow(base, cell, n, patches, clue, clues);
}

export function resolveResize(
  clues: readonly Clue[],
  base: Rect,
  clue: number,
  cell: number,
  n: number,
  patches: Patches = [],
): DrawOutcome {
  const rect = resizeRect(base, clue, cell, n, patches, clues);
  const inside = cluesIn(clues, rect);
  if (inside.length === 1 && inside[0] === clue) return { kind: 'place', rect, clue };
  return { kind: 'multi' };
}

/** Is there a rectangle containing `rect`, inside the n×n board, that satisfies the clue's size/shape? */
export function canStillFit(rect: Rect, clue: Pick<Clue, 'size' | 'shape'>, n: number): boolean {
  if (clue.size != null && rectArea(rect) > clue.size) return false;
  for (let r0 = rect.r0; r0 >= 0; r0--) {
    for (let r1 = rect.r1; r1 < n; r1++) {
      for (let c0 = rect.c0; c0 >= 0; c0--) {
        for (let c1 = rect.c1; c1 < n; c1++) {
          const cand = { r0, c0, r1, c1 };
          if (clue.size != null && rectArea(cand) > clue.size) break; // wider only gets bigger
          if (fitsClue(cand, clue)) return true;
        }
      }
    }
  }
  return false;
}

/** Why a patch can never become valid by growing (null = it still can). */
export type FitProblem = 'area' | 'noFit' | 'square' | 'wide' | 'tall';

export function fitProblem(rect: Rect, clue: Pick<Clue, 'size' | 'shape'>, n: number): FitProblem | null {
  // As in LinkedIn, a shape clue is checked on what you drew, not on what it could grow into:
  // a wide patch for a "taller than wide" clue is wrong even if a bigger one would fit.
  if (clue.shape !== 'any' && shapeOf(rect) !== clue.shape) return clue.shape;
  if (canStillFit(rect, clue, n)) return null;
  if (clue.size != null && rectArea(rect) > clue.size) return 'area';
  if (clue.shape !== 'any') return clue.shape;
  return 'noFit';
}
