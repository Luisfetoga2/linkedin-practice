import { describe, expect, it } from 'vitest';
import {
  clampAuto,
  crashPoint,
  crashTier,
  displayMult,
  flightAt,
  floor2,
  HISTORY_SIZE,
  K,
  MAX_MULT,
  multiplierAt,
  niceStep,
  parseAuto,
  payoutFor,
  pushHistory,
  reachChance,
  timeToMult,
} from './logic';

const always = (v: number) => () => v;

/** Small seeded PRNG (mulberry32) so the distribution test is repeatable. */
function seeded(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

describe('crash point', () => {
  it('is 0.99 / (1 − U) floored to two decimals', () => {
    expect(crashPoint(always(0.5))).toBe(1.98);
    expect(crashPoint(always(0.9))).toBe(9.9);
    expect(crashPoint(always(0.99))).toBe(99);
    expect(crashPoint(always(0.75))).toBe(3.96);
    expect(crashPoint(always(0.2))).toBe(1.23); // 1.2375
  });

  it('explodes on the pad (×1.00) when x < 1', () => {
    expect(crashPoint(always(0))).toBe(1); // 0.99 → instant
    expect(crashPoint(always(0.0099))).toBe(1);
    expect(crashPoint(always(0.01))).toBe(1); // exactly 1.00
  });

  it('never exceeds the cap', () => {
    expect(crashPoint(always(1 - 1e-12))).toBe(MAX_MULT);
  });

  it('reaches x with probability 0.99 / x over many seeded flights', () => {
    const rng = seeded(12345);
    const n = 200_000;
    const crashes = Array.from({ length: n }, () => crashPoint(rng));
    const freq = (x: number) => crashes.filter((c) => c >= x).length / n;
    for (const x of [1.01, 1.5, 2, 5, 10, 100]) {
      const p = 0.99 / x;
      const sd = Math.sqrt((p * (1 - p)) / n);
      expect(Math.abs(freq(x) - p)).toBeLessThan(5 * sd + 1e-3);
      expect(reachChance(x)).toBeCloseTo(p, 10);
    }
    // About 1 in 100 are below ×1 (instant, shown as ×1.00), and nothing is ever below ×1.00.
    const instant = crashes.filter((c) => c === 1).length / n;
    expect(instant).toBeGreaterThan(0.015);
    expect(instant).toBeLessThan(0.025); // 1% below ×1 + ~1% in [×1, ×1.01) floored to ×1.00
    expect(crashes.every((c) => c >= 1)).toBe(true);
    expect(reachChance(2)).toBeCloseTo(0.495);
    expect(reachChance(10)).toBeCloseTo(0.099);
    expect(reachChance(100)).toBeCloseTo(0.0099);
  });
});

describe('multiplier curve', () => {
  it('starts at ×1 and grows as e^(K·t)', () => {
    expect(multiplierAt(0)).toBe(1);
    expect(displayMult(0)).toBe(1);
    expect(multiplierAt(10)).toBeCloseTo(Math.exp(K * 10), 12);
    expect(K).toBeGreaterThanOrEqual(0.06);
    expect(K).toBeLessThanOrEqual(0.1);
    // ×2 lands in the 7–11 second window.
    expect(timeToMult(2)).toBeGreaterThan(7);
    expect(timeToMult(2)).toBeLessThan(11);
  });

  it('is monotonic', () => {
    let prev = 0;
    let prevShown = 0;
    for (let t = 0; t <= 120; t += 0.013) {
      const m = multiplierAt(t);
      expect(m).toBeGreaterThan(prev);
      expect(displayMult(t)).toBeGreaterThanOrEqual(prevShown);
      prev = m;
      prevShown = displayMult(t);
    }
  });

  it('time-to-multiplier is the inverse: t = ln(m) / K', () => {
    for (const m of [1.01, 1.5, 2, 3.33, 10, 250, 1e6]) {
      expect(timeToMult(m)).toBeCloseTo(Math.log(m) / K, 12);
      expect(multiplierAt(timeToMult(m))).toBeCloseTo(m, 8);
      expect(displayMult(timeToMult(m))).toBe(m);
    }
    expect(timeToMult(1)).toBe(0);
  });
});

describe('payout', () => {
  it('is bet × multiplier rounded down to the cent', () => {
    expect(payoutFor(100, 2.35)).toBe(235);
    expect(payoutFor(1, 1.15)).toBe(1.15); // 114.999… cents in floats
    expect(payoutFor(12.34, 1.07)).toBe(13.2); // 13.2038
    expect(payoutFor(0.99, 1.99)).toBe(1.97); // 1.9701
    expect(payoutFor(3, 1.33)).toBe(3.99);
    expect(payoutFor(100, 1)).toBe(100);
    expect(floor2(2.999)).toBe(2.99);
  });
});

describe('flight resolution', () => {
  it('flies, then explodes exactly at the crash point', () => {
    const crash = 1.47;
    const tc = timeToMult(crash);
    const early = flightAt(crash, null, tc * 0.5);
    expect(early.kind).toBe('flying');
    expect(early.mult).toBeLessThan(crash);
    // Just before the crash the display never reaches it.
    const late = flightAt(crash, null, tc - 1e-4);
    expect(late).toEqual({ kind: 'flying', mult: 1.46 });
    expect(flightAt(crash, null, tc)).toEqual({ kind: 'crashed', mult: 1.47, at: tc });
    // Long after (a hidden tab): same result.
    expect(flightAt(crash, null, tc + 500)).toMatchObject({ kind: 'crashed', mult: 1.47 });
  });

  it('an instant explosion ends the flight at t = 0', () => {
    expect(flightAt(1, null, 0)).toEqual({ kind: 'crashed', mult: 1, at: 0 });
    expect(flightAt(1, 1.01, 0)).toMatchObject({ kind: 'crashed' });
  });

  it('auto cash-out pays exactly the target when the crash point is at or above it', () => {
    const ta = timeToMult(2);
    expect(flightAt(5, 2, ta - 0.01).kind).toBe('flying');
    expect(flightAt(5, 2, ta)).toEqual({ kind: 'auto', mult: 2, at: ta });
    // Both moments passed between frames: the auto cash-out came first.
    expect(flightAt(5, 2, 1000)).toMatchObject({ kind: 'auto', mult: 2 });
    // Crash exactly at the target still pays.
    expect(flightAt(2, 2, 1000)).toMatchObject({ kind: 'auto', mult: 2 });
    expect(payoutFor(100, 2)).toBe(200);
  });

  it('auto cash-out loses when the rocket explodes first', () => {
    expect(flightAt(1.99, 2, 1000)).toMatchObject({ kind: 'crashed', mult: 1.99 });
    expect(flightAt(1, 1.01, 0)).toMatchObject({ kind: 'crashed', mult: 1 });
    // While flying the display stays below the target.
    expect(flightAt(50, 2, timeToMult(2) - 1e-4)).toEqual({ kind: 'flying', mult: 1.99 });
  });

  it('auto cash-out over many seeded flights wins with probability 0.99 / target', () => {
    const rng = seeded(99);
    const n = 100_000;
    let wins = 0;
    for (let i = 0; i < n; i++) if (flightAt(crashPoint(rng), 3, 1e9).kind === 'auto') wins++;
    expect(Math.abs(wins / n - 0.33)).toBeLessThan(0.008);
  });
});

describe('auto cash-out input', () => {
  it('parses, clamps and floors', () => {
    expect(parseAuto('2')).toBe(2);
    expect(parseAuto('×2.357')).toBe(2.35);
    expect(parseAuto('1,000')).toBe(1000);
    expect(parseAuto('1')).toBe(1.01);
    expect(parseAuto('0.5')).toBe(1.01);
    expect(parseAuto('99999999')).toBe(1_000_000);
    expect(parseAuto('')).toBeNull();
    expect(parseAuto('abc')).toBeNull();
    expect(parseAuto('0')).toBeNull();
    expect(clampAuto(Number.NaN)).toBe(2);
  });
});

describe('history and axes', () => {
  it('keeps the newest crash points first, capped', () => {
    let h: number[] = [];
    for (let i = 1; i <= 20; i++) h = pushHistory(h, i);
    expect(h).toHaveLength(HISTORY_SIZE);
    expect(h[0]).toBe(20);
    expect(h[HISTORY_SIZE - 1]).toBe(9);
  });

  it('colours chips by tier', () => {
    expect(crashTier(1)).toBe('low');
    expect(crashTier(1.99)).toBe('low');
    expect(crashTier(2)).toBe('mid');
    expect(crashTier(9.99)).toBe('mid');
    expect(crashTier(10)).toBe('high');
  });

  it('picks 1-2-5 axis steps', () => {
    expect(niceStep(1)).toBe(0.2);
    expect(niceStep(10)).toBe(2);
    expect(niceStep(18)).toBe(5);
    expect(niceStep(900)).toBe(200);
  });
});
