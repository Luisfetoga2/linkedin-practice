import { createRng, type Rng } from '../../lib/rng';

/** Wall bits on a cell (a wall on an edge is stored on both cells that share it). */
export const UP = 1;
export const RIGHT = 2;
export const DOWN = 4;
export const LEFT = 8;

export interface ZipPuzzle {
  size: number;
  /** numbers[cell] = 1..count, or 0 for a plain cell. */
  numbers: number[];
  /** Number of numbered dots (the path ends on this number). */
  count: number;
  /** walls[cell] = bitmask of blocked sides (UP/RIGHT/DOWN/LEFT). */
  walls: number[];
  /** The unique solution: cells in path order. */
  solution: number[];
  /** Gradient stops for the path colour. */
  palette: [string, string];
}

export const PALETTES: [string, string][] = [
  ['#ff7a2e', '#f2459a'],
  ['#ff9d1c', '#ff4b4b'],
  ['#3d8bff', '#a05cff'],
  ['#12b5a5', '#3d7bff'],
  ['#f2459a', '#8b5cff'],
  ['#ffb41f', '#ff5a36'],
];

/** Cell reached from `cell` by moving in direction `dir`, ignoring walls; -1 if off-grid. */
export function step(size: number, cell: number, dir: number): number {
  const r = Math.floor(cell / size);
  const c = cell % size;
  if (dir === UP) return r > 0 ? cell - size : -1;
  if (dir === DOWN) return r < size - 1 ? cell + size : -1;
  if (dir === LEFT) return c > 0 ? cell - 1 : -1;
  return c < size - 1 ? cell + 1 : -1;
}

/** Direction bit from a to an orthogonally adjacent b; 0 if not adjacent. */
export function dirBetween(size: number, a: number, b: number): number {
  if (b === a - size) return UP;
  if (b === a + size) return DOWN;
  if (b === a - 1 && a % size !== 0) return LEFT;
  if (b === a + 1 && b % size !== 0) return RIGHT;
  return 0;
}

const OPP: Record<number, number> = { [UP]: DOWN, [DOWN]: UP, [LEFT]: RIGHT, [RIGHT]: LEFT };
const DIRS = [UP, RIGHT, DOWN, LEFT];

/** Neighbours of every cell, honouring walls. */
export function buildAdjacency(size: number, walls: readonly number[]): number[][] {
  const adj: number[][] = [];
  for (let cell = 0; cell < size * size; cell++) {
    const list: number[] = [];
    for (const d of DIRS) {
      if (walls[cell] & d) continue;
      const n = step(size, cell, d);
      if (n >= 0) list.push(n);
    }
    adj.push(list);
  }
  return adj;
}

/** Random Hamiltonian path: serpentine start + many backbite moves. */
export function randomHamiltonianPath(size: number, rng: Rng): number[] {
  const total = size * size;
  const path: number[] = [];
  const vertical = rng.chance(0.5);
  for (let i = 0; i < size; i++) {
    for (let j = 0; j < size; j++) {
      const jj = i % 2 ? size - 1 - j : j;
      path.push(vertical ? jj * size + i : i * size + jj);
    }
  }
  const pos = new Int32Array(total);
  path.forEach((cell, i) => (pos[cell] = i));
  const reverse = (a: number, b: number) => {
    while (a < b) {
      const t = path[a];
      path[a] = path[b];
      path[b] = t;
      pos[path[a]] = a;
      pos[path[b]] = b;
      a++;
      b--;
    }
  };
  const iterations = total * 60;
  const nb: number[] = [];
  for (let it = 0; it < iterations; it++) {
    const atHead = rng.next() < 0.5;
    const end = atHead ? path[0] : path[total - 1];
    nb.length = 0;
    for (const d of DIRS) {
      const n = step(size, end, d);
      if (n >= 0) nb.push(n);
    }
    const v = nb[Math.floor(rng.next() * nb.length)];
    const i = pos[v];
    if (atHead) {
      if (i === 1) continue;
      reverse(0, i - 1);
    } else {
      if (i === total - 2) continue;
      reverse(i + 1, total - 1);
    }
  }
  return path;
}

export interface SolveResult {
  /** Solutions found (up to the limit). */
  solutions: number[][];
  /** True if the search space was fully explored (the count is exact up to the limit). */
  complete: boolean;
  nodes: number;
}

/**
 * Enumerates Zip solutions with pruning (connectivity, dead ends, number order).
 * Stops after `limit` solutions or `budget` search nodes.
 */
