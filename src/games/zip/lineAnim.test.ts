import { describe, expect, it } from 'vitest';
import { EMPTY_LINE, advanceLine, lineFor, lineGeometry, routeDistance, sameLine, stepLine, tipTarget, type LineState } from './lineAnim';

const settle = (d: LineState, t: LineState, dt = 16) => {
  const frames: LineState[] = [];
  let cur = d;
  for (let i = 0; i < 200 && !sameLine(cur, t); i++) {
    cur = stepLine(cur, t, dt);
    frames.push(cur);
  }
  return frames;
};

describe('zip line animation', () => {
  it('measures the route through the common prefix', () => {
    expect(routeDistance(lineFor([0, 1, 2]), lineFor([0, 1, 2, 3]))).toBe(1);
    expect(routeDistance(lineFor([0, 1, 2]), lineFor([0, 1, 6]))).toBe(2); // retract 1, grow 1
    expect(routeDistance(lineFor([0, 1, 2]), EMPTY_LINE)).toBe(2);
    expect(routeDistance(EMPTY_LINE, lineFor([0]))).toBe(0);
    expect(routeDistance({ cells: [0, 1, 2], pos: 1.5 }, lineFor([0, 1, 2]))).toBeCloseTo(0.5);
  });

  it('retracts to the branch point before growing along new cells', () => {
    const d = lineFor([0, 1, 2]);
    const t = lineFor([0, 1, 6, 7]);
    const mid = advanceLine(d, t, 0.5);
    expect(mid.cells).toEqual([0, 1, 2]);
    expect(mid.pos).toBeCloseTo(1.5);
    const after = advanceLine(d, t, 1.5);
    expect(after.cells).toEqual([0, 1, 6, 7]);
    expect(after.pos).toBeCloseTo(1.5);
    expect(advanceLine(d, t, 10)).toEqual(t);
  });

  it('grows one cell with a partial segment in ~70–100 ms and caps big jumps', () => {
    const frames = settle(lineFor([0, 1]), lineFor([0, 1, 2]));
    expect(frames.length * 16).toBeGreaterThanOrEqual(64);
    expect(frames.length * 16).toBeLessThanOrEqual(130);
    const first = frames[0];
    expect(first.pos).toBeGreaterThan(1);
    expect(first.pos).toBeLessThan(2);
    // Monotonic (ease-out, no overshoot).
    for (let i = 1; i < frames.length; i++) expect(frames[i].pos).toBeGreaterThanOrEqual(frames[i - 1].pos);
    const long = Array.from({ length: 64 }, (_, i) => i);
    expect(settle(lineFor([0]), lineFor(long)).length * 16).toBeLessThanOrEqual(200);
    expect(settle(lineFor(long), EMPTY_LINE).length * 16).toBeLessThanOrEqual(200);
  });

  it('builds partial geometry and tints cells once the line crosses into them', () => {
    const g = lineGeometry({ cells: [0, 1, 2], pos: 1.25 }, 5, 100);
    expect(g.segments).toHaveLength(2);
    expect(g.segments[1]).toMatchObject({ index: 1, x1: 150, x2: 175, frac: 0.25 });
    expect(g.head).toEqual([175, 50]);
    expect(g.reached).toBe(2);
    expect(lineGeometry({ cells: [0, 1, 2], pos: 1.6 }, 5, 100).reached).toBe(3);
    expect(lineGeometry(EMPTY_LINE, 5, 100).segments).toHaveLength(0);
  });

  it('draws a live tip only toward legal neighbours', () => {
    const size = 5;
    const nb = (c: number, dx: number, dy: number) => {
      const r = Math.floor(c / size) + dy;
      const col = (c % size) + dx;
      return r < 0 || col < 0 || r >= size || col >= size ? -1 : r * size + col;
    };
    const path = [0, 1];
    // Pointer 0.3 to the right of cell 1's centre; cell 2 legal.
    const t = tipTarget(path, size, 1.8, 0.5, nb, () => true);
    expect(t.line.cells).toEqual([0, 1, 2]);
    expect(t.line.pos).toBeCloseTo(1.3);
    // Clamped at the cell edge.
    expect(tipTarget(path, size, 3.5, 0.6, nb, () => true).line.pos).toBeCloseTo(1.5);
    // Illegal (wall / used / wrong number): no tip.
    expect(tipTarget(path, size, 1.8, 0.5, nb, () => false).line).toEqual(lineFor(path));
    // Off the board: no tip.
    expect(tipTarget([0], size, 0.5, 0.1, nb, () => true).line).toEqual(lineFor([0]));
    // Heading back: the last segment shrinks.
    const back = tipTarget(path, size, 1.2, 0.5, nb, () => true);
    expect(back.line.cells).toEqual(path);
    expect(back.line.pos).toBeCloseTo(0.7);
  });
});
