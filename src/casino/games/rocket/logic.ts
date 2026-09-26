import { secureRandom, type RandomFn } from '../../random';

/**
 * Rocket ("crash"): the multiplier climbs as m(t) = e^(K·t) and the flight explodes at a crash point
 * decided at launch. P(crash ≥ x) = 0.99 / x, so every target has the same 1% house edge.
 */

/** Growth rate per second: ×2 after ~8.7 s, ×10 after ~29 s, ×100 after ~58 s. */
export const K = 0.08;
/** Fair-odds factor: P(reach x) = RTP / x. */
export const RTP = 0.99;
/** Nothing flies past this (it'd take ~3 minutes to get here anyway). */
export const MAX_MULT = 1_000_000;
/** Auto cash-out limits. */
export const MIN_AUTO = 1.01;
export const MAX_AUTO = MAX_MULT;
export const DEFAULT_AUTO = 2;
/** Crash chips kept in the history strip. */
export const HISTORY_SIZE = 12;

/** Floor to 2 decimals, forgiving float noise (2.35 × 100 = 234.99999…). */
export function floor2(x: number): number {
  return Math.floor(x * 100 + 1e-7) / 100;
}

/**
 * The crash point for one flight: x = 0.99 / (1 − U). Below ×1 (about 1 flight in 100) the rocket
 * explodes on the launch pad, shown as ×1.00; otherwise x floored to 2 decimals.
 */
export function crashPoint(rng: RandomFn = secureRandom): number {
  const u = rng();
  const x = RTP / (1 - u);
  if (!(x >= 1)) return 1;
  return Math.min(MAX_MULT, floor2(x));
}

/** The exact (unrounded) multiplier t seconds after launch. */
export function multiplierAt(t: number): number {
  return Math.exp(K * Math.max(0, t));
}

/** What's shown and paid at time t: the multiplier floored to 2 decimals. */
export function displayMult(t: number): number {
  return floor2(multiplierAt(t));
}

/** Seconds after launch at which the multiplier reaches m (the inverse of `multiplierAt`). */
export function timeToMult(m: number): number {
  return m <= 1 ? 0 : Math.log(m) / K;
}

/** Chance a flight reaches multiplier x. */
export function reachChance(x: number): number {
  return x <= 1 ? 1 : Math.min(1, RTP / x);
}

/** Bet × multiplier, rounded down to the cent. */
export function payoutFor(stake: number, mult: number): number {
  return Math.floor(stake * mult * 100 + 1e-6) / 100;
}

/** An auto cash-out target: clamped to ×1.01–×1,000,000 and floored to 2 decimals. */
export function clampAuto(v: number): number {
  if (!Number.isFinite(v)) return DEFAULT_AUTO;
  return floor2(Math.min(MAX_AUTO, Math.max(MIN_AUTO, v)));
}

/** "2", "×2.5", "1,000" → a target; empty or unusable → null. */
export function parseAuto(raw: string): number | null {
  const n = Number(raw.replace(/[^\d.]/g, ''));
  if (!raw.trim() || !Number.isFinite(n) || n <= 0) return null;
  return clampAuto(n);
}

export type Outcome =
  | { kind: 'flying'; mult: number }
  /** Auto cash-out hit its target: paid at exactly `mult`. */
  | { kind: 'auto'; mult: number; at: number }
  /** Exploded at the crash point before any cash-out. */
  | { kind: 'crashed'; mult: number; at: number };

/**
 * Where a flight stands t seconds after launch, for a bet still riding on it. Computed from the
 * elapsed time alone, so a throttled or hidden tab resolves exactly like a smooth one: an auto
 * cash-out at or below the crash point always wins, even if both moments passed between frames.
 */
export function flightAt(crash: number, auto: number | null, t: number): Outcome {
  const tCrash = timeToMult(crash);
  if (auto != null && auto <= crash) {
    const tAuto = timeToMult(auto);
    if (t >= tAuto - 1e-9) return { kind: 'auto', mult: auto, at: tAuto };
  }
  if (t >= tCrash - 1e-9) return { kind: 'crashed', mult: crash, at: tCrash };
  // Still in the air: never show the crash (or auto) value before it happens.
  const cap = floor2(Math.min(crash, auto ?? Infinity) - 0.01);
  return { kind: 'flying', mult: Math.max(1, Math.min(displayMult(t), cap)) };
}

/** Chip colour for a crash point in the history strip. */
export function crashTier(m: number): 'low' | 'mid' | 'high' {
  return m >= 10 ? 'high' : m >= 2 ? 'mid' : 'low';
}

/** Newest first, capped. */
export function pushHistory(list: readonly number[], crash: number): number[] {
  return [crash, ...list].slice(0, HISTORY_SIZE);
}

/** Readable axis steps: 1, 2, 5 × 10ⁿ with 3–6 lines across `span`. */
export function niceStep(span: number, target = 4): number {
  const raw = span / target;
  const pow = Math.pow(10, Math.floor(Math.log10(raw)));
  const f = raw / pow;
  return (f < 1.5 ? 1 : f < 3.5 ? 2 : f < 7.5 ? 5 : 10) * pow;
}
