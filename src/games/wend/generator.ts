import { createRng, type Rng } from '../../lib/rng';
import { HIDDEN_WORDS, VALID_WORDS } from './words';

export interface HiddenWord {
  word: string;
  /** Intended cell indices (r * size + c), in spelling order. */
  path: number[];
}

export interface WendPuzzle {
  size: number;
  /** true = gray wall tile. */
  walls: boolean[];
  /** Upper-case letter per cell, '' for walls. */
  letters: string[];
  /** Sorted by length (then alphabetically). */
  words: HiddenWord[];
}

interface SizeConfig {
  lengths: number[];
  walls: number;
}

export const SIZE_CONFIG: Record<number, SizeConfig> = {
  5: { lengths: [3, 4, 5, 6], walls: 7 },
  6: { lengths: [4, 5, 6, 7, 8], walls: 6 },
};

/** Language of the puzzle's words (the "Words" option), independent of the UI language. */
export type WordLang = 'en' | 'es';

/** Raw word data, as exported by words.ts / words.es.ts. */
export interface WordLists {
  /** Space-separated lower-case words per length. */
  HIDDEN_WORDS: Record<number, string>;
  /** Space-separated lower-case words that are real words but not hidden-word candidates. */
  VALID_WORDS: string;
}

/** The word pool a puzzle is built from (English or Spanish). */
export interface Lexicon {
  /** Hidden-word candidates of length `len`, lower case, in frequency order. */
  hiddenWords(len: number): string[];
  /** Is `word` (any case, tile alphabet) a real word, for the "Not one of the hidden words" message. */
  isValidWord(word: string): boolean;
}

export function makeLexicon(lists: WordLists): Lexicon {
  let hiddenCache: Record<number, string[]> | null = null;
  let validCache: Set<string> | null = null;
  const hidden = () => {
    if (!hiddenCache) {
      hiddenCache = {};
      for (const k of Object.keys(lists.HIDDEN_WORDS)) hiddenCache[+k] = lists.HIDDEN_WORDS[+k].split(' ');
    }
    return hiddenCache;
  };
  return {
    hiddenWords: (len) => hidden()[len] ?? [],
    isValidWord: (word) => {
      if (!validCache) {
        validCache = new Set(lists.VALID_WORDS.split(' '));
        for (const ws of Object.values(hidden())) for (const w of ws) validCache.add(w);
      }
      return validCache.has(word.toLowerCase());
    },
  };
}

export const EN_LEXICON: Lexicon = makeLexicon({ HIDDEN_WORDS, VALID_WORDS });

let esLexicon: Lexicon | null = null;
let esLoading: Promise<Lexicon> | null = null;

/** The lexicon for a word language when it's already in memory (English always is). */
export function lexiconIfLoaded(lang: WordLang): Lexicon | null {
  return lang === 'es' ? esLexicon : EN_LEXICON;
}

/** Load the lexicon for a word language; the Spanish data is its own chunk. */
export function loadLexicon(lang: WordLang): Promise<Lexicon> {
  if (lang === 'en') return Promise.resolve(EN_LEXICON);
  if (esLexicon) return Promise.resolve(esLexicon);
  esLoading ??= import('./words.es').then(
    (m) => (esLexicon = makeLexicon(m)),
    (err) => {
      esLoading = null;
      throw err;
    },
  );
  return esLoading;
}

/** English hidden-word candidates of length `len`. */
export function hiddenWords(len: number): string[] {
  return EN_LEXICON.hiddenWords(len);
}

/** Is `word` (any case) a real English word, for the "Not one of the hidden words" message. */
export function isValidWord(word: string): boolean {
  return EN_LEXICON.isValidWord(word);
}

/**
 * Map typed text to the tile alphabet: upper case, accents dropped (Á→A, Ü→U), Ñ kept as its own
 * letter.
 */
export function toTileLetters(text: string): string {
  return text
    .toUpperCase()
    .normalize('NFD')
    .replace(/N\u0303/g, '\u00d1')
    .replace(/[\u0300-\u036f]/g, '');
}

/** The tile letter for a key press (A-Z or Ñ, accented vowels mapped to their base), or null. */
export function keyToTileLetter(key: string): string | null {
  if ([...key].length !== 1) return null;
  const L = toTileLetters(key);
  return /^[A-Z\u00d1]$/.test(L) ? L : null;
}

export function neighbors(size: number, i: number): number[] {
  const r = Math.floor(i / size);
  const c = i % size;
  const out: number[] = [];
  if (r > 0) out.push(i - size);
  if (r < size - 1) out.push(i + size);
  if (c > 0) out.push(i - 1);
  if (c < size - 1) out.push(i + 1);
  return out;
}

