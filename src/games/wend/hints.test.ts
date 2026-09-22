import { describe, expect, it } from 'vitest';
import type { WendPuzzle } from './generator';
import { planHint, prefixMatch } from './hints';
import { assignWords, sameBoard, type Line } from './lines';

// 4x4 board, cell = r * 4 + c:
//  C A T S      0  1  2  3
//  D O G H      4  5  6  7
//  E S R O      8  9 10 11
//  F I S H     12 13 14 15
const P: WendPuzzle = {
  size: 4,
  walls: new Array(16).fill(false),
  letters: 'CATSDOGHESROFISH'.split(''),
  words: [
    { word: 'DOG', path: [4, 5, 6] },
    { word: 'CATS', path: [0, 1, 2, 3] },
    { word: 'FISH', path: [12, 13, 14, 15] },
    { word: 'HORSE', path: [7, 11, 10, 9, 8] },
  ],
};
const none = () => P.words.map(() => 0);
const sorted = (ls: Line[]) => ls.map((l) => l.join(',')).sort();

function reveal(lines: Line[], revealed = none()) {
  const r = planHint(P, lines, revealed);
  if (r.kind !== 'reveal') throw new Error(`expected a reveal, got ${r.kind}`);
  return r;
}

describe('wend hints: prefixMatch', () => {
  it('reads the line either way round, from the word’s first tile', () => {
    expect(prefixMatch([0, 1, 5], [0, 1, 2, 3])).toMatchObject({ m: 2, reversed: false, lead: [] });
    expect(prefixMatch([2, 1, 0], [0, 1, 2, 3])).toMatchObject({ m: 3, reversed: true });
    expect(prefixMatch([8, 4, 5], [4, 5, 6])).toMatchObject({ m: 2, reversed: false, lead: [8] });
    expect(prefixMatch([5, 4, 8, 12], [4, 5, 6])).toMatchObject({ m: 2, reversed: true, lead: [8, 12] });
    expect(prefixMatch([1, 2], [0, 1, 2, 3])).toMatchObject({ m: 0 });
    expect(prefixMatch([4], [4, 5, 6])).toMatchObject({ m: 1, reversed: false });
  });
});

describe('wend hints: planHint', () => {
  it('with no line on the word, reveals the first tile as a 1-tile line', () => {
    const r = reveal([]);
    expect(r.w).toBe(0);
    expect(r.step).toBe(0);
    expect(r.lines).toEqual([[4]]);
    expect(r.revealed).toEqual([1, 0, 0, 0]);
    expect(r.cleared).toBe(false);
  });

  it('next hint extends the revealed start into a line', () => {
    const r = reveal([[4]], [1, 0, 0, 0]);
    expect(r.step).toBe(1);
    expect(r.lines).toEqual([[4, 5]]);
    expect(r.revealed).toEqual([2, 0, 0, 0]);
  });

  it('lays down tiles revealed earlier even when the line was erased', () => {
    const r = reveal([], [2, 0, 0, 0]);
    expect(r.lines).toEqual([[4, 5, 6]]);
    expect(assignWords(r.lines, P.letters, P.words)).toEqual([0]);
  });

  it('prefers the word a line has correctly started, and extends that line', () => {
    // DOG is shorter, but the player has C-A of CATS.
    const r = reveal([[0, 1]]);
    expect(r.w).toBe(1);
    expect(r.step).toBe(2);
    expect(r.lines).toEqual([[0, 1, 2]]);
    expect(r.revealed).toEqual([0, 3, 0, 0]);
    expect(r.flipped).toBe(false);
  });

  it('flips a line traced backwards and extends it', () => {
    const r = reveal([[1, 0]]);
    expect(r.w).toBe(1);
    expect(r.lines).toEqual([[0, 1, 2]]);
    expect(r.flipped).toBe(true);
  });

  it('corrects a started line that went the wrong way after the right start', () => {
    const r = reveal([[0, 1, 5, 9]]);
    expect(r.w).toBe(1);
    expect(r.lines).toEqual([[0, 1, 2]]);
    expect(r.cleared).toBe(true);
  });

  it('a hint that completes the word leaves it found', () => {
    const r = reveal([[2, 1, 0]]);
    expect(r.lines).toEqual([[0, 1, 2, 3]]);
    expect(r.revealed[1]).toBe(4);
    expect(assignWords(r.lines, P.letters, P.words)).toEqual([1]);
  });

  it('removes a conflicting line that cuts through the word’s tiles', () => {
    // 0-4-8 passes through D (tile 4) in its middle.
    const r = reveal([[0, 4, 8]]);
    expect(r.w).toBe(0);
    expect(r.lines).toEqual([[4]]);
    expect(r.cleared).toBe(true);
  });

  it('trims a conflicting line, keeping leftover pieces of 2+ tiles', () => {
    const r = reveal([[1, 5, 9, 13]], [2, 0, 0, 0]);
    expect(sorted(r.lines)).toEqual(sorted([[9, 13], [4, 5, 6]]));
    expect(r.cleared).toBe(true);
  });

  it('never touches found words, and drops stray selections', () => {
    const r = reveal([[4, 5, 6], [15]]);
    expect(r.w).toBe(1);
    expect(r.lines).toEqual([[4, 5, 6], [0]]);
  });

  it('keeps the tiles a started line had before the word’s first tile', () => {
    // F-E-D-C-A ends with C-A: CATS continues from there, F-E-D stays a line.
    const r = reveal([[12, 8, 4, 0, 1]]);
    expect(r.w).toBe(1);
    expect(sorted(r.lines)).toEqual(sorted([[12, 8, 4], [0, 1, 2]]));
  });

  it('exactly one line equals the revealed prefix, and no tile is in two lines', () => {
    const r = reveal([[13, 9, 5, 4, 0], [1, 2, 6, 7]], [0, 0, 0, 0]);
    const prefix = P.words[r.w].path.slice(0, r.step + 1).join(',');
    expect(r.lines.filter((l) => l.join(',') === prefix).length).toBe(1);
    const all = r.lines.flat();
    expect(new Set(all).size).toBe(all.length);
  });

  it('still points out a misplaced found word instead of revealing', () => {
    // Bottom row reads G O D H, so D-O-G can be spelled off DOG's tiles.
    const Q: WendPuzzle = { ...P, letters: 'CATSDOGHESROGODH'.split('') };
    const r = planHint(Q, [[14, 13, 12]], none());
    expect(r.kind).toBe('blocking');
  });

  it('is one undo step: the snapshot before the hint restores the board', () => {
    const history: Line[][] = [];
    let board: Line[] = [[1, 0], [8, 9]];
    const commit = (next: Line[]) => {
      if (!sameBoard(board, next)) history.push(board);
      board = next;
    };
    const before = board;
    commit(reveal(board).lines);
    expect(board).toEqual([[8, 9], [0, 1, 2]]);
    expect(history.length).toBe(1);
    board = history.pop()!;
    expect(board).toBe(before);
  });
});
