import { describe, expect, it } from 'vitest';
import { patchAt, resolveNew, resolveResize, type Patches } from './draw';
import type { Clue, Rect } from './generator';

const N = 6;
const clue = (r: number, c: number, size: number | null = null): Clue => ({ r, c, size, shape: 'any', color: '#000' }) as Clue;
const R = (r0: number, c0: number, r1: number, c1: number): Rect => ({ r0, c0, r1, c1 });
const cell = (r: number, c: number) => r * N + c;

// Clue 0 at (2,2) (a "6"), clue 1 at (2,5).
const clues = [clue(2, 2, 6), clue(2, 5, 4)];

describe('new rectangles', () => {
  it('become a patch only with exactly one clue — no merging', () => {
    expect(resolveNew(clues, R(2, 0, 2, 2))).toEqual({ kind: 'place', rect: R(2, 0, 2, 2), clue: 0 });
    expect(resolveNew(clues, R(1, 0, 1, 2)).kind).toBe('none'); // empty box next to/over a patch does nothing
    expect(resolveNew(clues, R(2, 0, 2, 5)).kind).toBe('multi');
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

  it('refuses to grow over another clue', () => {
    expect(resolveResize(clues, base, 0, cell(2, 5), N).kind).toBe('multi');
  });

  it('finds the patch under a cell', () => {
    const patches: Patches = [base, null];
    expect(patchAt(patches, cell(2, 1), N)).toBe(0);
    expect(patchAt(patches, cell(3, 1), N)).toBe(-1);
  });
});
