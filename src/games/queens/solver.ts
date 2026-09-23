/**
 * Human-style logic solver for Queens. Each call to `findStep` returns the easiest next deduction with a
 * plain-language explanation; the same engine verifies that generated puzzles need no guessing and powers hints.
 *
 * Techniques, easiest first:
 *  1. single   — a row / column / region has exactly one open cell left.
 *  2. confine  — a region's open cells sit in one line (or a line's open cells sit in one region).
 *  3. block    — a queen on a cell would cross out every open cell of some other row / column / region.
 *  4. group    — k regions confined to k lines (or k lines to k regions / k columns), k >= 2.
 *  5. chain    — a queen on a cell forces a short chain of singles that leaves some unit empty.
 */
import type { StepMsg } from './i18n';
import { colOf, rowOf } from './puzzle';

export type UnitType = 'row' | 'col' | 'region';
export type Technique = 'single' | 'confine' | 'block' | 'group' | 'chain';

export interface Unit {
  type: UnitType;
  index: number;
  cells: number[];
}

export interface Step {
  kind: 'place' | 'eliminate';
  /** The queen cell (place) or the cells to cross out (eliminate). */
  targets: number[];
  /** Cells that explain the deduction (highlighted, the rest of the board is dimmed). */
  focus: number[];
  /** Structured explanation; format it with STR[lang].step(). */
  msg: StepMsg;
  technique: Technique;
}

export interface SolverState {
  /** 1 = cell could still hold a queen. */
  cand: Uint8Array;
  /** 1 = queen placed. */
  queen: Uint8Array;
}

const TYPE_ORDER: UnitType[] = ['region', 'row', 'col'];
const GROUP_PAIRS: [UnitType, UnitType][] = [
  ['region', 'row'],
  ['region', 'col'],
  ['row', 'region'],
  ['col', 'region'],
  ['row', 'col'],
  ['col', 'row'],
];
/** How many forced queens the "chain" technique may follow before giving up. */
const CHAIN_DEPTH = 3;

function popcount(x: number): number {
  let c = 0;
  while (x) {
    x &= x - 1;
    c++;
  }
  return c;
}

export class Solver {
  readonly n: number;
  readonly regions: number[];
  readonly units: Unit[];
  private readonly byType: Record<UnitType, Unit[]>;
  /** peer[a * nn + b] = 1 when a queen on a rules out b. */
  private readonly peer: Uint8Array;

  constructor(n: number, regions: number[]) {
    this.n = n;
    this.regions = regions;
    const nn = n * n;
    const byType: Record<UnitType, Unit[]> = { row: [], col: [], region: [] };
    for (let i = 0; i < n; i++) {
      byType.row.push({ type: 'row', index: i, cells: [] });
      byType.col.push({ type: 'col', index: i, cells: [] });
      byType.region.push({ type: 'region', index: i, cells: [] });
    }
    for (let c = 0; c < nn; c++) {
      byType.row[rowOf(n, c)].cells.push(c);
      byType.col[colOf(n, c)].cells.push(c);
      byType.region[regions[c]].cells.push(c);
    }
    this.byType = byType;
    this.units = [...byType.region, ...byType.row, ...byType.col];
    this.peer = new Uint8Array(nn * nn);
    for (let a = 0; a < nn; a++) {
      const ra = rowOf(n, a);
      const ca = colOf(n, a);
      for (let b = 0; b < nn; b++) {
        if (a === b) continue;
        const rb = rowOf(n, b);
        const cb = colOf(n, b);
        if (ra === rb || ca === cb || regions[a] === regions[b] || (Math.abs(ra - rb) <= 1 && Math.abs(ca - cb) <= 1)) {
          this.peer[a * nn + b] = 1;
        }
      }
    }
  }

  isPeer(a: number, b: number): boolean {
    return this.peer[a * this.n * this.n + b] === 1;
  }

  indexOf(type: UnitType, cell: number): number {
    if (type === 'row') return rowOf(this.n, cell);
    if (type === 'col') return colOf(this.n, cell);
    return this.regions[cell];
  }

  emptyState(): SolverState {
    const nn = this.n * this.n;
    return { cand: new Uint8Array(nn).fill(1), queen: new Uint8Array(nn) };
  }

  /**
   * Builds solver state from a player board (0 empty, 1 ✕, 2 queen). Cells ruled out by a placed queen
   * count as crossed out even if the player hasn't marked them.
   */
  stateFromBoard(board: ArrayLike<number>): SolverState {
    const s = this.emptyState();
    const nn = this.n * this.n;
    for (let i = 0; i < nn; i++) {
      if (board[i] === 2) s.queen[i] = 1;
      if (board[i] !== 0) s.cand[i] = 0;
    }
    for (let q = 0; q < nn; q++) {
      if (!s.queen[q]) continue;
      for (let b = 0; b < nn; b++) if (this.peer[q * nn + b]) s.cand[b] = 0;
    }
    return s;
  }

