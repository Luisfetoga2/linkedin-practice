import { createRng, type Rng } from '../../lib/rng';
import type { ClueEntry } from './data/types';

/**
 * Mini crossword generator: picks a symmetric NYT-Mini-style template and fills it from a clued
 * word list by backtracking (most-constrained slot first, letter-position bitset indexes,
 * randomized candidate order, no repeated words). Deterministic for a given seed and word list.
 */

export type MiniSize = 4 | 5;
export type Dir = 'across' | 'down';

export interface MiniClue {
  /** Clue number shown in the grid corner. */
  num: number;
  dir: Dir;
  row: number;
  col: number;
  len: number;
  /** Cell indexes (row * size + col), in reading order. */
  cells: number[];
  answer: string;
  clue: string;
}

export interface MiniPuzzle {
  size: MiniSize;
  /** Row-major; true = black square. */
  blocks: boolean[];
  /** Row-major answer letters ('' on black squares). */
  solution: string[];
  /** Clue number per cell (0 when the cell starts no entry). */
  numbers: number[];
  across: MiniClue[];
  down: MiniClue[];
  /** Template id the grid was built from (for tests / debugging). */
  template: string;
}

// ---------------------------------------------------------------------------------------------
// Templates
// ---------------------------------------------------------------------------------------------

/** Row strings: '.' white, '#' black. */
const BASE_TEMPLATES: Record<MiniSize, { id: string; rows: string[]; weight: number }[]> = {
  5: [
    { id: 'diag2', rows: ['#....', '.....', '.....', '.....', '....#'], weight: 3 },
    { id: 'corners4', rows: ['#...#', '.....', '.....', '.....', '#...#'], weight: 3 },
    { id: 'steps', rows: ['##...', '#....', '.....', '....#', '...##'], weight: 4 },
    { id: 'notch', rows: ['##...', '.....', '.....', '.....', '...##'], weight: 3 },
  ],
  4: [
    { id: 'open', rows: ['....', '....', '....', '....'], weight: 3 },
    { id: 'diag2', rows: ['#...', '....', '....', '...#'], weight: 3 },
  ],
};

export interface Template {
  id: string;
  size: MiniSize;
  blocks: boolean[];
  weight: number;
}

function mirror(rows: string[]): string[] {
  return rows.map((r) => r.split('').reverse().join(''));
}
function transpose(rows: string[]): string[] {
  return rows[0].split('').map((_, c) => rows.map((r) => r[c]).join(''));
}