export function isAdjacent(size: number, a: number, b: number): boolean {
  const ra = Math.floor(a / size);
  const rb = Math.floor(b / size);
  const ca = a % size;
  const cb = b % size;
  return Math.abs(ra - rb) + Math.abs(ca - cb) === 1;
}

// ---------------------------------------------------------------------------
// Walls

function placeWalls(rng: Rng, size: number, count: number): boolean[] | null {
  const walls = new Array<boolean>(size * size).fill(false);
  const order = rng.shuffle([...Array(size * size).keys()]);
  let placed = 0;
  for (const i of order) {
    if (placed === count) break;
    // Keep walls scattered (clusters of at most two), and never isolate an
    // open cell completely.
    const nb = neighbors(size, i);
    const wallNb = nb.filter((n) => walls[n]);
    if (wallNb.length > 1) continue;
    if (wallNb.length === 1 && neighbors(size, wallNb[0]).some((m) => walls[m])) continue;
    walls[i] = true;
    const isolates = nb.some((n) => !walls[n] && neighbors(size, n).every((m) => walls[m]));
    if (isolates) {
      walls[i] = false;
      continue;
    }
    placed++;
  }
  return placed === count ? walls : null;
}

// ---------------------------------------------------------------------------
// Partition the open cells into simple orthogonal paths of the target lengths.

function subsetSums(lengths: number[]): Set<number> {
  let sums = new Set<number>([0]);
  for (const l of lengths) {
    const next = new Set(sums);
    for (const s of sums) next.add(s + l);
    sums = next;
  }
  return sums;
}

function partition(rng: Rng, size: number, walls: boolean[], lengths: number[]): number[][] | null {
  const n = size * size;
  const used = walls.slice();
  const paths: number[][] = [];
  let budget = 6000;

  const freeDegree = (i: number) => neighbors(size, i).filter((m) => !used[m]).length;

  const feasible = (remaining: number[]): boolean => {
    const sums = subsetSums(remaining);
    const seen = new Array<boolean>(n).fill(false);
    for (let s = 0; s < n; s++) {
      if (used[s] || seen[s]) continue;
      let count = 0;
      const stack = [s];
      seen[s] = true;
      while (stack.length) {
        const u = stack.pop()!;
        count++;
        for (const v of neighbors(size, u)) {
          if (!used[v] && !seen[v]) {
            seen[v] = true;
            stack.push(v);
          }
        }
      }
      if (!sums.has(count)) return false;
    }
    return true;
  };

  const rec = (remaining: number[]): boolean => {
    if (remaining.length === 0) return true;
    if (--budget < 0) return false;
    // Most constrained free cell (random tie-break) becomes a path endpoint.
    let best = -1;
    let bestDeg = 9;
    for (const i of rng.shuffle([...Array(n).keys()])) {
      if (used[i]) continue;
      const d = freeDegree(i);
      if (d < bestDeg) {
        bestDeg = d;
        best = i;
      }
    }
    if (best < 0 || bestDeg === 0) return false;
    const lens = rng.shuffle([...new Set(remaining)]);
    for (const L of lens) {
      const rest = remaining.slice();
      rest.splice(rest.indexOf(L), 1);
      const path = [best];
      used[best] = true;
      const grow = (): boolean => {
        if (budget < 0) return false;
        if (path.length === L) {
          budget--;
          if (!feasible(rest)) return false;
          paths.push(path.slice());
          if (rec(rest)) return true;
          paths.pop();
          return false;
        }
        const last = path[path.length - 1];
        for (const v of rng.shuffle(neighbors(size, last))) {
          if (used[v]) continue;
          used[v] = true;
          path.push(v);
          if (grow()) return true;
          path.pop();
          used[v] = false;
        }
        return false;
      };
      if (grow()) return true;
      used[best] = false;
      if (budget < 0) return false;
    }
    return false;
  };

  return rec(lengths) ? paths : null;
}

// ---------------------------------------------------------------------------
// Solver: every way to spell each word along an orthogonal simple path, then
// count exact tilings (used for uniqueness checks and hints).

export function findPlacements(size: number, letters: string[], word: string, blocked?: boolean[]): number[][] {
  const W = word.toUpperCase();
  const out: number[][] = [];
  const path: number[] = [];
  const inPath = new Array<boolean>(size * size).fill(false);
  const dfs = () => {
    if (path.length === W.length) {
      out.push(path.slice());
      return;
    }
    const last = path[path.length - 1];
    for (const v of neighbors(size, last)) {
      if (inPath[v] || (blocked && blocked[v]) || letters[v] !== W[path.length]) continue;
      inPath[v] = true;
      path.push(v);
      dfs();
      path.pop();
      inPath[v] = false;
    }
  };
  for (let s = 0; s < size * size; s++) {
    if (letters[s] !== W[0] || (blocked && blocked[s])) continue;
    inPath[s] = true;
    path.push(s);
    dfs();
    path.pop();
    inPath[s] = false;
  }
  return out;
}

