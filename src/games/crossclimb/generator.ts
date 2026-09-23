import { createRng, type Rng } from '../../lib/rng';
import { getClueBank, getPairs, type EndPair, type WordLang, type WordLength } from './data';

export const RUNGS = 7;
export const MIDDLE = RUNGS - 2;

export interface Ladder {
  length: WordLength;
  /** Solution ladder, top → bottom (uppercase). Middle rungs are indices 1..5; 0 and 6 are the end pair. */
  words: string[];
  /** One chosen clue per rung, aligned with `words`. The top and bottom rung share `endClue`. */
  clues: string[];
  /** Shared clue for the top (`words[0]`) and bottom (`words[6]`) rungs, e.g. a compound or a pair. */
  endClue: string;
  /** Initial (shuffled) display order of the middle rungs, as indices into `words` (values 1..5). */
  order: number[];
}

/** True when two equal-length words differ in exactly one position. */
export function oneApart(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i] && ++d > 1) return false;
  return d === 1;
}

/** Position of the single differing letter, or -1. */
export function diffIndex(a: string, b: string): number {
  if (!oneApart(a, b)) return -1;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return i;
  return -1;
}

/** A sequence is a valid ladder when every neighbouring pair differs by exactly one letter. */
export function isLadder(seq: readonly string[]): boolean {
  for (let i = 1; i < seq.length; i++) if (!oneApart(seq[i - 1], seq[i])) return false;
  return true;
}

/** Number of orderings of `words` that form a valid ladder (counts both directions). */
export function countLadderOrders(words: readonly string[]): number {
  const n = words.length;
  const used = new Array<boolean>(n).fill(false);
  const seq: string[] = [];
  let count = 0;
  const rec = () => {
    if (seq.length === n) {
      count++;
      return;
    }
    for (let i = 0; i < n; i++) {
      if (used[i]) continue;
      if (seq.length && !oneApart(seq[seq.length - 1], words[i])) continue;
      used[i] = true;
      seq.push(words[i]);
      rec();
      seq.pop();
      used[i] = false;
    }
  };
  rec();
  return count;
}

interface Graph {
  words: string[];
  index: Map<string, number>;
  adj: number[][];
  adjSet: Set<number>[];
  starts: number[];
}

const graphs = new Map<string, Graph>();

/** One-letter-change graph over the clued vocabulary of a word length and word language. */
export function getGraph(length: WordLength, lang: WordLang = 'en'): Graph {
  const key = `${lang}${length}`;
  let g = graphs.get(key);
  if (g) return g;
  const bank = getClueBank(length, lang);
  const words = [...bank.keys()];
  const index = new Map(words.map((w, i) => [w, i]));
  const adj: number[][] = words.map(() => []);
  const buckets = new Map<string, number[]>();
  words.forEach((w, i) => {
    for (let p = 0; p < w.length; p++) {
      const key = w.slice(0, p) + '_' + w.slice(p + 1);
      let list = buckets.get(key);
      if (!list) buckets.set(key, (list = []));
      list.push(i);
    }
  });
  for (const list of buckets.values()) for (const a of list) for (const b of list) if (a !== b) adj[a].push(b);
  const adjSet = adj.map((a) => new Set(a));
  const starts = words.map((_, i) => i).filter((i) => adj[i].length >= 2);
  g = { words, index, adj, adjSet, starts };
  graphs.set(key, g);
  return g;
}

/** Breadth-first distances (in single-letter steps) from `from` to every word; unreachable = Infinity. */
function distancesFrom(g: Graph, from: number): number[] {
  const dist = new Array<number>(g.words.length).fill(Infinity);
  dist[from] = 0;
  const queue = [from];
  for (let h = 0; h < queue.length; h++) {
    const u = queue[h];
    for (const v of g.adj[u]) {
      if (dist[v] === Infinity) {
        dist[v] = dist[u] + 1;
        queue.push(v);
      }
    }
  }
  return dist;
}

