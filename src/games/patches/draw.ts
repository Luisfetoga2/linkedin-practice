import { rectContains, type Clue, type Rect } from './generator';

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
 */
export function resolveResize(clues: readonly Clue[], base: Rect, clue: number, cell: number, n: number): DrawOutcome {
  const rect = bbox(base, cellRect(cell, n));
  const inside = cluesIn(clues, rect);
  if (inside.length === 1 && inside[0] === clue) return { kind: 'place', rect, clue };
  return { kind: 'multi' };
}
