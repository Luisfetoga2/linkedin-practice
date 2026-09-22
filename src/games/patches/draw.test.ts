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

  it('merges an empty box that overlaps a patch', () => {
    const patches: Patches = [R(2, 0, 2, 1), null];
    // Box from the patch's right cell down two rows: covering rectangle is rows 2-4, cols 0-1.
    expect(resolveDraw(patches, clues, R(2, 1, 4, 1), cell(4, 1), N)).toEqual({ kind: 'place', rect: R(2, 0, 4, 1), clue: 0 });
    // Box from above that reaches into the patch.
    expect(resolveDraw(patches, clues, R(1, 0, 2, 1), cell(1, 0), N)).toEqual({ kind: 'place', rect: R(1, 0, 2, 1), clue: 0 });
  });

  it('does not merge a box that only touches a patch', () => {
    const patches: Patches = [R(2, 0, 2, 1), null];
    expect(resolveDraw(patches, clues, R(1, 0, 1, 1), cell(1, 0), N).kind).toBe('none');
    expect(resolveDraw(patches, clues, R(3, 0, 4, 1), cell(3, 0), N).kind).toBe('none');
  });

  it('lets you redraw a smaller patch from inside an oversized one', () => {
    // The screenshot case: an oversized patch around the clue; drawing a new box that holds
    // the clue replaces it instead of extending it.
    const patches: Patches = [R(0, 0, 3, 3), null];
    expect(resolveDraw(patches, clues, R(2, 0, 3, 2), cell(2, 2), N)).toEqual({ kind: 'place', rect: R(2, 0, 3, 2), clue: 0 });
  });

  it('never merges into a result holding two clues', () => {
    // Growing the patch to cover this box would also swallow clue 1 at (2,4).
    expect(resolveDraw([R(2, 0, 3, 1), null], clues, R(3, 1, 3, 4), cell(3, 4), N).kind).toBe('none');
    // A box covering both clues is refused.
    expect(resolveDraw([R(2, 0, 2, 1), null], clues, R(2, 0, 2, 4), cell(2, 1), N).kind).toBe('multi');
  });

  it('a box starting on a patch and reaching another clue becomes that clue’s patch', () => {
    expect(resolveDraw([R(2, 0, 2, 1), null], clues, R(2, 1, 2, 4), cell(2, 1), N)).toEqual({ kind: 'place', rect: R(2, 1, 2, 4), clue: 1 });
  });

  it('prefers the patch the drag started on when an empty box overlaps two', () => {
    const patches: Patches = [R(2, 0, 3, 1), R(2, 3, 3, 4)];
    // Row-3 box spanning both patches: either merge is legal, the start cell decides.
    expect(resolveDraw(patches, clues, R(3, 1, 3, 3), cell(3, 1), N)).toEqual({ kind: 'place', rect: R(2, 0, 3, 3), clue: 0 });
    expect(resolveDraw(patches, clues, R(3, 1, 3, 3), cell(3, 3), N)).toEqual({ kind: 'place', rect: R(2, 1, 3, 4), clue: 1 });
  });
});
