import { describe, expect, it } from 'vitest';
import { canStillFit, clampGrow, fitProblem, overlapsPatch, patchAt, resolveNew, resolveResize, type Patches } from './draw';
import type { Clue, Rect, Shape } from './generator';

const N = 6;
const clue = (r: number, c: number, size: number | null = null, shape: Shape = 'any'): Clue => ({ r, c, size, shape, color: '#000' });
const R = (r0: number, c0: number, r1: number, c1: number): Rect => ({ r0, c0, r1, c1 });
const cell = (r: number, c: number) => r * N + c;

// Clue 0 at (2,2) (a "6"), clue 1 at (2,5).
const clues = [clue(2, 2, 6), clue(2, 5, 4)];

describe('new rectangles', () => {
  it('become a patch only with exactly one clue — no merging', () => {
    expect(resolveNew(clues, R(2, 0, 2, 2))).toEqual({ kind: 'place', rect: R(2, 0, 2, 2), clue: 0 });
    expect(resolveNew(clues, R(1, 0, 1, 2)).kind).toBe('none');
    expect(resolveNew(clues, R(2, 0, 2, 5)).kind).toBe('multi');
  });

  it('never take in a second clue: the box stops just before it', () => {
    expect(clampGrow(R(2, 0, 2, 0), cell(2, 5), N, [], -1, clues)).toEqual(R(2, 0, 2, 4)); // across the 6, stops before the 4
    expect(clampGrow(R(0, 1, 0, 1), cell(4, 5), N, [], -1, clues)).toEqual(R(0, 1, 4, 4)); // diagonal: keeps the 6, stops a column short of the 4
    expect(clampGrow(R(0, 0, 0, 0), cell(1, 1), N, [], -1, clues)).toEqual(R(0, 0, 1, 1)); // no clue yet: grows freely
  });

  it('never grow over an existing patch (LinkedIn): the box stops at its edge', () => {
    const patches: Patches = [null, R(1, 4, 3, 5)]; // clue 1's patch
    // Dragging from (2,0) straight right stops before column 4.
    expect(clampGrow(R(2, 0, 2, 0), cell(2, 5), N, patches)).toEqual(R(2, 0, 2, 3));
    // Diagonal drag into the patch keeps the biggest free box (rows grow, columns stop).
    expect(clampGrow(R(0, 0, 0, 0), cell(3, 5), N, patches)).toEqual(R(0, 0, 3, 3));
    // Free target: unchanged.
    expect(clampGrow(R(4, 0, 4, 0), cell(5, 5), N, patches)).toEqual(R(4, 0, 5, 5));
    // Can't cover the clue cell of a clue that already has a patch.
    const box = clampGrow(R(2, 3, 2, 3), cell(2, 5), N, patches);
    expect(overlapsPatch(patches, box)).toBe(false);
    expect(box).toEqual(R(2, 3, 2, 3));
  });

  it('treats incomplete and wrong patches as blocking too', () => {
    const patches: Patches = [R(2, 2, 2, 3), null]; // an incomplete "6"
    expect(clampGrow(R(2, 0, 2, 0), cell(2, 5), N, patches)).toEqual(R(2, 0, 2, 1));
  });
});

