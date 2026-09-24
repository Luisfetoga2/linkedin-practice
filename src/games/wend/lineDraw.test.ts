import { describe, expect, it } from 'vitest';
import { lineFor } from '../zip/lineAnim';
import { beginStroke, stepStroke, type Grid, type Stroke } from './lines';
import { canTip, chevronsD, lineChevronsD, linePathD, nearHead, shouldSnap, staticChevronsD, staticPathD, strokeTarget } from './lineDraw';

// 4x4 grid, cell = r * 4 + c:
//  0  1  2  3
//  4  5  6  7
//  8  9 10 11
// 12 13 14 15
const G: Grid = { size: 4, walls: new Array(16).fill(false).map((_, i) => i === 6) };
const stroke = (active: number[], locked: number[] = []): Stroke => ({ others: [], active, merge: null, locked: new Set(locked) });

describe('wend line drawing', () => {
  it('draws the live tip toward open neighbours only, clamped at the tile edge', () => {
    const s = stroke([0, 1]);
    // Pointer 0.3 right of tile 1's centre: partial segment toward tile 2.
    const t = strokeTarget(G, s, { x: 1.8, y: 0.5 });
    expect(t.cells).toEqual([0, 1, 2]);
    expect(t.pos).toBeCloseTo(1.3);
    // Clamped to the shared edge.
    expect(strokeTarget(G, s, { x: 3.4, y: 0.6 }).pos).toBeCloseTo(1.5);
    // Down from tile 1 is tile 5 (open); from tile 2 down is the wall (6): no tip.
    expect(strokeTarget(G, s, { x: 1.5, y: 0.9 }).cells).toEqual([0, 1, 5]);
    expect(strokeTarget(G, stroke([1, 2]), { x: 2.5, y: 0.9 })).toEqual(lineFor([1, 2]));
    // Locked (found-word) tiles and the stroke's own tiles are off limits too.
    expect(strokeTarget(G, stroke([0, 1], [2]), { x: 1.8, y: 0.5 })).toEqual(lineFor([0, 1]));
    expect(strokeTarget(G, stroke([4, 0, 1, 5]), { x: 1.2, y: 1.5 })).toEqual(lineFor([4, 0, 1, 5]));
    // Off the board: nothing.
    expect(strokeTarget(G, stroke([0]), { x: 0.5, y: 0.1 })).toEqual(lineFor([0]));
    // No pointer: the committed cells.
    expect(strokeTarget(G, s, null)).toEqual(lineFor([0, 1]));
  });

  it('shrinks the last segment when heading back to the previous tile', () => {
    const t = strokeTarget(G, stroke([0, 1]), { x: 1.2, y: 0.5 });
    expect(t.cells).toEqual([0, 1]);
    expect(t.pos).toBeCloseTo(0.7);
  });

  it('never tips diagonally: the dominant axis wins', () => {
    const t = strokeTarget(G, stroke([9]), { x: 1.85, y: 2.75 });
    expect(t.cells).toEqual([9, 10]);
    expect(t.pos).toBeCloseTo(0.35);
    // Mostly toward the wall at 6 (from 5): no tip rather than a sideways one.
    expect(strokeTarget(G, stroke([5]), { x: 1.85, y: 1.75 })).toEqual(lineFor([5]));
  });

  it('knows which tiles the tip may reach and when it re-arms', () => {
    const s = stroke([0, 1], [8]);
    expect(canTip(G, s, 2)).toBe(true);
    expect(canTip(G, s, 6)).toBe(false); // wall
    expect(canTip(G, s, 8)).toBe(false); // found word
    expect(canTip(G, s, 0)).toBe(false); // own line
    expect(canTip(G, s, -1)).toBe(false);
    expect(nearHead(4, 5, { x: 1.7, y: 1.4 })).toBe(true);
    expect(nearHead(4, 5, { x: 1.9, y: 1.5 })).toBe(false);
  });

  it('snaps across merges and un-merges but animates ordinary steps', () => {
    const lines = [[3, 7]];
    const s = beginStroke(G, lines, 0)!;
    const s1 = stepStroke(G, s, 1);
    expect(shouldSnap(s, s1)).toBe(false);
    const s2 = stepStroke(G, s1, 2);
    const merged = stepStroke(G, s2, 3); // onto the endpoint of [3, 7]
    expect(merged.merge).not.toBeNull();
    expect(shouldSnap(s2, merged)).toBe(true);
    const back = stepStroke(G, merged, 2);
    expect(shouldSnap(merged, back)).toBe(true);
    expect(shouldSnap(null, s)).toBe(false);
  });

  it('builds partial path data and only shows chevrons past a segment midpoint', () => {
    expect(linePathD({ cells: [0], pos: 0 }, 4)).toBe('M 0.5 0.5 l 0 0');
    expect(linePathD({ cells: [0, 1, 2], pos: 1.25 }, 4)).toBe('M 0.5 0.5 L 1.5 0.5 L 1.75 0.5');
    expect(linePathD({ cells: [], pos: 0 }, 4)).toBe('');
    // One chevron for the full segment; the quarter-drawn one has none yet.
    expect(lineChevronsD({ cells: [0, 1, 2], pos: 1.25 }, 4).match(/M/g)).toHaveLength(1);
    expect(lineChevronsD({ cells: [0, 1, 2], pos: 1.5 }, 4).match(/M/g)).toHaveLength(1);
    expect(lineChevronsD({ cells: [0, 1, 2], pos: 1.6 }, 4).match(/M/g)).toHaveLength(2);
    expect(lineChevronsD({ cells: [0], pos: 0 }, 4)).toBe('');
    expect(chevronsD([])).toBe('');
  });

  it('keeps the static drawing identical to the fully drawn animated one', () => {
    expect(staticPathD([0, 1, 5], 4)).toBe('M 0.5 0.5 L 1.5 0.5 L 1.5 1.5');
    expect(staticChevronsD([0, 1, 5], 4)).toBe(
      'M 0.94 0.62 L 1.06 0.5 L 0.94 0.38 M 1.38 0.94 L 1.5 1.06 L 1.62 0.94',
    );
  });
});
