import { describe, expect, it } from 'vitest';
import {
  choose,
  clampMines,
  maxGems,
  multiplier,
  multLabel,
  payoutFor,
  placeMines,
  randomTile,
  rawMultiplier,
  safeChance,
  TILES,
} from './logic';

/** A small seeded generator so placements are repeatable. */
function seeded(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

describe('choose', () => {
  it('matches known binomials', () => {
    expect(choose(25, 0)).toBe(1);
    expect(choose(25, 1)).toBe(25);
    expect(choose(25, 2)).toBe(300);
    expect(choose(25, 12)).toBe(5200300);
    expect(choose(22, 3)).toBe(1540);
    expect(choose(5, 6)).toBe(0);
  });
});

describe('multiplier', () => {
  it('follows 0.99 × C(25,k) / C(25−m,k)', () => {
    expect(rawMultiplier(1, 1)).toBeCloseTo((0.99 * 25) / 24, 10);
    expect(multiplier(1, 1)).toBe(1.03);
    expect(rawMultiplier(3, 1)).toBeCloseTo(1.125, 10);
    expect(rawMultiplier(24, 1)).toBeCloseTo(24.75, 10);
    expect(multiplier(24, 1)).toBe(24.75);
    // 3 mines, 4 gems: 0.99 × 12650 / 7315
    expect(rawMultiplier(3, 4)).toBeCloseTo((0.99 * 12650) / 7315, 10);
    expect(multiplier(3, 4)).toBe(1.71);
    // Every safe tile on a 1-mine field: 0.99 × C(25,24) / C(24,24) = 24.75
    expect(multiplier(1, 24)).toBe(24.75);
  });

  it('rounds the paid multiplier down to 2 decimals, never up', () => {
    // 3 mines 1 gem is exactly 1.125: paid as 1.12, not 1.13.
    expect(multiplier(3, 1)).toBe(1.12);
    for (let m = 1; m <= 24; m++) {
      for (let k = 1; k <= maxGems(m); k++) {
        const raw = rawMultiplier(m, k);
        const paid = multiplier(m, k);
        expect(paid).toBeLessThanOrEqual(raw + 1e-9);
        expect(raw - paid).toBeLessThan(0.01 + 1e-9);
        expect(Math.round(paid * 100)).toBeCloseTo(paid * 100, 6);
      }
    }
  });

  it('is ×1 before any gem and 0 past the last safe tile', () => {
    expect(multiplier(3, 0)).toBe(1);
    expect(multiplier(3, 23)).toBe(0);
    expect(rawMultiplier(24, 2)).toBe(0);
  });

  it('grows with every gem and with every extra mine', () => {
    for (let m = 1; m <= 24; m++) {
      let prev = 1;
      for (let k = 1; k <= maxGems(m); k++) {
        const r = rawMultiplier(m, k);
        expect(r).toBeGreaterThan(prev);
        prev = r;
      }
    }
    for (let m = 1; m < 24; m++) expect(rawMultiplier(m + 1, 1)).toBeGreaterThan(rawMultiplier(m, 1));
  });

  it('keeps a 1% house edge: multiplier × survival chance = 0.99', () => {
    for (const m of [1, 3, 5, 10, 24]) {
      for (let k = 1; k <= maxGems(m); k++) {
        let survive = 1;
        for (let i = 0; i < k; i++) survive *= safeChance(m, i);
        expect(rawMultiplier(m, k) * survive).toBeCloseTo(0.99, 9);
      }
    }
  });
});

describe('maxGems and safeChance', () => {
  it('allows 25 − m gems', () => {
    expect(maxGems(1)).toBe(24);
    expect(maxGems(3)).toBe(22);
    expect(maxGems(24)).toBe(1);
  });

  it('gives the chance the next tile is safe', () => {
    expect(safeChance(3, 0)).toBeCloseTo(22 / 25);
    expect(safeChance(3, 2)).toBeCloseTo(20 / 23);
    expect(safeChance(24, 0)).toBeCloseTo(1 / 25);
    expect(safeChance(3, 22)).toBe(0);
  });
});

describe('payoutFor', () => {
  it('is the bet times the paid multiplier, rounded down to the cent', () => {
    expect(payoutFor(100, 3, 1)).toBe(112);
    expect(payoutFor(100, 1, 1)).toBe(103);
    expect(payoutFor(10, 24, 1)).toBe(247.5);
    expect(payoutFor(0.99, 3, 1)).toBe(1.1); // 0.99 × 1.12 = 1.1088
    expect(payoutFor(33.33, 3, 4)).toBe(56.99); // 33.33 × 1.71 = 56.9943
  });

  it('stays exact for the biggest possible win', () => {
    // 12 mines, all 13 gems: floor(99 × 5200300 / 1) / 100 = 5,148,297
    expect(multiplier(12, 13)).toBe(5148297);
    expect(payoutFor(1_000_000, 12, 13)).toBe(5_148_297_000_000);
  });
});

describe('placeMines', () => {
  it('places the requested number of unique mines on the field', () => {
    for (let m = 1; m <= 24; m++) {
      const mines = placeMines(m, seeded(m * 7919));
      expect(mines).toHaveLength(m);
      expect(new Set(mines).size).toBe(m);
      for (const i of mines) {
        expect(Number.isInteger(i)).toBe(true);
        expect(i).toBeGreaterThanOrEqual(0);
        expect(i).toBeLessThan(TILES);
      }
      expect([...mines].sort((a, b) => a - b)).toEqual(mines);
    }
  });

  it('is repeatable with the same generator and varies with another', () => {
    expect(placeMines(5, seeded(42))).toEqual(placeMines(5, seeded(42)));
    expect(placeMines(5, seeded(42))).not.toEqual(placeMines(5, seeded(43)));
  });

  it('uses the injected generator (always 0 keeps the last tiles as the draw order)', () => {
    // Fisher–Yates with rng() = 0 rotates the list: [1, 2, ..., 24, 0].
    expect(placeMines(3, () => 0)).toEqual([1, 2, 3]);
  });

  it('clamps the mine count to 1–24', () => {
    expect(placeMines(0, seeded(1))).toHaveLength(1);
    expect(placeMines(99, seeded(1))).toHaveLength(24);
    expect(clampMines(Number.NaN)).toBe(3);
    expect(clampMines(4.4)).toBe(4);
  });
});

describe('randomTile', () => {
  it('only picks unopened tiles', () => {
    const opened = Array.from({ length: TILES }, (_, i) => i !== 7 && i !== 19);
    const rng = seeded(5);
    for (let n = 0; n < 50; n++) expect([7, 19]).toContain(randomTile(opened, rng));
  });

  it('returns -1 when everything is open', () => {
    expect(randomTile(Array(TILES).fill(true))).toBe(-1);
  });
});

describe('multLabel', () => {
  it('shows two decimals and never rounds up', () => {
    expect(multLabel(1.12, 'en')).toBe('×1.12');
    expect(multLabel(24.75, 'en')).toBe('×24.75');
    expect(multLabel(5148297, 'en')).toBe('×5,148,297');
    expect(multLabel(1234.99, 'en')).toBe('×1,234');
  });
});
