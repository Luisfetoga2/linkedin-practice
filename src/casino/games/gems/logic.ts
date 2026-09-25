import { LOCALE, type Lang } from '../../../lib/i18n';
import { randInt, secureRandom, shuffled, type RandomFn } from '../../random';

/** The field is 5×5. */
export const SIDE = 5;
export const TILES = SIDE * SIDE;
export const MIN_MINES = 1;
export const MAX_MINES = TILES - 1;
export const DEFAULT_MINES = 3;
/** Quick picks shown next to the mines stepper. */
export const QUICK_MINES = [1, 3, 5, 10, 24] as const;
/** What the player keeps of the fair odds: a 1% house edge. */
export const RTP = 0.99;

export function clampMines(m: number): number {
  if (!Number.isFinite(m)) return DEFAULT_MINES;
  return Math.min(MAX_MINES, Math.max(MIN_MINES, Math.round(m)));
}

/** n choose k, exact for everything on a 25-tile field. */
export function choose(n: number, k: number): number {
  if (k < 0 || k > n) return 0;
  const j = Math.min(k, n - k);
  let r = 1;
  // Each step is C(n − j + i, i), a whole number, so nothing is lost along the way.
  for (let i = 1; i <= j; i++) r = (r * (n - j + i)) / i;
  return Math.round(r);
}

/** Safe tiles on a field with `mines` mines: the most gems a round can find. */
export function maxGems(mines: number): number {
  return TILES - mines;
}

/**
 * The fair multiplier after `gems` safe picks is 1 / P(all of them safe) = C(25, k) / C(25 − m, k);
 * the house keeps 1% of it. 0 gems is ×1 (nothing to cash out yet); more gems than exist is 0.
 */
export function rawMultiplier(mines: number, gems: number): number {
  if (gems <= 0) return 1;
  if (gems > maxGems(mines)) return 0;
  return (RTP * choose(TILES, gems)) / choose(TILES - mines, gems);
}

/**
 * The multiplier actually paid: rounded down to 2 decimals. Worked in whole hundredths so a value
 * like ×2.00 can't slip to ×1.99 on floating-point noise (99·C(25,k) / C(25−m,k) is an exact ratio).
 */
export function multiplier(mines: number, gems: number): number {
  if (gems <= 0) return 1;
  if (gems > maxGems(mines)) return 0;
  return Math.floor((99 * choose(TILES, gems)) / choose(TILES - mines, gems)) / 100;
}

/** bet × paid multiplier, rounded down to the cent (exact integer math, even for huge wins). */
export function payoutFor(bet: number, mines: number, gems: number): number {
  const cents = BigInt(Math.round(bet * 100));
  const hundredths = BigInt(Math.round(multiplier(mines, gems) * 100));
  return Number((cents * hundredths) / 100n) / 100;
}

/** Chance the next tile is a gem after `gems` safe picks. */
export function safeChance(mines: number, gems: number): number {
  const left = TILES - gems;
  if (left <= 0) return 0;
  return (maxGems(mines) - gems) / left;
}

/** Where the mines are, chosen fresh at the start of each round. Sorted tile indexes. */
export function placeMines(mines: number, rng: RandomFn = secureRandom): number[] {
  const m = clampMines(mines);
  const order = shuffled(
    Array.from({ length: TILES }, (_, i) => i),
    rng,
  );
  return order.slice(0, m).sort((a, b) => a - b);
}

/** A random tile the player hasn't opened yet, or -1 if there is none. */
export function randomTile(opened: readonly boolean[], rng: RandomFn = secureRandom): number {
  const free: number[] = [];
  for (let i = 0; i < TILES; i++) if (!opened[i]) free.push(i);
  return free.length ? free[randInt(free.length, rng)] : -1;
}

/**
 * "×1.13" / "×24.75" / "×5,148,297": always the paid (floored) value, never rounded up, so the
 * label never promises more than the payout.
 */
export function multLabel(m: number, lang: Lang): string {
  const big = m >= 1000;
  const v = big ? Math.floor(m) : m;
  const digits = big ? 0 : 2;
  return `×${v.toLocaleString(LOCALE[lang], { minimumFractionDigits: digits, maximumFractionDigits: digits })}`;
}
