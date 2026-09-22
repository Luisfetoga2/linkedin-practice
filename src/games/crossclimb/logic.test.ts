import { describe, expect, it } from 'vitest';
import { generateLadder, isLadder } from './generator';
import { computePhase, forwardOrder, hintRow, letterHint, MIDS, nextRowWithEmpty, orderHint } from './logic';

const lad = generateLadder(4242, 4);
const { words } = lad;
const empty = () => words.map(() => ['', '', '', '']);
const fill = (ent: string[][], w: number, s: string) => {
  ent[w] = s.split('');
  return ent;
};
const wrongWord = (w: string) => (w[0] === 'Z' ? 'Q' : 'Z') + w.slice(1);
const solvedOrder = [1, 2, 3, 4, 5];

describe('computePhase', () => {
  it('stays in clues until every middle row is filled correctly', () => {
    const ent = empty();
    expect(computePhase(words, ent, lad.order)).toBe('clues');
    MIDS.slice(0, 4).forEach((w) => fill(ent, w, words[w]));
    expect(computePhase(words, ent, lad.order)).toBe('clues');
    fill(ent, 5, wrongWord(words[5]));
    expect(computePhase(words, ent, lad.order)).toBe('clues');
    fill(ent, 5, words[5]);
    expect(computePhase(words, ent, lad.order)).toBe('order');
  });

  it('does not judge the order before the words are all correct', () => {
    const ent = empty();
    MIDS.slice(0, 4).forEach((w) => fill(ent, w, words[w]));
    expect(computePhase(words, ent, solvedOrder)).toBe('clues');
  });

  it('skips ordering when the rows are already a valid ladder, and finishes on both ends', () => {
    const ent = empty();
    MIDS.forEach((w) => fill(ent, w, words[w]));
    expect(computePhase(words, ent, solvedOrder)).toBe('final');
    expect(computePhase(words, ent, [...solvedOrder].reverse())).toBe('final');
    fill(ent, 0, words[0]);
    fill(ent, 6, wrongWord(words[6]));
    expect(computePhase(words, ent, solvedOrder)).toBe('final');
    fill(ent, 6, words[6]);
    expect(computePhase(words, ent, solvedOrder)).toBe('done');
  });
});

describe('letterHint', () => {
  const word = words[1];
  const none = [false, false, false, false];

  it('reveals the first unrevealed box on an empty or partial row', () => {
    expect(letterHint(word, ['', '', '', ''], none)).toEqual({ kind: 'reveal', col: 0 });
    // A typed letter that is not revealed yet still gets revealed (no judgement of typed letters).
    expect(letterHint(word, [word[0], '', '', ''], none)).toEqual({ kind: 'reveal', col: 0 });
    expect(letterHint(word, [word[0], '', '', ''], [true, false, false, false])).toEqual({ kind: 'reveal', col: 1 });
    expect(letterHint(word, ['Z', 'Z', '', 'Z'], [false, false, false, false])).toEqual({ kind: 'reveal', col: 0 });
  });

  it('only says the whole word is wrong when the row is full and incorrect', () => {
    expect(letterHint(word, wrongWord(word).split(''), none)).toEqual({ kind: 'wrong' });
    expect(letterHint(word, wrongWord(word).split(''), [false, true, true, true])).toEqual({ kind: 'wrong' });
  });

  it('does nothing on a correct row', () => {
    expect(letterHint(word, word.split(''), none)).toBeNull();
  });
});

describe('hintRow', () => {
  it('uses the selected row unless it is already correct', () => {
    const ent = empty();
    fill(ent, lad.order[0], words[lad.order[0]]);
    expect(hintRow(lad.order[1], lad.order, words, ent)).toBe(lad.order[1]);
    expect(hintRow(lad.order[0], lad.order, words, ent)).toBe(lad.order[1]);
    // Filled-but-wrong rows are not "correct", so they stay the target.
    fill(ent, lad.order[2], wrongWord(words[lad.order[2]]));
    expect(hintRow(lad.order[2], lad.order, words, ent)).toBe(lad.order[2]);
  });

  it('returns null when every row in the sequence is correct', () => {
    const ent = empty();
    MIDS.forEach((w) => fill(ent, w, words[w]));
    expect(hintRow(1, lad.order, words, ent)).toBeNull();
  });
});

describe('nextRowWithEmpty', () => {
  it('walks the display order, wrapping, skipping full rows regardless of correctness', () => {
    const seq = [3, 1, 5, 2, 4];
    const ent = empty();
    fill(ent, 3, words[3]);
    fill(ent, 1, wrongWord(words[1]));
    expect(nextRowWithEmpty(seq, 3, ent)).toBe(5);
    fill(ent, 5, 'ABCD');
    fill(ent, 2, words[2]);
    fill(ent, 4, words[4]);
    expect(nextRowWithEmpty(seq, 4, ent)).toBeNull();
    ent[1][2] = '';
    expect(nextRowWithEmpty(seq, 4, ent)).toBe(1);
  });
});

describe('orderHint', () => {
  it('flags a misplaced row and nothing once solved', () => {
    const pick = orderHint(lad.order, words);
    expect(pick).not.toBeNull();
    expect(MIDS).toContain(pick);
    expect(orderHint(solvedOrder, words)).toBeNull();
    expect(orderHint([...solvedOrder].reverse(), words)).toBeNull();
    expect(isLadder(solvedOrder.map((i) => words[i]))).toBe(true);
  });
});

describe('forwardOrder', () => {
  it('keeps a forward ladder and flips a reversed one so the end pair reads top-to-bottom', () => {
    expect(forwardOrder(solvedOrder)).toEqual(solvedOrder);
    expect(forwardOrder([5, 4, 3, 2, 1])).toEqual(solvedOrder);
    const input = [5, 4, 3, 2, 1];
    forwardOrder(input);
    expect(input).toEqual([5, 4, 3, 2, 1]);
  });
});
