import { describe, expect, it } from 'vitest';
import { STR } from './i18n';
import { parseEntries, clueLeaksAnswer, foldAccents } from './data/parse';
import type { MiniClue, MiniPuzzle } from './generator';
import { slotsOf } from './generator';
import { afterType, arrow, backspace, clueAt, isFull, isSolved, keyToLetter, revealTarget, stepClue } from './logic';

/** Hand-built 4×4 puzzle with black squares at 0 and 15:
 *   # C A T
 *   A R E A
 *   P E A R
 *   E W E #
 */
function puzzle(): MiniPuzzle {
  const rows = ['#CAT', 'AREA', 'PEAR', 'EWE#'];
  const size = 4;
  const solution = rows.join('').split('').map((c) => (c === '#' ? '' : c));
  const blocks = solution.map((c) => !c);
  const slots = slotsOf(size, blocks);
  const numbers = Array<number>(16).fill(0);
  let n = 1;
  const starts = new Set(slots.map((s) => s.cells[0]));
  for (let i = 0; i < 16; i++) if (starts.has(i)) numbers[i] = n++;
  const mk = (s: (typeof slots)[number]): MiniClue => ({
    num: numbers[s.cells[0]],
    dir: s.dir,
    row: s.row,
    col: s.col,
    len: s.cells.length,
    cells: s.cells,
    answer: s.cells.map((i) => solution[i]).join(''),
    clue: 'x',
  });
  return {
    size,
    blocks,
    solution,
    numbers,
    across: slots.filter((s) => s.dir === 'across').map(mk),
    down: slots.filter((s) => s.dir === 'down').map(mk).sort((a, b) => a.num - b.num),
    template: 'test',
  };
}

const empty = () => Array<string>(16).fill('');
const none = () => Array<boolean>(16).fill(false);

