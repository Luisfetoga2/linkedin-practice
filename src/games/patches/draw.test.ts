import { describe, expect, it } from 'vitest';
import { resolveDraw, type Patches } from './draw';
import type { Clue, Rect } from './generator';

const N = 6;
const clue = (r: number, c: number, size: number | null = null): Clue => ({ r, c, size, shape: 'any', color: '#000' }) as Clue;
const R = (r0: number, c0: number, r1: number, c1: number): Rect => ({ r0, c0, r1, c1 });
const cell = (r: number, c: number) => r * N + c;

// Clue 0 at (2,0) (a "6"), clue 1 at (2,4).
const clues = [clue(2, 0, 6), clue(2, 4, 4)];

describe('resolveDraw', () => {
  it('places a box holding exactly one clue', () => {
    expect(resolveDraw([null, null], clues, R(2, 0, 2, 1), cell(2, 0), N)).toEqual({ kind: 'place', rect: R(2, 0, 2, 1), clue: 0 });
  });

  it('rejects boxes with two clues or none (with nothing to merge into)', () => {
    expect(resolveDraw([null, null], clues, R(2, 0, 2, 4), cell(2, 0), N).kind).toBe('multi');
    expect(resolveDraw([null, null], clues, R(0, 0, 0, 1), cell(0, 0), N).kind).toBe('none');
  });

  it('extends a patch when the drag starts on it, covering every cell passed', () => {
    const patches: Patches = [R(2, 0, 2, 1), null];
    // Start on the right cell of the patch and drag down one row: result spans both columns.
    expect(resolveDraw(patches, clues, R(2, 1, 3, 1), cell(2, 1), N)).toEqual({ kind: 'place', rect: R(2, 0, 3, 1), clue: 0 });
    // Start on the patch and drag up through two rows.
    expect(resolveDraw(patches, clues, R(0, 1, 2, 1), cell(2, 1), N)).toEqual({ kind: 'place', rect: R(0, 0, 2, 1), clue: 0 });
  });

  it('merges an empty box that touches a patch (the screenshot case)', () => {
    // Patch is the middle row; drawing the empty row above or below merges.
    const patches: Patches = [R(2, 0, 2, 1), null];
    expect(resolveDraw(patches, clues, R(1, 0, 1, 1), cell(1, 0), N)).toEqual({ kind: 'place', rect: R(1, 0, 2, 1), clue: 0 });
    // A partial box against the patch merges into the covering rectangle.
    expect(resolveDraw(patches, clues, R(3, 1, 4, 1), cell(4, 1), N)).toEqual({ kind: 'place', rect: R(2, 0, 4, 1), clue: 0 });
  });

  it('never merges into a result holding two clues', () => {
    // Growing the patch to cover this box would also swallow clue 1 at (2,4).
    expect(resolveDraw([R(2, 0, 2, 1), null], clues, R(3, 1, 3, 4), cell(3, 4), N).kind).toBe('none');
    // Dragging from a patch onto another clue can't extend it; the box is a fresh patch for that clue.
    expect(resolveDraw([R(2, 0, 2, 1), null], clues, R(2, 1, 2, 4), cell(2, 1), N)).toEqual({ kind: 'place', rect: R(2, 1, 2, 4), clue: 1 });
    // ...and a box covering both clues is refused.
    expect(resolveDraw([R(2, 0, 2, 1), null], clues, R(2, 0, 2, 4), cell(2, 1), N).kind).toBe('multi');
  });

  it('an empty gap between two patches joins the one it was drawn from', () => {
    const patches: Patches = [R(2, 0, 2, 1), R(2, 3, 2, 4)];
    expect(resolveDraw(patches, clues, R(2, 2, 3, 2), cell(3, 2), N)).toEqual({ kind: 'place', rect: R(2, 0, 3, 2), clue: 0 });
  });

  it('does not merge with a patch it does not touch', () => {
    const patches: Patches = [R(2, 0, 2, 1), null];
    expect(resolveDraw(patches, clues, R(4, 0, 4, 1), cell(4, 0), N).kind).toBe('none');
  });
});
