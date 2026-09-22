/** Core Queens data model + fast helpers shared by the generator, solver and UI. */

export interface Puzzle {
  size: number;
  /** Region id (0..size-1) for each cell, row-major. Region id doubles as palette index. */
  regions: number[];
  /** solution[row] = column of that row's queen. */
  solution: number[];
}

/** Palette order matches the region ids (and the CSS classes r0..r9). */
export const REGION_NAMES = ['purple', 'orange', 'blue', 'green', 'gray', 'red', 'yellow', 'tan', 'pink', 'teal'];

export const rowOf = (n: number, i: number) => Math.floor(i / n);
export const colOf = (n: number, i: number) => i % n;

/** True when two distinct cells touch (including diagonally). */
export function touching(n: number, a: number, b: number): boolean {
  if (a === b) return false;
  return Math.abs(rowOf(n, a) - rowOf(n, b)) <= 1 && Math.abs(colOf(n, a) - colOf(n, b)) <= 1;
}

/** Cells that can't hold a queen if `a` holds one: same row, column, region, or touching. */
export function attacks(n: number, regions: ArrayLike<number>, a: number, b: number): boolean {
  if (a === b) return false;
  return rowOf(n, a) === rowOf(n, b) || colOf(n, a) === colOf(n, b) || regions[a] === regions[b] || touching(n, a, b);
}

/**
 * Enumerates solutions with a row-by-row bitmask search. Stops after `limit` solutions.
 * Returns the solutions found (as column-per-row arrays).
 */
export function findSolutions(n: number, regions: ArrayLike<number>, limit = 2): number[][] {
  const out: number[][] = [];
  const cols = new Array<number>(n);
  // Region mask per row: which regions appear in rows >= r (for pruning).
  const regionsFrom = new Array<number>(n + 1).fill(0);
  for (let r = n - 1; r >= 0; r--) {
    let m = regionsFrom[r + 1];
    for (let c = 0; c < n; c++) m |= 1 << regions[r * n + c];
    regionsFrom[r] = m;
  }
  const full = (1 << n) - 1;
  const dfs = (r: number, usedCols: number, usedRegions: number, prev: number): boolean => {
    if (r === n) {
      out.push(cols.slice());
      return out.length >= limit;
    }
    // Every unused region must still appear somewhere in the remaining rows.
    if ((regionsFrom[r] | usedRegions) !== full) return false;
    for (let c = 0; c < n; c++) {
      if (usedCols & (1 << c)) continue;
      if (prev >= 0 && Math.abs(c - prev) <= 1) continue;
      const reg = regions[r * n + c];
      if (usedRegions & (1 << reg)) continue;
      cols[r] = c;
      if (dfs(r + 1, usedCols | (1 << c), usedRegions | (1 << reg), c)) return true;
    }
    return false;
  };
  dfs(0, 0, 0, -1);
  return out;
}

export function isValidSolution(n: number, regions: ArrayLike<number>, cols: number[]): boolean {
  if (cols.length !== n) return false;
  const usedC = new Set<number>();
  const usedR = new Set<number>();
  for (let r = 0; r < n; r++) {
    const c = cols[r];
    if (c < 0 || c >= n || usedC.has(c)) return false;
    usedC.add(c);
    const reg = regions[r * n + c];
    if (usedR.has(reg)) return false;
    usedR.add(reg);
    if (r > 0 && Math.abs(cols[r - 1] - c) <= 1) return false;
  }
  return true;
}

export interface Clashes {
  /** Queens that break a rule. */
  queens: Set<number>;
  /** Cells to stripe: the offending row / column / region, or the touching pair. */
  cells: Set<number>;
}

/** Finds rule violations among the placed queens. */
export function findClashes(n: number, regions: ArrayLike<number>, queens: number[]): Clashes {
  const qs = new Set<number>();
  const cells = new Set<number>();
  const group = (key: (i: number) => number, members: (k: number) => number[]) => {
    const by = new Map<number, number[]>();
    for (const q of queens) {
      const k = key(q);
      const list = by.get(k);
      if (list) list.push(q);
      else by.set(k, [q]);
    }
    for (const [k, list] of by) {
      if (list.length < 2) continue;
      for (const q of list) qs.add(q);
      for (const c of members(k)) cells.add(c);
    }
  };
  const all = Array.from({ length: n * n }, (_, i) => i);
  group(
    (i) => rowOf(n, i),
    (r) => all.filter((i) => rowOf(n, i) === r),
  );
  group(
    (i) => colOf(n, i),
    (c) => all.filter((i) => colOf(n, i) === c),
  );
  group(
    (i) => regions[i],
    (g) => all.filter((i) => regions[i] === g),
  );
  for (let a = 0; a < queens.length; a++) {
    for (let b = a + 1; b < queens.length; b++) {
      if (touching(n, queens[a], queens[b])) {
        qs.add(queens[a]);
        qs.add(queens[b]);
        cells.add(queens[a]);
        cells.add(queens[b]);
      }
    }
  }
  return { queens: qs, cells };
}
