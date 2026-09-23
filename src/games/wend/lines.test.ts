import { describe, expect, it } from 'vitest';
import {
  assignWords,
  beginStroke,
  cellAt,
  isBackStep,
  sameBoard,
  stepStroke,
  strokeLines,
  trackPointer,
  type Grid,
  type Line,
  type Pt,
  type Stroke,
} from './lines';

// 4x4 grid, cell = r * 4 + c:
//  0  1  2  3
//  4  5  6  7
//  8  9 10 11
// 12 13 14 15
const G: Grid = { size: 4, walls: new Array(16).fill(false) };
const W: Grid = { size: 4, walls: G.walls.map((_, i) => i === 5) };

/** Run a whole stroke: begin at cells[0], step through the rest, return the line set. */
function draw(g: Grid, lines: Line[], cells: number[]): Line[] {
  let s = beginStroke(g, lines, cells[0]);
  if (!s) return lines;
  for (const c of cells.slice(1)) s = stepStroke(g, s, c);
  return strokeLines(s);
}

const sorted = (ls: Line[]) => ls.map((l) => l.join(',')).sort();

describe('wend lines: starting a stroke', () => {
  it('starts a new line on an empty tile', () => {
    expect(draw(G, [], [0, 1, 2])).toEqual([[0, 1, 2]]);
  });

  it('does not start on a wall', () => {
    expect(beginStroke(W, [], 5)).toBeNull();
  });

  it('starting on the middle of an old line truncates it and continues from there', () => {
    const lines = [[0, 1, 2, 3]];
    const s = beginStroke(G, lines, 1)!;
    expect(s.active).toEqual([0, 1]);
    expect(s.others).toEqual([]);
    expect(draw(G, lines, [1, 5, 9])).toEqual([[0, 1, 5, 9]]);
  });

  it('starting on the last tile just extends; on the first tile keeps only that tile', () => {
    expect(draw(G, [[0, 1, 2]], [2, 3, 7])).toEqual([[0, 1, 2, 3, 7]]);
    expect(beginStroke(G, [[0, 1, 2]], 0)!.active).toEqual([0]);
    expect(draw(G, [[0, 1, 2]], [0, 4])).toEqual([[0, 4]]);
  });

  it('drops stray single-tile lines when another stroke begins', () => {
    const lines = [[15], [0, 1]];
    expect(sorted(draw(G, lines, [8, 9]))).toEqual(sorted([[0, 1], [8, 9]]));
    // ...but keeps the one being continued.
    expect(draw(G, [[15]], [15, 14])).toEqual([[15, 14]]);
  });
});