describe('mini cursor logic', () => {
  const p = puzzle();

  it('numbers entries like a crossword', () => {
    expect(p.across.map((c) => `${c.num}:${c.answer}`)).toEqual(['1:CAT', '4:AREA', '5:PEAR', '6:EWE']);
    expect(p.down.map((c) => `${c.num}:${c.answer}`)).toEqual(['1:CREW', '2:AEAE', '3:TAR', '4:APE']);
  });

  it('advances through the word, then to the next clue with gaps', () => {
    const e = empty();
    e[1] = 'C';
    expect(afterType(p, { cell: 1, dir: 'across' }, e, none(), true)).toEqual({ cell: 2, dir: 'across' });
    e[2] = 'A';
    e[3] = 'T';
    // Word full → next across clue (4A), first empty square.
    expect(afterType(p, { cell: 3, dir: 'across' }, e, none(), true)).toEqual({ cell: 4, dir: 'across' });
  });

  it('skips filled squares only when asked', () => {
    const e = empty();
    e[4] = 'A';
    e[5] = 'R';
    e[6] = 'E';
    // Typed at 4 with 5 and 6 already filled: skip to 7.
    expect(afterType(p, { cell: 4, dir: 'across' }, e, none(), true)).toEqual({ cell: 7, dir: 'across' });
    expect(afterType(p, { cell: 4, dir: 'across' }, e, none(), false)).toEqual({ cell: 5, dir: 'across' });
  });

  it('never stops on locked squares', () => {
    const e = empty();
    e[4] = 'A';
    const locked = none();
    locked[5] = true;
    e[5] = 'R';
    expect(afterType(p, { cell: 4, dir: 'across' }, e, locked, false)).toEqual({ cell: 6, dir: 'across' });
  });

  it('backspace clears, then walks back (into the previous clue)', () => {
    const e = empty();
    e[5] = 'R';
    expect(backspace(p, { cell: 5, dir: 'across' }, e, none())).toEqual({ cursor: { cell: 5, dir: 'across' }, clear: 5 });
    e[4] = 'A';
    expect(backspace(p, { cell: 6, dir: 'across' }, e, none())).toEqual({ cursor: { cell: 5, dir: 'across' }, clear: 5 });
    // At the start of 4A with an empty square: back into 1A's last square.
    const e2 = empty();
    e2[3] = 'T';
    expect(backspace(p, { cell: 4, dir: 'across' }, e2, none())).toEqual({ cursor: { cell: 3, dir: 'across' }, clear: 3 });
    const locked = none();
    locked[5] = true;
    expect(backspace(p, { cell: 6, dir: 'across' }, e, locked).clear).toBe(-1);
  });

  it('steps clues in order and wraps', () => {
    const e = empty();
    const last = p.down[p.down.length - 1];
    expect(stepClue(p, last, 1, e, false)).toEqual({ cell: p.across[0].cells[0], dir: 'across' });
    expect(stepClue(p, p.across[0], -1, e, false)).toEqual({ cell: last.cells[0], dir: 'down' });
    // Skip full clues.
    const full = empty();
    for (const i of p.across[1].cells) full[i] = 'X';
    expect(stepClue(p, p.across[0], 1, full, true).cell).toBe(p.across[2].cells[0]);
  });

  it('arrows turn first, then move and skip black squares', () => {
    expect(arrow(p, { cell: 1, dir: 'across' }, 'ArrowDown')).toEqual({ cell: 1, dir: 'down' });
    expect(arrow(p, { cell: 1, dir: 'down' }, 'ArrowDown')).toEqual({ cell: 5, dir: 'down' });
    expect(arrow(p, { cell: 1, dir: 'across' }, 'ArrowLeft')).toEqual({ cell: 1, dir: 'across' });
    expect(arrow(p, { cell: 14, dir: 'across' }, 'ArrowRight')).toEqual({ cell: 14, dir: 'across' });
  });

  it('finds clues through a cell', () => {
    expect(clueAt(p, 6, 'across').answer).toBe('AREA');
    expect(clueAt(p, 6, 'down').answer).toBe('AEAE');
  });

  it('detects solved and full grids', () => {
    expect(isSolved(p, p.solution)).toBe(true);
    const wrong = p.solution.slice();
    wrong[5] = 'Z';
    expect(isSolved(p, wrong)).toBe(false);
    expect(isFull(p, wrong)).toBe(true);
    expect(isFull(p, empty())).toBe(false);
  });

  it('reveals the selected square, else the next wrong one', () => {
    const e = empty();
    expect(revealTarget(p, { cell: 5, dir: 'across' }, e)).toBe(5);
    e[5] = 'R';
    expect(revealTarget(p, { cell: 5, dir: 'across' }, e)).toBe(4);
    expect(revealTarget(p, { cell: 5, dir: 'across' }, p.solution)).toBe(-1);
  });

  it('maps physical keys to letters', () => {
    expect(keyToLetter('a', 'en')).toBe('A');
    expect(keyToLetter('é', 'es')).toBe('E');
    expect(keyToLetter('ñ', 'es')).toBe('Ñ');
    expect(keyToLetter('ñ', 'en')).toBe('N');
    expect(keyToLetter('Enter', 'en')).toBeNull();
    expect(keyToLetter('1', 'en')).toBeNull();
  });
});

describe('mini data parsing', () => {
  it('parses lines, folds accents, keeps Ñ, drops leaking clues', () => {
    const list = parseEntries(['\n# comment\nCAFÉ|Bebida caliente|Café con leche\nniño|Chico\nAB|Too short\nOCEANS|Too long\nTREE|Oak or elm|Street tree\n']);
    expect(list).toEqual([
      { word: 'CAFE', clues: ['Bebida caliente'] },
      { word: 'NIÑO', clues: ['Chico'] },
      { word: 'TREE', clues: ['Oak or elm'] },
    ]);
    expect(foldAccents('pingüino')).toBe('PINGUINO');
    expect(clueLeaksAnswer('ARM', 'An army')).toBe(true);
  });
});

describe('mini strings', () => {
  it('Spanish has every English key', () => {
    expect(Object.keys(STR.es).sort()).toEqual(Object.keys(STR.en).sort());
    expect(STR.es.share(5)).toContain('5×5');
  });
});