export function solveZip(size: number, numbers: readonly number[], walls: readonly number[], limit = 2, budget = 400000): SolveResult {
  const total = size * size;
  const adj = buildAdjacency(size, walls);
  let count = 0;
  let startCell = -1;
  let endCell = -1;
  numbers.forEach((n) => (count = Math.max(count, n)));
  numbers.forEach((n, cell) => {
    if (n === 1) startCell = cell;
    if (n === count) endCell = cell;
  });
  const numCell = new Int32Array(count + 1);
  numbers.forEach((n, cell) => n && (numCell[n] = cell));
  const visited = new Uint8Array(total);
  const path = new Int32Array(total);
  const solutions: number[][] = [];
  const queue = new Int32Array(total);
  const seen = new Uint8Array(total);
  let nodes = 0;
  let aborted = false;

  const feasible = (head: number, len: number, next: number): boolean => {
    // Dead-end check: every unvisited cell needs two usable neighbours (one for the end cell).
    for (let v = 0; v < total; v++) {
      if (visited[v]) continue;
      let deg = 0;
      const a = adj[v];
      for (let k = 0; k < a.length; k++) {
        const u = a[k];
        if (!visited[u] || u === head) deg++;
      }
      if (deg < (v === endCell ? 1 : 2)) return false;
    }
    // Connectivity of unvisited cells (through the head).
    seen.fill(0);
    let qh = 0;
    let qt = 0;
    queue[qt++] = head;
    seen[head] = 1;
    let reached = 0;
    while (qh < qt) {
      const x = queue[qh++];
      const a = adj[x];
      for (let k = 0; k < a.length; k++) {
        const u = a[k];
        if (!seen[u] && !visited[u]) {
          seen[u] = 1;
          reached++;
          queue[qt++] = u;
        }
      }
    }
    if (reached !== total - len) return false;
    // The next number must be reachable without passing through other numbers.
    if (next <= count) {
      const target = numCell[next];
      seen.fill(0);
      qh = 0;
      qt = 0;
      queue[qt++] = head;
      seen[head] = 1;
      let ok = false;
      while (qh < qt && !ok) {
        const x = queue[qh++];
        const a = adj[x];
        for (let k = 0; k < a.length; k++) {
          const u = a[k];
          if (seen[u] || visited[u]) continue;
          if (u === target) {
            ok = true;
            break;
          }
          if (numbers[u]) continue;
          seen[u] = 1;
          queue[qt++] = u;
        }
      }
      if (!ok) return false;
    }
    return true;
  };

  const dfs = (head: number, len: number, next: number): void => {
    if (aborted || solutions.length >= limit) return;
    if (++nodes > budget) {
      aborted = true;
      return;
    }
    if (len === total) {
      if (head === endCell) solutions.push(Array.from(path));
      return;
    }
    if (head === endCell) return;
    if (!feasible(head, len, next)) return;
    // Warnsdorff ordering: try the most constrained neighbour first.
    const a = adj[head];
    const cand: number[] = [];
    const score: number[] = [];
    for (let k = 0; k < a.length; k++) {
      const v = a[k];
      if (visited[v]) continue;
      const n = numbers[v];
      if (n && n !== next) continue;
      let deg = 0;
      const b = adj[v];
      for (let j = 0; j < b.length; j++) if (!visited[b[j]]) deg++;
      let at = cand.length;
      while (at > 0 && score[at - 1] > deg) at--;
      cand.splice(at, 0, v);
      score.splice(at, 0, deg);
    }
    for (let k = 0; k < cand.length; k++) {
      const v = cand[k];
      const n = numbers[v];
      visited[v] = 1;
      path[len] = v;
      dfs(v, len + 1, n ? next + 1 : next);
      visited[v] = 0;
      if (aborted || solutions.length >= limit) return;
    }
  };

  if (startCell < 0 || endCell < 0) return { solutions: [], complete: true, nodes: 0 };
  visited[startCell] = 1;
  path[0] = startCell;
  dfs(startCell, 1, 2);
  return { solutions, complete: !aborted, nodes };
}

const SIZE_CONF: Record<number, { base: [number, number]; max: number; walls: [number, number] }> = {
  5: { base: [4, 5], max: 9, walls: [1, 3] },
  6: { base: [5, 6], max: 11, walls: [1, 4] },
  7: { base: [6, 7], max: 13, walls: [2, 5] },
  8: { base: [8, 10], max: 17, walls: [2, 6] },
};