describe('resizing (LinkedIn video)', () => {
  const base = R(2, 0, 2, 2); // 1×3 patch holding the "6"

  it('grows toward the cell under the pointer', () => {
    expect(resolveResize(clues, base, 0, cell(1, 1), N)).toEqual({ kind: 'place', rect: R(1, 0, 2, 2), clue: 0 });
    expect(resolveResize(clues, base, 0, cell(3, 1), N)).toEqual({ kind: 'place', rect: R(2, 0, 3, 2), clue: 0 });
  });

  it('shrinks back when the pointer returns inside the patch', () => {
    expect(resolveResize(clues, base, 0, cell(2, 1), N)).toEqual({ kind: 'place', rect: base, clue: 0 });
  });

  it('stops just before another clue', () => {
    expect(resolveResize(clues, base, 0, cell(2, 5), N)).toEqual({ kind: 'place', rect: R(2, 0, 2, 4), clue: 0 });
    expect(resolveResize(clues, base, 0, cell(3, 5), N)).toEqual({ kind: 'place', rect: R(2, 0, 3, 4), clue: 0 });
  });

  it('stops at other patches but ignores itself', () => {
    const patches: Patches = [base, R(3, 0, 4, 1)];
    expect(resolveResize(clues, base, 0, cell(4, 2), N, patches)).toEqual({ kind: 'place', rect: R(2, 0, 2, 2), clue: 0 });
    expect(resolveResize(clues, base, 0, cell(4, 3), N, patches)).toEqual({ kind: 'place', rect: R(2, 0, 2, 3), clue: 0 });
    expect(resolveResize(clues, base, 0, cell(0, 2), N, patches)).toEqual({ kind: 'place', rect: R(0, 0, 2, 2), clue: 0 });
  });

  it('finds the patch under a cell', () => {
    const patches: Patches = [base, null];
    expect(patchAt(patches, cell(2, 1), N)).toBe(0);
    expect(patchAt(patches, cell(3, 1), N)).toBe(-1);
  });
});

describe('canStillFit / fitProblem', () => {
  it('flags patches bigger than their number', () => {
    expect(canStillFit(R(0, 0, 3, 0), clue(2, 0, 3), N)).toBe(false);
    expect(fitProblem(R(0, 0, 3, 0), clue(2, 0, 3), N)).toBe('area');
    expect(fitProblem(R(0, 0, 2, 0), clue(2, 0, 3), N)).toBeNull();
  });

  it('lets incomplete patches that can still grow pass', () => {
    expect(fitProblem(R(0, 0, 0, 1), clue(0, 0, 6), N)).toBeNull();
    expect(fitProblem(R(0, 0, 1, 0), clue(0, 0, 6, 'tall'), N)).toBeNull(); // tall 2×1 → 3×2
    expect(fitProblem(R(0, 0, 1, 1), clue(0, 0, null, 'square'), N)).toBeNull(); // → 3×3
    expect(fitProblem(R(0, 0, 5, 5), clue(0, 0), N)).toBeNull(); // joker
  });

  it('checks a shape clue on the patch as drawn, even if a bigger one would fit', () => {
    expect(fitProblem(R(0, 0, 0, 1), clue(0, 0, null, 'tall'), N)).toBe('tall'); // wide 1×2 for a tall clue
    expect(fitProblem(R(0, 0, 1, 1), clue(0, 0, 6, 'tall'), N)).toBe('tall'); // square 2×2
    expect(fitProblem(R(0, 0, 0, 1), clue(0, 0, null, 'square'), N)).toBe('square');
    expect(fitProblem(R(0, 0, 1, 0), clue(0, 0, null, 'wide'), N)).toBe('wide');
  });

  it('flags shapes no bigger rectangle can fix', () => {
    expect(fitProblem(R(0, 0, 1, 1), clue(0, 0, 4, 'wide'), N)).toBe('wide'); // "wide 4" drawn 2×2
    expect(fitProblem(R(0, 0, 0, 2), clue(0, 0, 4, 'tall'), N)).toBe('tall');
    expect(fitProblem(R(0, 0, 0, 3), clue(0, 0, 4, 'square'), N)).toBe('square');
    expect(fitProblem(R(0, 0, 5, 0), clue(0, 0, null, 'wide'), N)).toBe('wide'); // full-height column
  });

  it('flags a number no rectangle around the patch can reach', () => {
    expect(fitProblem(R(0, 0, 1, 1), clue(0, 0, 5), N)).toBe('noFit'); // 5 = 1×5 only
    expect(fitProblem(R(0, 0, 0, 1), clue(0, 0, 7), N)).toBe('noFit'); // 7 cells don't fit a 6×6 line
  });
});
