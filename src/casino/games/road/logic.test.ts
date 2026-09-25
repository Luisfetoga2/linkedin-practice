import { describe, expect, it } from 'vitest';
import {
  advance,
  canCashOut,
  cashOut,
  HIT_CHANCE,
  LANES,
  LEVELS,
  multiplier,
  multiplierTable,
  payoutFor,
  startRoad,
  stepOutcome,
  survival,
  type RoadState,
} from './logic';

const always = (v: number) => () => v;

describe('multiplier table', () => {
  it('matches 0.99 / s^k floored to two decimals', () => {
    expect(multiplier('medium', 1)).toBe(1.12); // 0.99 / 0.88 = 1.125
    expect(multiplier('medium', 2)).toBe(1.27); // 1.2784
    expect(multiplier('easy', 1)).toBe(1.03); // 1.03125
    expect(multiplier('hard', 1)).toBe(1.23); // 1.2375
    expect(multiplier('expert', 1)).toBe(1.65); // exactly 1.65
    expect(multiplier('expert', 2)).toBe(2.75); // exactly 2.75
    expect(multiplier('hard', 5)).toBe(3.02); // 3.0212...
  });

  it('is ×1 before the first lane', () => {
    for (const l of LEVELS) expect(multiplier(l, 0)).toBe(1);
  });

  it('never exceeds the fair price minus the edge and is within a cent of it', () => {
    for (const l of LEVELS)
      for (let k = 1; k <= LANES; k++) {
        const exact = 0.99 / Math.pow(survival(l), k);
        const m = multiplier(l, k);
        expect(m).toBeLessThanOrEqual(exact + 1e-9);
        expect(exact - m).toBeLessThan(0.01);
      }
  });

  it('rises every lane on every difficulty, and harder roads pay more', () => {
    for (const l of LEVELS) {
      const t = multiplierTable(l);
      expect(t).toHaveLength(LANES);
      expect(t[0]).toBeGreaterThan(1);
      for (let i = 1; i < t.length; i++) expect(t[i]).toBeGreaterThan(t[i - 1]);
    }
    for (let k = 1; k <= LANES; k++) {
      expect(multiplier('medium', k)).toBeGreaterThan(multiplier('easy', k));
      expect(multiplier('hard', k)).toBeGreaterThan(multiplier('medium', k));
      expect(multiplier('expert', k)).toBeGreaterThan(multiplier('hard', k));
    }
  });

  it('has finite values at the last lane', () => {
    for (const l of LEVELS) {
      const top = multiplier(l, LANES);
      expect(Number.isFinite(top)).toBe(true);
      expect(top).toBeGreaterThan(1);
    }
    expect(multiplier('easy', LANES)).toBe(2.23); // 0.99 / 0.96^20 = 2.2398
    expect(multiplier('expert', LANES)).toBeCloseTo(27077.6, 1);
  });
});

describe('expected value', () => {
  it('cashing out after any number of lanes returns about 99% of the bet on average', () => {
    for (const l of LEVELS)
      for (let k = 1; k <= LANES; k++) {
        const ev = Math.pow(survival(l), k) * multiplier(l, k);
        expect(ev).toBeLessThanOrEqual(0.99 + 1e-9);
        expect(ev).toBeGreaterThan(0.98);
      }
  });

  it('each further step is about a fair bet (s × next / current ≈ 1)', () => {
    for (const l of LEVELS)
      for (let k = 1; k < LANES; k++) {
        const ratio = (survival(l) * multiplier(l, k + 1)) / multiplier(l, k);
        expect(ratio).toBeGreaterThan(0.99);
        expect(ratio).toBeLessThan(1.01);
      }
  });

  it('the first step is worth 0.99 of the bet', () => {
    for (const l of LEVELS) {
      const ev = survival(l) * multiplier(l, 1);
      expect(ev).toBeLessThanOrEqual(0.99 + 1e-9);
      expect(ev).toBeGreaterThan(0.98);
    }
  });
});

describe('outcomes', () => {
  it('a draw under the hit chance is a car, at or above it is safe', () => {
    for (const l of LEVELS) {
      const p = HIT_CHANCE[l];
      expect(stepOutcome(l, always(0))).toBe('hit');
      expect(stepOutcome(l, always(p - 1e-6))).toBe('hit');
      expect(stepOutcome(l, always(p))).toBe('safe');
      expect(stepOutcome(l, always(0.999))).toBe('safe');
    }
  });

  it('hit rate over many seeded draws matches the difficulty', () => {
    let seed = 12345;
    const rng = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
    for (const l of LEVELS) {
      let hits = 0;
      const n = 20000;
      for (let i = 0; i < n; i++) if (stepOutcome(l, rng) === 'hit') hits++;
      expect(Math.abs(hits / n - HIT_CHANCE[l])).toBeLessThan(0.015);
    }
  });
});

describe('a round', () => {
  it('moves one lane per Go and pays bet × multiplier on cash out', () => {
    let s: RoadState = startRoad('medium');
    expect(canCashOut(s)).toBe(false);
    expect(cashOut(s)).toBe(s);
    s = advance(s, always(0.5));
    expect(s).toMatchObject({ phase: 'live', lane: 1 });
    s = advance(s, always(0.5));
    expect(s.lane).toBe(2);
    expect(canCashOut(s)).toBe(true);
    s = cashOut(s);
    expect(s.phase).toBe('cashed');
    expect(payoutFor(s, 100)).toBe(127);
    expect(advance(s, always(0))).toBe(s);
  });

  it('a car ends the round with nothing paid and remembers the lane', () => {
    let s = advance(startRoad('hard'), always(0.9));
    s = advance(s, always(0.05));
    expect(s).toMatchObject({ phase: 'hit', lane: 1, hitLane: 2 });
    expect(payoutFor(s, 100)).toBe(0);
    expect(canCashOut(s)).toBe(false);
  });

  it('reaching the last lane ends the round as crossed at the top multiplier', () => {
    let s = startRoad('easy');
    for (let i = 0; i < LANES; i++) s = advance(s, always(0.99));
    expect(s).toMatchObject({ phase: 'crossed', lane: LANES });
    expect(payoutFor(s, 10)).toBe(22.3);
    expect(advance(s, always(0.99))).toBe(s);
  });
});