/** Every template plus its distinct mirror / transpose variants. */
export function templates(size: MiniSize): Template[] {
  const out: Template[] = [];
  const seen = new Set<string>();
  for (const t of BASE_TEMPLATES[size]) {
    const variants = [t.rows, mirror(t.rows), transpose(t.rows), mirror(transpose(t.rows))];
    const distinct = variants.filter((v) => {
      const key = v.join('/');
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    distinct.forEach((rows, i) =>
      out.push({
        id: i ? `${t.id}~${i}` : t.id,
        size,
        blocks: rows.join('').split('').map((ch) => ch === '#'),
        weight: t.weight / distinct.length,
      }),
    );
  }
  return out;
}

interface Slot {
  dir: Dir;
  row: number;
  col: number;
  cells: number[];
}

/** Maximal runs of white cells, across then down (runs of length 1 are not entries). */
export function slotsOf(size: number, blocks: readonly boolean[]): Slot[] {
  const out: Slot[] = [];
  for (const dir of ['across', 'down'] as Dir[]) {
    for (let a = 0; a < size; a++) {
      let run: number[] = [];
      const flush = () => {
        if (run.length > 1) {
          const first = run[0];
          out.push({ dir, row: Math.floor(first / size), col: first % size, cells: run });
        }
        run = [];
      };
      for (let b = 0; b < size; b++) {
        const idx = dir === 'across' ? a * size + b : b * size + a;
        if (blocks[idx]) flush();
        else run.push(idx);
      }
      flush();
    }
  }
  return out;
}

/** Every white cell is in an across and a down entry, and every entry has at least 3 letters. */
export function isValidTemplate(size: number, blocks: readonly boolean[]): boolean {
  const slots = slotsOf(size, blocks);
  if (slots.some((s) => s.cells.length < 3)) return false;
  for (let i = 0; i < size * size; i++) {
    if (blocks[i]) continue;
    const dirs = new Set(slots.filter((s) => s.cells.includes(i)).map((s) => s.dir));
    if (dirs.size !== 2) return false;
  }
  return true;
}

// ---------------------------------------------------------------------------------------------
// Word index
// ---------------------------------------------------------------------------------------------

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZÑ';
const CODE = new Map([...ALPHABET].map((ch, i) => [ch, i]));

interface LengthIndex {
  words: string[];
  clues: string[][];
  /** Bitsets: pos[p * 27 + letter] has bit w set when words[w][p] is that letter. */
  pos: Uint32Array[];
  blocks: number;
  /** Ordering weight per word: low for words made of very common letters (they fit anywhere). */
  weight: Float64Array;
}

/** How strongly to push easy-to-cross words back in the candidate order. */
const GLUE_PENALTY = 1.2;

type WordIndex = Map<number, LengthIndex>;

const indexCache = new WeakMap<readonly ClueEntry[], WordIndex>();

function buildIndex(entries: readonly ClueEntry[]): WordIndex {
  const byLen = new Map<number, ClueEntry[]>();
  const seen = new Set<string>();
  for (const e of entries) {
    const w = e.word;
    if (w.length < 3 || w.length > 5 || !e.clues.length || seen.has(w)) continue;
    if (![...w].every((ch) => CODE.has(ch))) continue;
    seen.add(w);
    let list = byLen.get(w.length);
    if (!list) byLen.set(w.length, (list = []));
    list.push(e);
  }
  const index: WordIndex = new Map();
  for (const [len, list] of byLen) {
    const n = list.length;
    const blocks = Math.ceil(n / 32);
    const pos = Array.from({ length: len * 27 }, () => new Uint32Array(blocks));
    list.forEach((e, w) => {
      for (let p = 0; p < len; p++) pos[p * 27 + CODE.get(e.word[p])!][w >>> 5] |= 1 << (w & 31);
    });
    // "Ease" = how likely a random word of this length shares each of its letters in place.
    const ease = list.map((e) => {
      let x = 1;
      for (let p = 0; p < len; p++) x *= popcountArr(pos[p * 27 + CODE.get(e.word[p])!]) / n;
      return x;
    });
    const sorted = [...ease].sort((a, b) => a - b);
    const median = sorted[sorted.length >> 1] || 1;
    const weight = Float64Array.from(ease, (x) => Math.pow(Math.max(x, 1e-12) / median, -GLUE_PENALTY / len));
    index.set(len, { words: list.map((e) => e.word), clues: list.map((e) => e.clues), pos, blocks, weight });
  }
  return index;
}

function getIndex(entries: readonly ClueEntry[]): WordIndex {
  let idx = indexCache.get(entries);
  if (!idx) {
    idx = buildIndex(entries);
    indexCache.set(entries, idx);
  }
  return idx;
}

function popcountArr(a: Uint32Array): number {
  let n = 0;
  for (let i = 0; i < a.length; i++) n += popcount(a[i]);
  return n;
}

function popcount(x: number): number {
  x -= (x >>> 1) & 0x55555555;
  x = (x & 0x33333333) + ((x >>> 2) & 0x33333333);
  return (((x + (x >>> 4)) & 0x0f0f0f0f) * 0x01010101) >>> 24;
}

// ---------------------------------------------------------------------------------------------
// Fill
// ---------------------------------------------------------------------------------------------

/**
 * Backtracking fill of one template. Returns the word index chosen per slot, or null when the
 * node budget runs out or the template can't be filled.
 */
function fill(
  size: number,
  blocks: readonly boolean[],
  index: WordIndex,
  rng: Rng,
  budget: number,
): { slots: Slot[]; words: number[] } | null {
  const slots = slotsOf(size, blocks);
  const S = slots.length;
  const lens = slots.map((s) => s.cells.length);
  const idx = lens.map((l) => index.get(l));
  if (idx.some((x) => !x || !x.words.length)) return null;
  const grid = new Int8Array(size * size).fill(-1);
  const chosen = new Array<number>(S).fill(-1);
  const used = new Set<string>();
  let nodes = 0;
  const scratch = slots.map((_, s) => new Uint32Array(idx[s]!.blocks));

  /** Candidate bitset (written into scratch[s]) and its size for slot s given the grid. */
  const candidates = (s: number): number => {
    const li = idx[s]!;
    const out = scratch[s];
    out.fill(0xffffffff);
    const extra = li.words.length & 31;
    if (extra) out[li.blocks - 1] = (1 << extra) - 1 || 0xffffffff;
    const cells = slots[s].cells;
    for (let p = 0; p < cells.length; p++) {
      const g = grid[cells[p]];
      if (g < 0) continue;
      const bits = li.pos[p * 27 + g];
      for (let b = 0; b < li.blocks; b++) out[b] &= bits[b];
    }
    let n = 0;
    for (let b = 0; b < li.blocks; b++) n += popcount(out[b]);
    return n;
  };

  const solve = (depth: number): boolean => {
    if (depth === S) return true;
    if (++nodes > budget) return false;
    let best = -1;
    let bestN = Infinity;
    for (let s = 0; s < S; s++) {
      if (chosen[s] >= 0) continue;
      const n = candidates(s);
      if (n === 0) return false;
      // Prefer the most constrained slot; break ties toward longer entries.
      if (n < bestN || (n === bestN && lens[s] > lens[best])) {
        bestN = n;
        best = s;
      }
    }
    candidates(best);
    const li = idx[best]!;
    const list: number[] = [];
    const bits = scratch[best];
    for (let b = 0; b < li.blocks; b++) {
      let x = bits[b];
      while (x) {
        const low = x & -x;
        list.push(b * 32 + (31 - Math.clz32(low)));
        x ^= low;
      }
    }
    // Weighted random order (Efraimidis–Spirakis): easy-to-cross "glue" words are tried later,
    // so they don't crowd into most puzzles.
    const order = list
      .map((w) => ({ w, k: Math.pow(rng.next(), 1 / li.weight[w]) }))
      .sort((a, b) => b.k - a.k)
      .map((x) => x.w);
    const cells = slots[best].cells;
    for (const w of order) {
      const word = li.words[w];
      if (used.has(word)) continue;
      const prev = cells.map((c) => grid[c]);
      cells.forEach((c, p) => (grid[c] = CODE.get(word[p])!));
      chosen[best] = w;
      used.add(word);
      if (solve(depth + 1)) return true;
      used.delete(word);
      chosen[best] = -1;
      cells.forEach((c, p) => (grid[c] = prev[p]));
      if (nodes > budget) return false;
    }
    return false;
  };

  return solve(0) ? { slots, words: chosen } : null;
}

function build(size: MiniSize, t: Template, index: WordIndex, result: { slots: Slot[]; words: number[] }, rng: Rng): MiniPuzzle {
  const numbers = new Array<number>(size * size).fill(0);
  let next = 1;
  const starts = new Set(result.slots.map((s) => s.cells[0]));
  for (let i = 0; i < size * size; i++) if (starts.has(i)) numbers[i] = next++;
  const solution = new Array<string>(size * size).fill('');
  const across: MiniClue[] = [];
  const down: MiniClue[] = [];
  result.slots.forEach((s, k) => {
    const li = index.get(s.cells.length)!;
    const w = result.words[k];
    const answer = li.words[w];
    s.cells.forEach((c, p) => (solution[c] = answer[p]));
    const clue: MiniClue = {
      num: numbers[s.cells[0]],
      dir: s.dir,
      row: s.row,
      col: s.col,
      len: s.cells.length,
      cells: s.cells,
      answer,
      clue: rng.pick(li.clues[w]),
    };
    (s.dir === 'across' ? across : down).push(clue);
  });
  across.sort((a, b) => a.num - b.num);
  down.sort((a, b) => a.num - b.num);
  return { size, blocks: t.blocks.slice(), solution, numbers, across, down, template: t.id };
}

function weightedOrder(list: Template[], rng: Rng): Template[] {
  const pool = list.slice();
  const out: Template[] = [];
  while (pool.length) {
    const total = pool.reduce((a, t) => a + t.weight, 0);
    let r = rng.next() * total;
    let i = 0;
    while (i < pool.length - 1 && (r -= pool[i].weight) >= 0) i++;
    out.push(pool.splice(i, 1)[0]);
  }
  return out;
}

/** Nodes explored per fill attempt before moving on to another template. */
const BUDGET = 6000;

/**
 * Generate a mini crossword. Tries templates in a seeded, weighted order with a node budget each,
 * then keeps retrying (fresh randomness, larger budgets) so a puzzle is always returned for any
 * reasonable word list. Throws only if the list can't fill even the easiest template.
 */
export function generateMini(seed: number, size: MiniSize, entries: readonly ClueEntry[]): MiniPuzzle {
  const index = getIndex(entries);
  const rng = createRng(seed * 31 + size);
  const all = templates(size);
  for (let round = 0; round < 8; round++) {
    const budget = BUDGET * (1 + round * round);
    for (const t of weightedOrder(all, rng)) {
      const r = rng.fork();
      const res = fill(size, t.blocks, index, r, budget);
      if (res) return build(size, t, index, res, r);
    }
  }
  throw new Error(`Mini: could not fill a ${size}×${size} grid from ${entries.length} words`);
}

/** Validity check used by tests: every entry is a listed word, crossings agree, no repeats. */
export function checkPuzzle(p: MiniPuzzle, entries: readonly ClueEntry[]): string[] {
  const errors: string[] = [];
  const bank = new Map(entries.map((e) => [e.word, e.clues]));
  if (!isValidTemplate(p.size, p.blocks)) errors.push('invalid template');
  const seen = new Set<string>();
  for (const c of [...p.across, ...p.down]) {
    const read = c.cells.map((i) => p.solution[i]).join('');
    if (read !== c.answer) errors.push(`${c.num}${c.dir[0]} reads ${read}, expected ${c.answer}`);
    if (!bank.get(c.answer)?.includes(c.clue)) errors.push(`${c.answer} has a clue not from the list`);
    if (seen.has(c.answer)) errors.push(`repeated ${c.answer}`);
    seen.add(c.answer);
    if (c.len < 3) errors.push(`${c.answer} too short`);
  }
  const slots = slotsOf(p.size, p.blocks);
  if (slots.length !== p.across.length + p.down.length) errors.push('slot count mismatch');
  p.solution.forEach((ch, i) => {
    if (p.blocks[i] !== !ch) errors.push(`cell ${i} mismatch`);
  });
  return errors;
}
