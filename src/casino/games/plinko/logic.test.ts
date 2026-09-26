import { describe, expect, it } from 'vitest';
import {
  ballTrack,
  bucketChance,
  bucketLabel,
  bucketOf,
  bucketX,
  choose,
  clampBalls,
  clampRows,
  dropBall,
  dropPath,
  expectedReturn,
  geometry,
  isRisk,
  MAX_ROWS,
  MIN_ROWS,
  multiplierFor,
  multText,
  payoutFor,
  pegCount,
  pegOffset,
  pegsInRow,
  pegX,
  positionAt,
  releaseGap,
  RISKS,
  ROW_CHOICES,
  table,
  TABLES,
  trackTime,
} from './logic';

/** A small seeded generator so runs are repeatable. */
function seeded(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

const always = (v: number) => () => v;

describe('payout tables', () => {
  it('has a table for every row count and risk', () => {
    expect(Object.keys(TABLES).map(Number)).toEqual([...ROW_CHOICES]);
    for (const n of ROW_CHOICES) for (const r of RISKS) expect(TABLES[n][r]).toBeDefined();
  });

  for (const n of ROW_CHOICES) {
    for (const risk of RISKS) {
      it(`${n} rows · ${risk}: n + 1 symmetric buckets returning 97.5–100%`, () => {
        const m = table(n, risk);
        expect(m).toHaveLength(n + 1);
        for (let k = 0; k <= n; k++) {
          expect(m[k]).toBe(m[n - k]);
          expect(m[k]).toBeGreaterThan(0);
        }
        // Edges pay the most, the middle the least.
        expect(m[0]).toBe(Math.max(...m));
        expect(m[Math.floor(n / 2)]).toBe(Math.min(...m));
        const rtp = m.reduce((s, v, k) => s + (choose(n, k) / 2 ** n) * v, 0);
        expect(rtp).toBeGreaterThanOrEqual(0.975);
        expect(rtp).toBeLessThanOrEqual(1);
        expect(expectedReturn(n, risk)).toBeCloseTo(rtp, 12);
      });
    }
  }

  it('higher risk pays more at the edges and less in the middle', () => {
    for (const n of ROW_CHOICES) {
      const mid = Math.floor(n / 2);
      expect(table(n, 'high')[0]).toBeGreaterThan(table(n, 'medium')[0]);
      expect(table(n, 'medium')[0]).toBeGreaterThan(table(n, 'low')[0]);
      expect(table(n, 'high')[mid]).toBeLessThanOrEqual(table(n, 'low')[mid]);
    }
  });

  it('bucket chances are the binomial and add up to 1', () => {
    expect(choose(16, 8)).toBe(12870);
    expect(choose(8, 0)).toBe(1);
    expect(choose(8, 9)).toBe(0);
    for (const n of ROW_CHOICES) {
      let sum = 0;
      for (let k = 0; k <= n; k++) sum += bucketChance(n, k);
      expect(sum).toBeCloseTo(1, 12);
    }
    expect(bucketChance(16, 0)).toBe(1 / 65536);
  });
});

describe('ball path', () => {
  it('always left lands in bucket 0, always right in bucket n', () => {
    for (const n of ROW_CHOICES) {
      const left = dropPath(n, always(0));
      expect(left).toHaveLength(n);
      expect(bucketOf(left)).toBe(0);
      const right = dropPath(n, always(0.999));
      expect(bucketOf(right)).toBe(n);
    }
  });

  it('50/50 at each peg: 0.5 goes right, just under goes left', () => {
    expect(dropPath(8, always(0.5)).every(Boolean)).toBe(true);
    expect(dropPath(8, always(0.4999)).some(Boolean)).toBe(false);
  });

  it('counts rights for mixed paths', () => {
    expect(bucketOf([true, false, true, true, false, false, false, true])).toBe(4);
    const seq = [0.1, 0.9, 0.2, 0.8, 0.3, 0.7, 0.4, 0.6];
    let i = 0;
    const b = dropBall(8, 'high', 100, () => seq[i++]);
    expect(b.bucket).toBe(4);
    expect(b.mult).toBe(0.2);
    expect(b.payout).toBe(20);
  });

  it('bucket frequencies follow the binomial over many seeded drops', () => {
    const rng = seeded(20240926);
    for (const n of [8, 12, 16]) {
      const drops = 60000;
      const counts = Array(n + 1).fill(0);
      for (let i = 0; i < drops; i++) counts[bucketOf(dropPath(n, rng))]++;
      let chi = 0;
      for (let k = 0; k <= n; k++) {
        const expected = drops * bucketChance(n, k);
        // Common buckets land within 5% of the expected count.
        if (expected > 2000) expect(Math.abs(counts[k] - expected) / expected).toBeLessThan(0.05);
        if (expected >= 5) chi += (counts[k] - expected) ** 2 / expected;
      }
      // Loose chi-square check (df ≤ 16: the 99.9th percentile is ~39).
      expect(chi).toBeLessThan(40);
    }
  });

  it('the average payout over many drops is close to the table return', () => {
    const rng = seeded(7);
    let paid = 0;
    const drops = 200000;
    for (let i = 0; i < drops; i++) paid += dropBall(12, 'medium', 1, rng).mult;
    expect(paid / drops).toBeGreaterThan(0.96);
    expect(paid / drops).toBeLessThan(1.02);
  });
});

describe('payouts', () => {
  it('is bet × multiplier, rounded down to the cent', () => {
    expect(payoutFor(100, 0.2)).toBe(20);
    expect(payoutFor(100, 1000)).toBe(100000);
    expect(payoutFor(10, 0.3)).toBe(3);
    expect(payoutFor(1.99, 0.5)).toBe(0.99); // 0.995 → 0.99
    expect(payoutFor(3.33, 5.6)).toBe(18.64); // 18.648 → 18.64
    expect(payoutFor(0.07, 0.7)).toBe(0.04); // 0.049 → 0.04
    expect(payoutFor(1_000_000, 1000)).toBe(1_000_000_000);
    expect(payoutFor(12.34, 8.1)).toBe(99.95); // 99.954 → 99.95
  });

  it('never pays more than the exact product, and never a cent less', () => {
    const rng = seeded(99);
    for (let i = 0; i < 3000; i++) {
      const bet = Math.round((1 + rng() * 5000) * 100) / 100;
      const n = MIN_ROWS + Math.floor(rng() * 9);
      const risk = RISKS[Math.floor(rng() * 3)];
      const m = multiplierFor(n, risk, Math.floor(rng() * (n + 1)));
      const p = payoutFor(bet, m);
      expect(p).toBeLessThanOrEqual(bet * m + 1e-6);
      expect(bet * m - p).toBeLessThan(0.01 + 1e-6);
      expect(Math.round(p * 100)).toBeCloseTo(p * 100, 6);
    }
  });

  it('each ball settles for its own bet × bucket multiplier', () => {
    // Five balls on 8 rows, medium: buckets 0, 8, 4, 3, 5.
    const plans = [
      [0, 0, 0, 0, 0, 0, 0, 0],
      [1, 1, 1, 1, 1, 1, 1, 1],
      [1, 0, 1, 0, 1, 0, 1, 0],
      [1, 1, 1, 0, 0, 0, 0, 0],
      [1, 1, 1, 1, 1, 0, 0, 0],
    ].map((p) => p.map((b) => (b ? 0.75 : 0.25)));
    const settles = plans.map((p) => {
      let i = 0;
      return dropBall(8, 'medium', 25, () => p[i++]);
    });
    expect(settles.map((b) => b.bucket)).toEqual([0, 8, 4, 3, 5]);
    expect(settles.map((b) => b.mult)).toEqual([13, 13, 0.4, 0.7, 0.7]);
    expect(settles.map((b) => b.payout)).toEqual([325, 325, 10, 17.5, 17.5]);
    const total = settles.reduce((s, b) => s + b.payout, 0);
    expect(total).toBe(695);
  });
});

describe('settings', () => {
  it('clamps rows and balls, and checks risk', () => {
    expect(clampRows(3)).toBe(MIN_ROWS);
    expect(clampRows(40)).toBe(MAX_ROWS);
    expect(clampRows(11.6)).toBe(12);
    expect(clampRows('x')).toBe(16);
    expect(clampBalls(0)).toBe(1);
    expect(clampBalls(250)).toBe(100);
    expect(clampBalls(null)).toBe(1);
    expect(isRisk('high')).toBe(true);
    expect(isRisk('extreme')).toBe(false);
  });

  it('releases big batches faster, within 120–200 ms', () => {
    expect(releaseGap(1)).toBe(200);
    expect(releaseGap(100)).toBe(120);
    for (let n = 1; n <= 100; n++) {
      expect(releaseGap(n)).toBeGreaterThanOrEqual(120);
      expect(releaseGap(n)).toBeLessThanOrEqual(200);
      if (n > 1) expect(releaseGap(n)).toBeLessThanOrEqual(releaseGap(n - 1));
    }
  });

  it('labels multipliers compactly', () => {
    expect(bucketLabel(1000, 'en')).toBe('1K');
    expect(bucketLabel(130, 'en')).toBe('130');
    expect(bucketLabel(0.2, 'en')).toBe('0.2');
    expect(bucketLabel(5.6, 'en')).toBe('5.6');
    expect(multText(0.5, 'en')).toBe('×0.5');
    expect(multText(1000, 'en')).toBe('×1,000');
    expect(multText(13, 'es')).toBe('×13');
  });
});

describe('board and animation', () => {
  it('lays out 3 pegs on top and one more per row', () => {
    expect(pegsInRow(0)).toBe(3);
    expect(pegOffset(0)).toBe(0);
    expect(pegOffset(1)).toBe(3);
    expect(pegOffset(2)).toBe(7);
    expect(pegCount(16)).toBe(Array.from({ length: 16 }, (_, r) => r + 3).reduce((a, b) => a + b));
    const g = geometry(16);
    // Buckets sit between neighbouring bottom-row pegs.
    for (let k = 0; k <= 16; k++) {
      expect(bucketX(g, k)).toBeCloseTo((pegX(g, 15, k) + pegX(g, 15, k + 1)) / 2, 9);
    }
  });

  it('the animated route ends over the decided bucket and hits one peg per row', () => {
    const rng = seeded(3);
    for (const n of ROW_CHOICES) {
      const g = geometry(n);
      for (let i = 0; i < 40; i++) {
        const path = dropPath(n, rng);
        const tr = ballTrack(g, path, 100, { jitter: rng });
        expect(tr.bucket).toBe(bucketOf(path));
        const end = positionAt(tr, trackTime(tr) + 50);
        expect(Math.abs(end.x - bucketX(g, tr.bucket))).toBeLessThan(g.gap * 0.2);
        expect(end.y).toBeGreaterThan(g.bucketTop);
        // One peg per row, in order, the next one down-left or down-right of the last.
        const pegs = tr.pegs.slice(0, -1);
        expect(pegs).toHaveLength(n);
        pegs.forEach((p, r) => {
          const i2 = p - pegOffset(r);
          expect(i2).toBeGreaterThanOrEqual(1);
          expect(i2).toBeLessThanOrEqual(r + 1);
        });
        // Time only moves forward.
        for (let s = 1; s < tr.ends.length; s++) expect(tr.ends[s]).toBeGreaterThan(tr.ends[s - 1]);
      }
    }
  });

  it('the ball touches each peg at its contact point and stays on the board', () => {
    const g = geometry(12);
    const path = dropPath(12, seeded(11));
    const tr = ballTrack(g, path, 100, { jitter: seeded(5) });
    tr.ends.forEach((t, i) => {
      const p = positionAt(tr, t);
      expect(p.x).toBeCloseTo(tr.xs[i + 1], 6);
      expect(p.y).toBeCloseTo(tr.ys[i + 1], 6);
    });
    for (let t = 0; t <= trackTime(tr); t += 7) {
      const p = positionAt(tr, t);
      expect(p.x).toBeGreaterThan(0);
      expect(p.x).toBeLessThan(1000);
      expect(p.y).toBeGreaterThan(0);
    }
  });
});