/**
 * Count ways (up to `limit`) to place every word in `words` on disjoint paths,
 * with cells in `blocked` unavailable.
 */
export function countTilings(size: number, letters: string[], words: string[], limit = 2, blocked?: boolean[]): number {
  const placements = words.map((w) => findPlacements(size, letters, w, blocked));
  if (placements.some((p) => p.length === 0)) return 0;
  const order = [...words.keys()].sort((a, b) => placements[a].length - placements[b].length);
  const used = blocked ? blocked.slice() : new Array<boolean>(size * size).fill(false);
  let count = 0;
  const rec = (k: number) => {
    if (count >= limit) return;
    if (k === order.length) {
      count++;
      return;
    }
    for (const p of placements[order[k]]) {
      if (p.some((c) => used[c])) continue;
      for (const c of p) used[c] = true;
      rec(k + 1);
      for (const c of p) used[c] = false;
      if (count >= limit) return;
    }
  };
  rec(0);
  return count;
}

// ---------------------------------------------------------------------------

export function generatePuzzle(seed: number, size: number, lexicon: Lexicon = EN_LEXICON): WendPuzzle {
  const cfg = SIZE_CONFIG[size] ?? SIZE_CONFIG[5];
  size = SIZE_CONFIG[size] ? size : 5;
  const rng = createRng(seed * 7919 + size);
  let fallback: WendPuzzle | null = null;

  for (let attempt = 0; attempt < 400; attempt++) {
    const walls = placeWalls(rng, size, cfg.walls);
    if (!walls) continue;
    const paths = partition(rng, size, walls, cfg.lengths);
    if (!paths) continue;

    for (let wordTry = 0; wordTry < 6; wordTry++) {
      const taken = new Set<string>();
      const words: HiddenWord[] = [];
      for (const path of paths) {
        const pool = lexicon.hiddenWords(path.length);
        let w = rng.pick(pool);
        for (let k = 0; k < 20 && taken.has(w); k++) w = rng.pick(pool);
        if (taken.has(w)) break;
        taken.add(w);
        words.push({ word: w.toUpperCase(), path });
      }
      if (words.length !== paths.length) continue;
      const letters = walls.map(() => '');
      for (const { word, path } of words) path.forEach((c, i) => (letters[c] = word[i]));
      words.sort((a, b) => a.word.length - b.word.length || (a.word < b.word ? -1 : 1));
      const puzzle: WendPuzzle = { size, walls, letters, words };
      if (countTilings(size, letters, words.map((w) => w.word), 2) === 1) return puzzle;
      fallback ??= puzzle;
    }
  }
  // Practically unreachable; still return something deterministic.
  if (fallback) return fallback;
  throw new Error('Wend: generation failed');
}

// ---------------------------------------------------------------------------
// Hints

export interface FoundWord {
  /** Index into puzzle.words. */
  w: number;
  path: number[];
}

export type HintResult =
  | { kind: 'blocking'; found: number }
  | { kind: 'reveal'; w: number; step: number }
  | { kind: 'none' };

function sameCells(a: number[], b: number[]): boolean {
  if (a.length !== b.length) return false;
  const s = new Set(a);
  return b.every((c) => s.has(c));
}

/**
 * LinkedIn-style hint: if a found word sits on the wrong tiles (which, with a
 * unique tiling, always blocks the rest) point it out; otherwise reveal the
 * next tile of the shortest unfound word whose intended path is still free.
 */
export function nextHint(puzzle: WendPuzzle, found: FoundWord[], revealed: number[]): HintResult {
  const used = new Array<boolean>(puzzle.size * puzzle.size).fill(false);
  for (const f of found) for (const c of f.path) used[c] = true;
  const foundSet = new Set(found.map((f) => f.w));
  const candidates = puzzle.words
    .map((hw, w) => ({ hw, w }))
    .filter(({ w, hw }) => !foundSet.has(w) && hw.path.every((c) => !used[c]));
  // Most recent misplaced word first.
  for (let i = found.length - 1; i >= 0; i--) {
    if (!sameCells(found[i].path, puzzle.words[found[i].w].path)) return { kind: 'blocking', found: i };
  }
  if (candidates.length === 0 && found.length < puzzle.words.length) {
    return { kind: 'blocking', found: found.length - 1 };
  }
  candidates.sort((a, b) => a.hw.word.length - b.hw.word.length || a.w - b.w);
  for (const { w, hw } of candidates) {
    if ((revealed[w] ?? 0) < hw.word.length) return { kind: 'reveal', w, step: revealed[w] ?? 0 };
  }
  return { kind: 'none' };
}