function sameArr(a: readonly number[], b: readonly number[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}

function tryBuild(size: number, rng: Rng): ZipPuzzle | null {
  const conf = SIZE_CONF[size] ?? SIZE_CONF[7];
  const total = size * size;
  const sol = randomHamiltonianPath(size, rng);
  const idx = new Int32Array(total);
  sol.forEach((c, i) => (idx[c] = i));

  // Waypoints as indices along the solution path.
  const k = rng.int(conf.base[0], conf.base[1]);
  const way = new Set<number>([0, total - 1]);
  const seg = (total - 1) / (k - 1);
  for (let i = 1; i < k - 1; i++) {
    const jitter = (rng.next() - 0.5) * seg * 0.6;
    let p = Math.round(i * seg + jitter);
    p = Math.max(1, Math.min(total - 2, p));
    while (way.has(p) && p < total - 2) p++;
    way.add(p);
  }

  // Optional walls on edges the solution does not use.
  const walls = new Array<number>(total).fill(0);
  const used = new Set<string>();
  for (let i = 0; i + 1 < total; i++) {
    const a = Math.min(sol[i], sol[i + 1]);
    const b = Math.max(sol[i], sol[i + 1]);
    used.add(`${a}-${b}`);
  }
  const freeEdges: [number, number][] = [];
  for (let cell = 0; cell < total; cell++) {
    for (const d of [RIGHT, DOWN]) {
      const n = step(size, cell, d);
      if (n >= 0 && !used.has(`${cell}-${n}`)) freeEdges.push([cell, n]);
    }
  }
  const addWall = (a: number, b: number) => {
    const d = dirBetween(size, a, b);
    walls[a] |= d;
    walls[b] |= OPP[d];
  };
  const wallStyle = rng.chance(0.55);
  if (wallStyle) {
    const nWalls = rng.int(conf.walls[0], conf.walls[1]);
    for (const [a, b] of rng.shuffle(freeEdges).slice(0, nWalls)) addWall(a, b);
  }

  const numbersFor = () => {
    const nums = new Array<number>(total).fill(0);
    [...way].sort((x, y) => x - y).forEach((p, i) => (nums[sol[p]] = i + 1));
    return nums;
  };

  for (let round = 0; round < 24; round++) {
    const numbers = numbersFor();
    const res = solveZip(size, numbers, walls, 2, 25000);
    const alt = res.solutions.find((s) => !sameArr(s, sol));
    if (res.complete && !alt) {
      if (res.solutions.length !== 1) return null;
      return {
        size,
        numbers,
        count: way.size,
        walls,
        solution: sol,
        palette: rng.pick(PALETTES),
      };
    }
    if (way.size >= conf.max) return null;
    if (!alt) {
      // Search budget blown: add a number in the middle of the longest gap.
      const sorted = [...way].sort((x, y) => x - y);
      let best = 0;
      let at = -1;
      for (let i = 0; i + 1 < sorted.length; i++) {
        const gap = sorted[i + 1] - sorted[i];
        if (gap > best) {
          best = gap;
          at = sorted[i] + Math.floor(gap / 2);
        }
      }
      if (at <= 0 || best < 2) return null;
      way.add(at);
      continue;
    }
    // Break the alternative solution.
    const altIdx = new Int32Array(total);
    alt.forEach((c, i) => (altIdx[c] = i));
    if (wallStyle && rng.chance(0.4)) {
      const altEdges: [number, number][] = [];
      for (let i = 0; i + 1 < total; i++) {
        const a = Math.min(alt[i], alt[i + 1]);
        const b = Math.max(alt[i], alt[i + 1]);
        if (!used.has(`${a}-${b}`)) altEdges.push([a, b]);
      }
      if (altEdges.length) {
        const [a, b] = rng.pick(altEdges);
        addWall(a, b);
        continue;
      }
    }
    const sorted = [...way].sort((x, y) => x - y);
    const breaking: { p: number; score: number }[] = [];
    for (let p = 1; p < total - 1; p++) {
      if (way.has(p)) continue;
      // Waypoints around p in the intended solution.
      let lo = 0;
      let hi = total - 1;
      for (const w of sorted) {
        if (w < p) lo = w;
        else {
          hi = w;
          break;
        }
      }
      const ai = altIdx[sol[p]];
      if (ai < altIdx[sol[lo]] || ai > altIdx[sol[hi]]) {
        breaking.push({ p, score: Math.min(p - lo, hi - p) });
      }
    }
    if (breaking.length) {
      breaking.sort((x, y) => y.score - x.score);
      const top = breaking.slice(0, Math.max(1, Math.ceil(breaking.length / 3)));
      way.add(rng.pick(top).p);
    } else {
      let d = 0;
      while (d < total && alt[d] === sol[d]) d++;
      way.add(d);
      way.add(idx[alt[d]]);
    }
  }
  return null;
}

/** Deterministically generates a Zip puzzle with a unique solution. */
export function generateZip(size: number, seed: number): ZipPuzzle {
  const rng = createRng(seed * 7919 + size);
  for (let attempt = 0; attempt < 60; attempt++) {
    const p = tryBuild(size, rng.fork());
    if (p) return p;
  }
  // Fallback (practically unreachable): every cell of a random path numbered.
  const sol = randomHamiltonianPath(size, rng);
  const numbers = new Array<number>(size * size).fill(0);
  sol.forEach((c, i) => (numbers[c] = i + 1));
  return { size, numbers, count: sol.length, walls: numbers.map(() => 0), solution: sol, palette: PALETTES[0] };
}
