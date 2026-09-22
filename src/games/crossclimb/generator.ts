import { createRng, type Rng } from '../../lib/rng';
import { getClueBank, type WordLength } from './data';

export const RUNGS = 7;
export const MIDDLE = RUNGS - 2;

export interface Ladder {
  length: WordLength;
  /** Solution ladder, top → bottom (uppercase). Middle rungs are indices 1..5. */
  words: string[];
  /** One chosen clue per rung, aligned with `words`. */
  clues: string[];
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
  adj: number[][];
  adjSet: Set<number>[];
  starts: number[];
}

const graphs = new Map<WordLength, Graph>();

export function getGraph(length: WordLength): Graph {
  let g = graphs.get(length);
  if (g) return g;
  const bank = getClueBank(length);
  const words = [...bank.keys()];
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
  // Start from words that can sit mid-ladder (≥2 neighbours) so the first step rarely dead-ends.
  const starts = words.map((_, i) => i).filter((i) => adj[i].length >= 2);
  g = { words, adj, adjSet, starts };
  graphs.set(length, g);
  return g;
}

/**
 * Random induced (chordless) path of RUNGS words: no two non-consecutive rungs are one letter
 * apart. That guarantees the middle five have exactly one valid ordering (up to reversal) and the
 * top/bottom rungs attach only to their own ends.
 */
function findPath(g: Graph, rng: Rng, budget: { left: number }): number[] | null {
  const { adj, adjSet } = g;
  const L = g.words[0].length;
  const start = g.starts[rng.int(0, g.starts.length - 1)];
  const path = [start];
  const onPath = new Set(path);
  const positions: number[] = [];

  const rec = (): boolean => {
    if (path.length === RUNGS) return new Set(positions).size >= Math.min(3, L);
    if (--budget.left <= 0) return false;
    const last = path[path.length - 1];
    for (const n of rng.shuffle(adj[last])) {
      if (onPath.has(n)) continue;
      let chord = false;
      for (let k = 0; k < path.length - 1; k++) {
        if (adjSet[n].has(path[k])) {
          chord = true;
          break;
        }
      }
      if (chord) continue;
      const pos = diffIndex(g.words[last], g.words[n]);
      path.push(n);
      onPath.add(n);
      positions.push(pos);
      if (rec()) return true;
      positions.pop();
      onPath.delete(n);
      path.pop();
      if (budget.left <= 0) return false;
    }
    return false;
  };
  return rec() ? path : null;
}

export function generateLadder(seed: number, length: WordLength): Ladder {
  const rng = createRng(seed);
  const g = getGraph(length);
  const bank = getClueBank(length);
  let path: number[] | null = null;
  for (let attempt = 0; attempt < 400 && !path; attempt++) {
    path = findPath(g, rng, { left: 400 });
  }
  if (!path) throw new Error('Crossclimb: could not build a ladder');
  let words = path.map((i) => g.words[i]);
  if (rng.chance(0.5)) words = words.reverse();
  const clues = words.map((w) => rng.pick(bank.get(w)!));

  const solved = [1, 2, 3, 4, 5];
  let order = rng.shuffle(solved);
  // Never hand out an order that is already mostly chained together (at most one correct neighbor pair).
  for (let i = 0; i < 100 && goodLinks(order) > 1; i++) order = rng.shuffle(solved);
  return { length, words, clues, order };
}

/** Adjacent pairs in a shuffled middle order that are also neighbors in the solution. */
export function goodLinks(order: readonly number[]): number {
  let n = 0;
  for (let i = 1; i < order.length; i++) if (Math.abs(order[i] - order[i - 1]) === 1) n++;
  return n;
}