describe('wend lines: stepping', () => {
  it('rejects walls and non-adjacent cells', () => {
    const s = beginStroke(W, [], 4)!;
    expect(stepStroke(W, s, 5)).toBe(s);
    expect(stepStroke(W, s, 6)).toBe(s);
    expect(stepStroke(W, s, 9)).toBe(s);
  });

  it('retracts onto the previous tile and backtracks to earlier tiles', () => {
    let s = beginStroke(G, [], 0)!;
    for (const c of [1, 2, 6, 5]) s = stepStroke(G, s, c);
    expect(s.active).toEqual([0, 1, 2, 6, 5]);
    expect(stepStroke(G, s, 6).active).toEqual([0, 1, 2, 6]);
    // 1 is adjacent to the head (5) but earlier in the line: back to it.
    expect(stepStroke(G, s, 1).active).toEqual([0, 1]);
    // Retracting releases the tiles.
    expect(strokeLines(stepStroke(G, s, 1))).toEqual([[0, 1]]);
  });

  it('merges into the START of another line in that line’s order', () => {
    const lines = [[2, 3, 7]];
    let s = beginStroke(G, lines, 0)!;
    s = stepStroke(G, s, 1);
    s = stepStroke(G, s, 2);
    expect(s.active).toEqual([0, 1, 2, 3, 7]);
    expect(s.others).toEqual([]);
    expect(s.merge).not.toBeNull();
  });

  it('merges into the END of another line by reversing it first', () => {
    const lines = [[7, 3, 2]];
    expect(draw(G, lines, [0, 1, 2])).toEqual([[0, 1, 2, 3, 7]]);
  });

  it('merging with a single-tile line just adds it', () => {
    const s = stepStroke(G, beginStroke(G, [[0, 1], [2]], 1)!, 2);
    expect(s.active).toEqual([0, 1, 2]);
    expect(s.merge).toBeNull();
  });

  it('after a merge: riding along is a no-op, the head extends, backing out un-merges', () => {
    const lines = [[2, 3, 7]];
    let s = beginStroke(G, lines, 0)!;
    s = stepStroke(G, s, 1);
    const beforeMerge = s;
    s = stepStroke(G, s, 2);
    const merged = s;
    // Pointer rides along the merged tiles.
    expect(stepStroke(G, merged, 3)).toBe(merged);
    // A free neighbour of the head extends the merged line.
    expect(stepStroke(G, merged, 11).active).toEqual([0, 1, 2, 3, 7, 11]);
    // Reaching the head leaves merge mode, then keeps extending.
    let t = stepStroke(G, merged, 7);
    expect(t.merge).toBeNull();
    t = stepStroke(G, t, 6);
    expect(t.active).toEqual([0, 1, 2, 3, 7, 6]);
    // Backing out onto the pre-merge head restores the other line.
    const u = stepStroke(G, merged, 1);
    expect(u).toBe(beforeMerge);
    expect(sorted(strokeLines(u))).toEqual(sorted([[0, 1], [2, 3, 7]]));
    expect(isBackStep(merged, 1)).toBe(true);
    expect(isBackStep(merged, 3)).toBe(false);
  });

  it('cutting through the middle of another line deletes it', () => {
    const lines = [[1, 5, 9, 13]];
    expect(draw(G, lines, [4, 5, 6])).toEqual([[4, 5, 6]]);
  });

  it('stops at walls', () => {
    expect(draw(W, [], [4, 5, 6])).toEqual([[4]]);
    expect(draw(W, [], [4, 8, 9, 10, 6])).toEqual([[4, 8, 9, 10, 6]]);
  });

  it('never puts a cell in two lines', () => {
    const lines = [[0, 1, 2, 3], [4, 5], [8, 9, 10, 11]];
    const out = draw(G, lines, [12, 13, 9, 5, 6, 7]);
    const all = out.flat();
    expect(new Set(all).size).toBe(all.length);
  });

  it('isBackStep flags the previous tile only', () => {
    let s = beginStroke(G, [], 0)!;
    s = stepStroke(G, s, 1);
    expect(isBackStep(s, 0)).toBe(true);
    expect(isBackStep(s, 1)).toBe(false);
    expect(isBackStep(s, 2)).toBe(false);
  });
});

describe('wend lines: undo snapshots', () => {
  it('one stroke is one snapshot; sameBoard ignores single-tile selections', () => {
    const history: Line[][] = [];
    let board: Line[] = [];
    const commit = (next: Line[]) => {
      if (sameBoard(board, next)) {
        board = next;
        return;
      }
      history.push(board);
      board = next;
    };
    commit(draw(G, board, [0, 1, 2]));
    commit(draw(G, board, [2, 3, 7])); // extend
    commit(draw(G, board, [12])); // a tap: no undo step
    expect(history.length).toBe(2);
    expect(board).toEqual([[0, 1, 2, 3, 7], [12]]);
    board = history.pop()!;
    expect(board).toEqual([[0, 1, 2]]);
    board = history.pop()!;
    expect(board).toEqual([]);
  });
});

describe('wend lines: word assignment', () => {
  // Letters: row 0 = C A T S, row 1 = T A C .
  const letters = 'CATSTAC'.split('').concat(new Array(9).fill('X'));
  const words = [
    { word: 'CAT', path: [0, 1, 2] },
    { word: 'SX', path: [3, 7] },
  ];

  it('matches in the line’s own reading direction', () => {
    expect(assignWords([[0, 1, 2]], letters, words)).toEqual([0]);
    expect(assignWords([[2, 1, 0]], letters, words)).toEqual([-1]);
    expect(assignWords([[0, 1, 2, 3]], letters, words)).toEqual([-1]);
  });

  it('gives each word to one line, preferring the intended tiles', () => {
    // [6,5,4] spells CAT too.
    expect(assignWords([[6, 5, 4], [0, 1, 2]], letters, words)).toEqual([-1, 0]);
    expect(assignWords([[6, 5, 4], [3, 7]], letters, words)).toEqual([0, 1]);
  });
});

