/**
 * Deterministic Queens generator.
 *  1. Random queen placement (one per row/column, no two touching).
 *  2. Grow one region per queen with a randomized, style-biased flood fill (blobs, snakes, in-between).
 *  3. Repair until the solution is unique: take a rival solution and move one of its queens' cells into a
 *     neighbouring region (keeping regions connected), which breaks that rival.
 *  4. Keep only puzzles the logic solver finishes without guessing.
 */
import { createRng, type Rng } from '../../lib/rng';
import { findSolutions, type Puzzle } from './puzzle';
import { Solver } from './solver';

const DIRS = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
];

function randomQueens(n: number, rng: Rng): number[] {
  const cols: number[] = [];
  const used = new Array<boolean>(n).fill(false);
  const rec = (r: number): boolean => {
    if (r === n) return true;
    for (const c of rng.shuffle(Array.from({ length: n }, (_, i) => i))) {
      if (used[c] || (r > 0 && Math.abs(cols[r - 1] - c) <= 1)) continue;
      used[c] = true;
      cols[r] = c;
      if (rec(r + 1)) return true;
      used[c] = false;
    }
    return false;
  };
  rec(0);
  return cols;
}

function growRegions(n: number, queens: number[], rng: Rng): number[] {
  const nn = n * n;
  const regions = new Array<number>(nn).fill(-1);
  // style > 0 favours compact blobs, < 0 favours long thin snakes.
  const style: number[] = [];
  const weight: number[] = [];
  for (let g = 0; g < n; g++) {
    regions[g * n + queens[g]] = g;
    const roll = rng.next();
    style.push(roll < 0.3 ? -1.2 : roll < 0.65 ? 1.4 : 0.4);
    weight.push(0.35 + rng.next() * 1.3);
  }
  let left = nn - n;
  const sameNeighbours = (cell: number, g: number) => {
    const r = Math.floor(cell / n);
    const c = cell % n;
    let k = 0;
    for (const [dr, dc] of DIRS) {
      const rr = r + dr;
      const cc = c + dc;
      if (rr >= 0 && rr < n && cc >= 0 && cc < n && regions[rr * n + cc] === g) k++;
    }
    return k;
  };
  while (left > 0) {
    // Frontier per region.
    const frontier: number[][] = Array.from({ length: n }, () => []);
    for (let cell = 0; cell < nn; cell++) {
      if (regions[cell] !== -1) continue;
      const r = Math.floor(cell / n);
      const c = cell % n;
      const seen = new Set<number>();
      for (const [dr, dc] of DIRS) {
        const rr = r + dr;
        const cc = c + dc;
        if (rr < 0 || rr >= n || cc < 0 || cc >= n) continue;
        const g = regions[rr * n + cc];
        if (g >= 0 && !seen.has(g)) {
          seen.add(g);
          frontier[g].push(cell);
        }
      }
    }
    let total = 0;
    for (let g = 0; g < n; g++) if (frontier[g].length) total += weight[g];
    let roll = rng.next() * total;
    let g = 0;
    for (; g < n; g++) {
      if (!frontier[g].length) continue;
      roll -= weight[g];
      if (roll <= 0) break;
    }
    if (g >= n) g = frontier.findIndex((f) => f.length > 0);
    let best = -1;
    let bestScore = -Infinity;
    for (const cell of frontier[g]) {
      const score = rng.next() + style[g] * (sameNeighbours(cell, g) - 1);
      if (score > bestScore) {
        bestScore = score;
        best = cell;
      }
    }
    regions[best] = g;
    left--;
  }
  return regions;
}

function connectedWithout(n: number, regions: number[], g: number, removed: number, seed: number): boolean {
  let size = 0;
  for (let i = 0; i < regions.length; i++) if (regions[i] === g && i !== removed) size++;
  const seen = new Set<number>([seed]);
  const stack = [seed];
  while (stack.length) {
    const cell = stack.pop()!;
    const r = Math.floor(cell / n);
    const c = cell % n;
    for (const [dr, dc] of DIRS) {
      const rr = r + dr;
      const cc = c + dc;
      if (rr < 0 || rr >= n || cc < 0 || cc >= n) continue;
      const nb = rr * n + cc;
      if (nb === removed || seen.has(nb) || regions[nb] !== g) continue;
      seen.add(nb);
      stack.push(nb);
    }
  }
  return seen.size === size;
}

function makeUnique(n: number, regions: number[], queens: number[], rng: Rng, budget: number): boolean {
  const seeds = queens.map((c, r) => r * n + c);
  const isSeed = new Set(seeds);
  for (let iter = 0; iter < budget; iter++) {
    const sols = findSolutions(n, regions, 2);
    const rival = sols.find((s) => s.some((c, r) => c !== queens[r]));
    if (!rival) return true;
    const moves: [number, number, number][] = [];
    for (let r = 0; r < n; r++) {
      const cell = r * n + rival[r];
      if (isSeed.has(cell)) continue;
      const from = regions[cell];
      const targets = new Set<number>();
      for (const [dr, dc] of DIRS) {
        const rr = r + dr;
        const cc = rival[r] + dc;
        if (rr < 0 || rr >= n || cc < 0 || cc >= n) continue;
        const g = regions[rr * n + cc];
        if (g !== from) targets.add(g);
      }
      if (!targets.size || !connectedWithout(n, regions, from, cell, seeds[from])) continue;
      for (const t of targets) moves.push([cell, t, 0]);
    }
    if (!moves.length) return false;
    // Prefer moves that tuck the cell into its new region (fewer jagged borders).
    for (const m of moves) {
      const r = Math.floor(m[0] / n);
      const c = m[0] % n;
      let same = 0;
      for (const [dr, dc] of DIRS) {
        const rr = r + dr;
        const cc = c + dc;
        if (rr >= 0 && rr < n && cc >= 0 && cc < n && regions[rr * n + cc] === m[1]) same++;
      }
      m[2] = same + rng.next() * 1.5;
    }
    moves.sort((a, b) => b[2] - a[2]);
    const [cell, to] = moves[0];
    regions[cell] = to;
  }
  return false;
}

export interface GenerateStats {
  attempts: number;
}

export function generate(seed: number, size: number, stats?: GenerateStats): Puzzle {
  const n = Math.max(4, Math.min(10, Math.floor(size)));
  const rng = createRng((Math.imul(seed >>> 0, 31) + n * 7919) >>> 0);
  let fallback: Puzzle | null = null;
  for (let attempt = 1; attempt <= 300; attempt++) {
    const r = rng.fork();
    const queens = randomQueens(n, r);
    const regions = growRegions(n, queens, r);
    if (!makeUnique(n, regions, queens, r, n * 6)) continue;
    const puzzle = relabel(n, regions, queens, r);
    fallback ??= puzzle;
    if (new Solver(n, puzzle.regions).solve().solved) {
      if (stats) stats.attempts = attempt;
      return puzzle;
    }
  }
  if (stats) stats.attempts = -1;
  // Practically unreachable; a unique puzzle that needs a guess is still playable (hints reveal a queen).
  return fallback ?? generate(seed + 1, n, stats);
}

/** Shuffles region ids so colors are assigned randomly (region id = palette index). */
function relabel(n: number, regions: number[], queens: number[], rng: Rng): Puzzle {
  const perm = rng.shuffle(Array.from({ length: n }, (_, i) => i));
  return { size: n, regions: regions.map((g) => perm[g]), solution: queens.slice() };
}