  clone(s: SolverState): SolverState {
    return { cand: s.cand.slice(), queen: s.queen.slice() };
  }

  place(s: SolverState, cell: number): void {
    const nn = this.n * this.n;
    s.queen[cell] = 1;
    s.cand[cell] = 0;
    const base = cell * nn;
    for (let b = 0; b < nn; b++) if (this.peer[base + b]) s.cand[b] = 0;
  }

  apply(s: SolverState, step: Step): void {
    if (step.kind === 'place') this.place(s, step.targets[0]);
    else for (const c of step.targets) s.cand[c] = 0;
  }

  hasQueen(s: SolverState, u: Unit): boolean {
    for (const c of u.cells) if (s.queen[c]) return true;
    return false;
  }

  cands(s: SolverState, u: Unit): number[] {
    const out: number[] = [];
    for (const c of u.cells) if (s.cand[c]) out.push(c);
    return out;
  }

  queenCount(s: SolverState): number {
    let k = 0;
    for (let i = 0; i < s.queen.length; i++) k += s.queen[i];
    return k;
  }

  isSolved(s: SolverState): boolean {
    return this.queenCount(s) === this.n;
  }

  /** An open unit (no queen) with no candidates left, if any. */
  deadUnit(s: SolverState): Unit | null {
    for (const u of this.units) {
      if (this.hasQueen(s, u)) continue;
      let any = false;
      for (const c of u.cells) {
        if (s.cand[c]) {
          any = true;
          break;
        }
      }
      if (!any) return u;
    }
    return null;
  }

  findStep(s: SolverState, maxTechnique: Technique = 'chain'): Step | null {
    const order: Technique[] = ['single', 'confine', 'block', 'group', 'chain'];
    const limit = order.indexOf(maxTechnique);
    return (
      this.findSingle(s) ??
      (limit >= 1 ? this.findGroup(s, 1) : null) ??
      (limit >= 2 ? this.findBlock(s) : null) ??
      (limit >= 3 ? this.findGroups(s) : null) ??
      (limit >= 4 ? this.findChain(s) : null)
    );
  }

  private findSingle(s: SolverState): Step | null {
    for (const t of TYPE_ORDER) {
      for (const u of this.byType[t]) {
        if (this.hasQueen(s, u)) continue;
        const cs = this.cands(s, u);
        if (cs.length !== 1) continue;
        return {
          kind: 'place',
          targets: cs,
          focus: u.cells,
          technique: 'single',
          msg: { key: 'single', unit: u.type, index: u.index },
        };
      }
    }
    return null;
  }

  private findGroups(s: SolverState): Step | null {
    const maxK = Math.floor(this.n / 2);
    for (let k = 2; k <= maxK; k++) {
      const step = this.findGroup(s, k);
      if (step) return step;
    }
    return null;
  }

  /** k units of type A whose open cells lie within k units of type B. */
  private findGroup(s: SolverState, k: number): Step | null {
    for (const [ta, tb] of GROUP_PAIRS) {
      if (k === 1 && ta !== 'region' && tb !== 'region') continue; // row→col with one line is just a single
      const open: { u: Unit; mask: number; cells: number[] }[] = [];
      for (const u of this.byType[ta]) {
        if (this.hasQueen(s, u)) continue;
        const cs = this.cands(s, u);
        if (cs.length === 0) continue;
        let mask = 0;
        for (const c of cs) mask |= 1 << this.indexOf(tb, c);
        if (popcount(mask) <= k) open.push({ u, mask, cells: cs });
      }
      if (open.length < k) continue;
      const pick: number[] = [];
      let found: Step | null = null;
      const rec = (start: number, union: number): boolean => {
        if (pick.length === k) {
          if (popcount(union) !== k) return false;
          const chosen = new Set(pick.map((p) => open[p].u.index));
          const elim: number[] = [];
          for (let bi = 0; bi < this.n; bi++) {
            if (!(union & (1 << bi))) continue;
            for (const c of this.byType[tb][bi].cells) {
              if (s.cand[c] && !chosen.has(this.indexOf(ta, c))) elim.push(c);
            }
          }
          if (elim.length === 0) return false;
          const aIdx = pick.map((p) => open[p].u.index).sort((x, y) => x - y);
          const bIdx: number[] = [];
          for (let bi = 0; bi < this.n; bi++) if (union & (1 << bi)) bIdx.push(bi);
          found = this.groupStep(ta, tb, aIdx, bIdx, elim, k);
          return true;
        }
        for (let i = start; i < open.length; i++) {
          const nu = union | open[i].mask;
          if (popcount(nu) > k) continue;
          pick.push(i);
          if (rec(i + 1, nu)) return true;
          pick.pop();
        }
        return false;
      };
      rec(0, 0);
      if (found) return found;
    }
    return null;
  }