/**
 * Random induced (chordless) path of RUNGS words from `top` to `bottom`: every rung differs from its
 * neighbours by one letter and no two non-consecutive rungs do. That guarantees the middle five have
 * exactly one valid ordering (up to reversal) and that the fixed end rungs attach only to their own
 * end of the chain. The changed letter positions must also vary (at least 3 distinct positions).
 * Returns word indices, or null when no such ladder exists (or the search budget runs out).
 */
export function findPairLadder(g: Graph, top: number, bottom: number, rng: Rng | null, budget = 50_000): number[] | null {
  const { adj, adjSet } = g;
  if (top === bottom || adjSet[top].has(bottom)) return null;
  const L = g.words[0].length;
  const toBottom = distancesFrom(g, bottom);
  if (toBottom[top] > RUNGS - 1) return null;
  const path = [top];
  const onPath = new Set(path);
  const positions: number[] = [];
  let left = budget;

  const rec = (): boolean => {
    const k = path.length; // index of the rung being placed
    const last = path[k - 1];
    if (k === RUNGS - 1) {
      if (!adjSet[last].has(bottom)) return false;
      const pos = new Set(positions);
      pos.add(diffIndex(g.words[last], g.words[bottom]));
      if (pos.size < Math.min(3, L)) return false;
      path.push(bottom);
      return true;
    }
    if (--left <= 0) return false;
    const next = rng ? rng.shuffle(adj[last]) : adj[last];
    for (const n of next) {
      if (onPath.has(n) || n === bottom) continue;
      if (toBottom[n] > RUNGS - 1 - k) continue;
      // Only the last middle rung may touch the bottom word.
      if (k < RUNGS - 2 && adjSet[n].has(bottom)) continue;
      let chord = false;
      for (let j = 0; j < k - 1; j++) {
        if (adjSet[n].has(path[j])) {
          chord = true;
          break;
        }
      }
      if (chord) continue;
      path.push(n);
      onPath.add(n);
      positions.push(diffIndex(g.words[last], g.words[n]));
      if (rec()) return true;
      positions.pop();
      onPath.delete(n);
      path.pop();
      if (left <= 0) return false;
    }
    return false;
  };
  return rec() ? path : null;
}

/** Deterministic ladder for a seed. Spanish (`lang` 'es') needs its data loaded first (see loadWords). */
export function generateLadder(seed: number, length: WordLength, lang: WordLang = 'en'): Ladder {
  const rng = createRng(seed);
  const g = getGraph(length, lang);
  const bank = getClueBank(length, lang);
  const pairs = getPairs(length, lang);
  let path: number[] | null = null;
  let pair: EndPair | null = null;
  // Pairs are tried in a seed-determined order; every committed pair is known to be feasible, so the
  // first one normally succeeds and the rest are only a safety net.
  for (const i of rng.shuffle(pairs.map((_, k) => k))) {
    const p = pairs[i];
    const a = g.index.get(p.top);
    const b = g.index.get(p.bottom);
    if (a === undefined || b === undefined) continue;
    path = findPairLadder(g, a, b, rng);
    if (path) {
      pair = p;
      break;
    }
  }
  if (!path || !pair) throw new Error('Crossclimb: could not build a ladder');
  const words = path.map((i) => g.words[i]);
  const clues = words.map((w, i) => (i === 0 || i === RUNGS - 1 ? pair.clue : rng.pick(bank.get(w)!)));

  const solved = [1, 2, 3, 4, 5];
  let order = rng.shuffle(solved);
  // Never hand out an order that is already mostly chained together (at most one correct neighbor pair).
  for (let i = 0; i < 100 && goodLinks(order) > 1; i++) order = rng.shuffle(solved);
  return { length, words, clues, endClue: pair.clue, order };
}

/** Adjacent pairs in a shuffled middle order that are also neighbors in the solution. */
export function goodLinks(order: readonly number[]): number {
  let n = 0;
  for (let i = 1; i < order.length; i++) if (Math.abs(order[i] - order[i - 1]) === 1) n++;
  return n;
}