describe('wend pointer tracking', () => {
  const run = (g: Grid, pts: Pt[], lines: Line[] = []) => {
    let s: Stroke = beginStroke(g, lines, cellAt(g.size, pts[0]))!;
    let cur = s.active[s.active.length - 1];
    const entered: number[] = [];
    for (let i = 1; i < pts.length; i++) {
      cur = trackPointer(g.size, cur, pts[i - 1], pts[i], {
        canEnter: (c) => !g.walls[c],
        isBack: (c) => isBackStep(s, c),
        enter: (c) => {
          entered.push(c);
          s = stepStroke(g, s, c);
        },
      });
    }
    return { line: s.active, entered };
  };

  it('fills in every tile of a fast straight swipe', () => {
    expect(run(G, [{ x: 0.5, y: 0.5 }, { x: 3.5, y: 0.5 }]).line).toEqual([0, 1, 2, 3]);
  });

  it('registers near edges, not just centres', () => {
    // Along the top edge of row 0.
    expect(run(G, [{ x: 0.2, y: 0.08 }, { x: 3.9, y: 0.08 }]).line).toEqual([0, 1, 2, 3]);
  });

  it('resolves a diagonal corner cut through an orthogonal neighbour', () => {
    const { line } = run(G, [{ x: 0.5, y: 0.5 }, { x: 1.5, y: 1.5 }]);
    expect(line.length).toBe(3);
    expect(line[0]).toBe(0);
    expect(line[2]).toBe(5);
    expect([1, 4]).toContain(line[1]);
  });

  it('cuts a corner past a wall through the open neighbour', () => {
    // 5 is a wall: 4 -> 9 diagonally must go through 8.
    expect(run(W, [{ x: 0.5, y: 1.5 }, { x: 1.5, y: 2.5 }]).line).toEqual([4, 8, 9]);
  });

  it('follows a quick L-shaped swipe that cuts the corner', () => {
    expect(run(G, [{ x: 0.5, y: 0.5 }, { x: 2.4, y: 0.6 }, { x: 2.6, y: 3.5 }]).line).toEqual([0, 1, 2, 6, 10, 14]);
  });

  it('has hysteresis: jitter across a border does not retract', () => {
    const { line } = run(G, [
      { x: 0.5, y: 0.5 },
      { x: 1.2, y: 0.5 },
      { x: 0.9, y: 0.5 }, // 0.1 back into tile 0: not enough
      { x: 1.1, y: 0.5 },
    ]);
    expect(line).toEqual([0, 1]);
  });

  it('retracts once the pointer is clearly back in the previous tile', () => {
    const { line } = run(G, [
      { x: 0.5, y: 0.5 },
      { x: 2.5, y: 0.5 },
      { x: 1.6, y: 0.5 },
    ]);
    expect(line).toEqual([0, 1]);
  });

  it('does not pass through walls', () => {
    expect(run(W, [{ x: 0.5, y: 1.5 }, { x: 2.5, y: 1.5 }]).line).toEqual([4]);
  });

  it('keeps extending after riding along a merged line to its far end', () => {
    // Existing line 1 -> 2 -> 3; draw 0 -> 1 (merge), ride to 3, continue down to 7.
    const { line } = run(G, [{ x: 0.5, y: 0.5 }, { x: 3.5, y: 0.5 }, { x: 3.5, y: 1.5 }], [[1, 2, 3]]);
    expect(line).toEqual([0, 1, 2, 3, 7]);
  });

  it('clamps to the board when the pointer leaves it', () => {
    expect(run(G, [{ x: 0.5, y: 0.5 }, { x: 5, y: -1 }]).line).toEqual([0, 1, 2, 3]);
  });
});

describe('found words are locked', () => {
  const G5: Grid = { size: 4, walls: new Array(16).fill(false) };
  const found: Line = [0, 1, 2];
  const locked = new Set(found);

  it('cannot start a stroke on a found word', () => {
    expect(beginStroke(G5, [found], 1, locked)).toBeNull();
    expect(beginStroke(G5, [found], 0, locked)).toBeNull();
  });

  it('cannot enter, merge with, or cut through a found word', () => {
    // From 4 (below 0): stepping onto 0 would normally merge with the found line.
    let s = beginStroke(G5, [found], 4, locked)!;
    expect(stepStroke(G5, s, 0)).toBe(s);
    // From 5 (below 1): stepping onto 1 would normally cut the found line.
    s = beginStroke(G5, [found], 5, locked)!;
    expect(stepStroke(G5, s, 1)).toBe(s);
    // The found word stays intact while the stroke goes around it.
    s = stepStroke(G5, s, 6);
    s = stepStroke(G5, s, 7);
    s = stepStroke(G5, s, 3);
    expect(strokeLines(s)).toEqual([found, [5, 6, 7, 3]]);
  });

  it('unlocked lines still merge and cut as before', () => {
    const s = stepStroke(G5, beginStroke(G5, [found], 4)!, 0);
    expect(s.active).toEqual([4, 0, 1, 2]);
  });
});
