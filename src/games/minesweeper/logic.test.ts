import { describe, expect, it } from 'vitest';
import { createRng } from '../../lib/rng';
import { boardFrom, deduce, generateBoard, hintFor, HIDDEN, LEVELS, MINE, neighbourTable, OPEN, openFrom, solvable, type Level } from './logic';

const LVLS: Level[] = ['easy', 'medium', 'hard'];

describe('minesweeper generator', () => {
  it('is deterministic for a seed and first square', () => {
    const a = generateBoard(99, 'medium', 40);
    expect(generateBoard(99, 'medium', 40).mines).toEqual(a.mines);
    expect(generateBoard(100, 'medium', 40).mines).not.toEqual(a.mines);
  });

  for (const lv of LVLS) {
    it(`${lv}: right size and mine count, safe opening, no guessing, fast`, () => {
      const { w, h, mines } = LEVELS[lv];
      const rng = createRng(7);
      const times: number[] = [];
      for (let k = 0; k < 25; k++) {
        const start = rng.int(0, w * h - 1);
        const t0 = performance.now();
        const b = generateBoard(rng.int(1, 1e9), lv, start);
        times.push(performance.now() - t0);
        expect(b.w * b.h).toBe(w * h);
        expect(b.mineCount).toBe(mines);
        expect(b.mines.reduce((n, v) => n + v, 0)).toBe(mines);
        expect(b.counts[start]).toBe(0);
        expect(b.mines[start]).toBe(0);
        expect(solvable(b)).toBe(true);
      }
      times.sort((a, b) => a - b);
      expect(times[Math.floor(times.length / 2)]).toBeLessThan(150);
    });
  }
});

describe('minesweeper solver', () => {
  it('never deduces anything false', () => {
    const { w, h, mines } = LEVELS.medium;
    const nb = neighbourTable(w, h);
    const rng = createRng(3);
    for (let k = 0; k < 60; k++) {
      const start = rng.int(0, w * h - 1);
      const banned = new Set([start, ...nb[start]]);
      const pool = [...Array(w * h).keys()].filter((i) => !banned.has(i));
      const m = new Uint8Array(w * h);
      for (const i of rng.shuffle(pool).slice(0, mines)) m[i] = 1;
      const b = boardFrom(w, h, m, start, nb);
      const know = new Uint8Array(w * h);
      openFrom(b, know, start);
      for (;;) {
        const ds = deduce(b, know);
        if (!ds.length) break;
        for (const d of ds) {
          for (const x of d.cells) {
            expect(!!b.mines[x]).toBe(d.mine);
            if (know[x] !== HIDDEN) continue;
            if (d.mine) know[x] = MINE;
            else openFrom(b, know, x);
          }
        }
      }
    }
  });

  it('solves the classic 1-2-1 pattern', () => {
    // Row 0 hidden, row 1 open "1 2 1" with walls of known-safe squares around it.
    const w = 3;
    const h = 2;
    const mines = Uint8Array.from([1, 0, 1, 0, 0, 0]);
    const b = boardFrom(w, h, mines, 4);
    const know = Uint8Array.from([HIDDEN, HIDDEN, HIDDEN, OPEN, OPEN, OPEN]);
    const found = new Map<number, boolean>();
    for (let pass = 0; pass < 3; pass++) {
      for (const d of deduce(b, know)) {
        for (const x of d.cells) {
          found.set(x, d.mine);
          know[x] = d.mine ? MINE : OPEN;
        }
      }
    }
    expect(found.get(0)).toBe(true);
    expect(found.get(1)).toBe(false);
    expect(found.get(2)).toBe(true);
  });
});

describe('minesweeper hints', () => {
  it('flags wrong flags first, then gives true deductions until the board is clear', () => {
    const b = generateBoard(12345, 'medium', 100);
    const st = new Uint8Array(b.w * b.h);
    openFrom(b, st, b.start);
    const wrong = st.findIndex((v, i) => v === HIDDEN && !b.mines[i]);
    st[wrong] = MINE;
    expect(hintFor(b, st)).toEqual({ kind: 'wrongFlag', cell: wrong });
    st[wrong] = HIDDEN;
    for (let guard = 0; guard < 1000; guard++) {
      const hnt = hintFor(b, st);
      if (!hnt) break;
      expect(hnt.kind).toBe('deduce');
      if (hnt.kind !== 'deduce') break;
      expect(!!b.mines[hnt.cell]).toBe(hnt.d.mine);
      if (hnt.d.mine) st[hnt.cell] = MINE;
      else openFrom(b, st, hnt.cell);
    }
    for (let i = 0; i < st.length; i++) expect(st[i]).toBe(b.mines[i] ? MINE : OPEN);
  });
});