  private groupStep(ta: UnitType, tb: UnitType, aIdx: number[], bIdx: number[], elim: number[], k: number): Step {
    const focusSet = new Set<number>();
    for (const i of aIdx) for (const c of this.byType[ta][i].cells) focusSet.add(c);
    for (const i of bIdx) for (const c of this.byType[tb][i].cells) focusSet.add(c);
    const key = ta === 'region' ? 'regionToLines' : tb === 'region' ? 'linesToRegions' : 'linesToLines';
    const msg: StepMsg = { key, a: ta, aIdx, b: tb, bIdx };
    return { kind: 'eliminate', targets: elim, focus: [...focusSet], technique: k === 1 ? 'confine' : 'group', msg };
  }

  /** Cells whose queen would wipe out every open cell of another unit. */
  private findBlock(s: SolverState): Step | null {
    const nn = this.n * this.n;
    const openUnits: { u: Unit; cs: number[] }[] = [];
    for (const u of this.units) {
      if (this.hasQueen(s, u)) continue;
      const cs = this.cands(s, u);
      if (cs.length > 0) openUnits.push({ u, cs });
    }
    openUnits.sort((a, b) => a.cs.length - b.cs.length);
    for (const { u, cs } of openUnits) {
      const inUnit = new Set(u.cells);
      const blockers: number[] = [];
      for (let c = 0; c < nn; c++) {
        if (!s.cand[c] || inUnit.has(c)) continue;
        const base = c * nn;
        let all = true;
        for (const l of cs) {
          if (!this.peer[base + l]) {
            all = false;
            break;
          }
        }
        if (all) blockers.push(c);
      }
      if (blockers.length === 0) continue;
      return {
        kind: 'eliminate',
        targets: blockers,
        focus: u.cells,
        technique: 'block',
        msg: { key: 'block', unit: u.type, index: u.index, count: blockers.length },
      };
    }
    return null;
  }

  /** Shallow "what if": a queen here forces a few singles and then some unit has no room left. */
  private findChain(s: SolverState): Step | null {
    const nn = this.n * this.n;
    // Try cells in tight spots first so the explanation stays short.
    const tight = new Array<number>(nn).fill(Infinity);
    for (const u of this.units) {
      if (this.hasQueen(s, u)) continue;
      const cs = this.cands(s, u);
      for (const c of cs) tight[c] = Math.min(tight[c], cs.length);
    }
    const order: number[] = [];
    for (let c = 0; c < nn; c++) if (s.cand[c]) order.push(c);
    order.sort((a, b) => tight[a] - tight[b] || a - b);

    let best: { cell: number; forced: number[]; dead: Unit } | null = null;
    for (const c of order) {
      const t = this.clone(s);
      this.place(t, c);
      const forced: number[] = [];
      let dead = this.deadUnit(t);
      while (!dead && forced.length < CHAIN_DEPTH) {
        const single = this.findSingle(t);
        if (!single) break;
        forced.push(single.targets[0]);
        this.place(t, single.targets[0]);
        dead = this.deadUnit(t);
      }
      if (dead && (!best || forced.length < best.forced.length)) {
        best = { cell: c, forced, dead };
        if (forced.length <= 1) break;
      }
    }
    if (!best) return null;
    const focus = new Set<number>([...best.dead.cells, ...best.forced]);
    return {
      kind: 'eliminate',
      targets: [best.cell],
      focus: [...focus],
      technique: 'chain',
      msg: { key: 'chain', unit: best.dead.type, index: best.dead.index, forced: best.forced.length },
    };
  }

  /** Runs the logic solver from an empty board. */
  solve(maxTechnique: Technique = 'chain'): { solved: boolean; steps: number; counts: Record<Technique, number>; state: SolverState } {
    const s = this.emptyState();
    const counts: Record<Technique, number> = { single: 0, confine: 0, block: 0, group: 0, chain: 0 };
    let steps = 0;
    while (!this.isSolved(s)) {
      if (this.deadUnit(s)) break;
      const step = this.findStep(s, maxTechnique);
      if (!step) break;
      counts[step.technique]++;
      steps++;
      this.apply(s, step);
    }
    return { solved: this.isSolved(s), steps, counts, state: s };
  }
}
