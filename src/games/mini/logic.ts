import type { Dir, MiniClue, MiniPuzzle } from './generator';

/**
 * Pure cursor / typing rules for the Mini Crossword (NYT-Mini behavior). The grid state is a
 * row-major `entries` array ('' = empty); `locked` cells (revealed or checked correct) can't be
 * changed and are skipped when typing.
 */

export interface Cursor {
  cell: number;
  dir: Dir;
}

export function allClues(p: MiniPuzzle): MiniClue[] {
  return [...p.across, ...p.down];
}

/** The entry through `cell` in direction `dir` (every white cell has both). */
export function clueAt(p: MiniPuzzle, cell: number, dir: Dir): MiniClue {
  const list = dir === 'across' ? p.across : p.down;
  return list.find((c) => c.cells.includes(cell)) ?? allClues(p).find((c) => c.cells.includes(cell))!;
}

export function isOpen(entries: readonly string[], locked: readonly boolean[], cell: number): boolean {
  return !entries[cell] && !locked[cell];
}

const firstEmpty = (c: MiniClue, entries: readonly string[]): number => c.cells.find((i) => !entries[i]) ?? -1;

/** Where the cursor lands when jumping to a clue: its first empty cell, else its first cell. */
export function landOn(c: MiniClue, entries: readonly string[]): Cursor {
  const e = firstEmpty(c, entries);
  return { cell: e >= 0 ? e : c.cells[0], dir: c.dir };
}

/**
 * Next (delta = 1) or previous clue in reading order (across 1..n, then down 1..n, wrapping).
 * With `skipFull`, clues that are already completely filled are passed over (unless all are).
 */
export function stepClue(p: MiniPuzzle, from: MiniClue, delta: 1 | -1, entries: readonly string[], skipFull: boolean): Cursor {
  const list = allClues(p);
  const at = list.findIndex((c) => c.dir === from.dir && c.num === from.num);
  for (let k = 1; k <= list.length; k++) {
    const c = list[(at + delta * k + list.length * k) % list.length];
    if (!skipFull || firstEmpty(c, entries) >= 0) return landOn(c, entries);
  }
  const c = list[(at + delta + list.length) % list.length];
  return landOn(c, entries);
}

/**
 * Cursor after a letter was typed at `cursor.cell`: the next cell of the word (the next empty
 * one when `skipFilled`, wrapping to earlier gaps), or — once the word is done — the next clue
 * that still has an empty cell.
 */
export function afterType(p: MiniPuzzle, cursor: Cursor, entries: readonly string[], locked: readonly boolean[], skipFilled: boolean): Cursor {
  const clue = clueAt(p, cursor.cell, cursor.dir);
  const cells = clue.cells;
  const at = cells.indexOf(cursor.cell);
  if (skipFilled) {
    for (let k = at + 1; k < cells.length; k++) if (isOpen(entries, locked, cells[k])) return { cell: cells[k], dir: cursor.dir };
    for (let k = 0; k < at; k++) if (isOpen(entries, locked, cells[k])) return { cell: cells[k], dir: cursor.dir };
  } else {
    for (let k = at + 1; k < cells.length; k++) if (!locked[cells[k]]) return { cell: cells[k], dir: cursor.dir };
    if (cells.some((i) => !entries[i])) {
      const gap = cells.find((i) => !entries[i])!;
      return { cell: gap, dir: cursor.dir };
    }
  }
  if (entries.every((ch, i) => ch || p.blocks[i])) return cursor;
  return stepClue(p, clue, 1, entries, true);
}

export interface BackspaceResult {
  cursor: Cursor;
  /** Cell to clear, or -1. */
  clear: number;
}

/**
 * Backspace: clear the current cell if it holds an editable letter; otherwise step back through
 * the word (then into the previous clue's last cell) and clear that one.
 */
export function backspace(p: MiniPuzzle, cursor: Cursor, entries: readonly string[], locked: readonly boolean[]): BackspaceResult {
  if (entries[cursor.cell] && !locked[cursor.cell]) return { cursor, clear: cursor.cell };
  const clue = clueAt(p, cursor.cell, cursor.dir);
  const at = clue.cells.indexOf(cursor.cell);
  let target: Cursor;
  if (at > 0) target = { cell: clue.cells[at - 1], dir: cursor.dir };
  else {
    const list = allClues(p);
    const i = list.findIndex((c) => c.dir === clue.dir && c.num === clue.num);
    const prev = list[(i - 1 + list.length) % list.length];
    target = { cell: prev.cells[prev.cells.length - 1], dir: prev.dir };
  }
  return { cursor: target, clear: entries[target.cell] && !locked[target.cell] ? target.cell : -1 };
}

/** Arrow keys: an arrow across the current direction first turns the cursor, then moves. */
export function arrow(p: MiniPuzzle, cursor: Cursor, key: 'ArrowLeft' | 'ArrowRight' | 'ArrowUp' | 'ArrowDown'): Cursor {
  const dir: Dir = key === 'ArrowLeft' || key === 'ArrowRight' ? 'across' : 'down';
  if (dir !== cursor.dir) return { cell: cursor.cell, dir };
  const N = p.size;
  const dr = key === 'ArrowUp' ? -1 : key === 'ArrowDown' ? 1 : 0;
  const dc = key === 'ArrowLeft' ? -1 : key === 'ArrowRight' ? 1 : 0;
  let r = Math.floor(cursor.cell / N);
  let c = cursor.cell % N;
  for (;;) {
    r += dr;
    c += dc;
    if (r < 0 || c < 0 || r >= N || c >= N) return cursor;
    const i = r * N + c;
    if (!p.blocks[i]) return { cell: i, dir };
  }
}

export function isSolved(p: MiniPuzzle, entries: readonly string[]): boolean {
  return p.solution.every((ch, i) => ch === (entries[i] ?? ''));
}

export function isFull(p: MiniPuzzle, entries: readonly string[]): boolean {
  return p.blocks.every((b, i) => b || !!entries[i]);
}

/**
 * Cell a "Reveal square" hint fills: the selected cell unless it's already right, then the first
 * wrong/empty cell of the current word, then of the whole grid. -1 when everything is correct.
 */
export function revealTarget(p: MiniPuzzle, cursor: Cursor, entries: readonly string[]): number {
  const wrong = (i: number) => !p.blocks[i] && entries[i] !== p.solution[i];
  if (wrong(cursor.cell)) return cursor.cell;
  const inWord = clueAt(p, cursor.cell, cursor.dir).cells.find(wrong);
  if (inWord !== undefined) return inWord;
  return p.solution.findIndex((_, i) => wrong(i));
}

/**
 * Map a physical key to a grid letter: accented letters type their base letter; Ñ is only a
 * letter with Spanish words (otherwise it types N).
 */
export function keyToLetter(key: string, wordLang: 'en' | 'es'): string | null {
  if (key.length !== 1) return null;
  const up = key.toUpperCase();
  if (up === 'Ñ') return wordLang === 'es' ? 'Ñ' : 'N';
  const base = up.normalize('NFD').replace(/[̀-ͯ]/g, '');
  return /^[A-Z]$/.test(base) ? base : null;
}
