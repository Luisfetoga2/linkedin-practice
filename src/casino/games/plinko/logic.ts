import { LOCALE, type Lang } from '../../../lib/i18n';
import { secureRandom, type RandomFn } from '../../random';

// ---------- Settings ----------

export const MIN_ROWS = 8;
export const MAX_ROWS = 16;
export const DEFAULT_ROWS = 16;
export const ROW_CHOICES = [8, 9, 10, 11, 12, 13, 14, 15, 16] as const;

export type Risk = 'low' | 'medium' | 'high';
export const RISKS: readonly Risk[] = ['low', 'medium', 'high'];
export const DEFAULT_RISK: Risk = 'medium';

export const MIN_BALLS = 1;
export const MAX_BALLS = 100;
export const DEFAULT_BALLS = 1;
export const QUICK_BALLS = [1, 5, 10, 25, 50, 100] as const;

export function clampRows(n: unknown): number {
  if (typeof n !== 'number' || !Number.isFinite(n)) return DEFAULT_ROWS;
  return Math.min(MAX_ROWS, Math.max(MIN_ROWS, Math.round(n)));
}

export function isRisk(v: unknown): v is Risk {
  return v === 'low' || v === 'medium' || v === 'high';
}

export function clampBalls(n: unknown): number {
  if (typeof n !== 'number' || !Number.isFinite(n)) return DEFAULT_BALLS;
  return Math.min(MAX_BALLS, Math.max(MIN_BALLS, Math.round(n)));
}

// ---------- Payout tables ----------

/**
 * What each bucket pays, left to right (index = how many times the ball went right). Symmetric,
 * one more bucket than rows, and each table returns about 99% of what's bet (see the tests).
 */
export const TABLES: Record<number, Record<Risk, readonly number[]>> = {
  8: {
    low: [5.6, 2.1, 1.1, 1, 0.5, 1, 1.1, 2.1, 5.6],
    medium: [13, 3, 1.3, 0.7, 0.4, 0.7, 1.3, 3, 13],
    high: [29, 4, 1.5, 0.3, 0.2, 0.3, 1.5, 4, 29],
  },
  9: {
    low: [5.6, 2, 1.6, 1, 0.7, 0.7, 1, 1.6, 2, 5.6],
    medium: [18, 4, 1.7, 0.9, 0.5, 0.5, 0.9, 1.7, 4, 18],
    high: [43, 7, 2, 0.6, 0.2, 0.2, 0.6, 2, 7, 43],
  },
  10: {
    low: [8.9, 3, 1.4, 1.1, 1, 0.5, 1, 1.1, 1.4, 3, 8.9],
    medium: [22, 5, 2, 1.4, 0.6, 0.4, 0.6, 1.4, 2, 5, 22],
    high: [76, 10, 3, 0.9, 0.3, 0.2, 0.3, 0.9, 3, 10, 76],
  },
  11: {
    low: [8.4, 3, 1.9, 1.3, 1, 0.7, 0.7, 1, 1.3, 1.9, 3, 8.4],
    medium: [24, 6, 3, 1.8, 0.7, 0.5, 0.5, 0.7, 1.8, 3, 6, 24],
    high: [120, 14, 5.2, 1.4, 0.4, 0.2, 0.2, 0.4, 1.4, 5.2, 14, 120],
  },
  12: {
    low: [10, 3, 1.6, 1.4, 1.1, 1, 0.5, 1, 1.1, 1.4, 1.6, 3, 10],
    medium: [33, 11, 4, 2, 1.1, 0.6, 0.3, 0.6, 1.1, 2, 4, 11, 33],
    high: [170, 24, 8.1, 2, 0.7, 0.2, 0.2, 0.2, 0.7, 2, 8.1, 24, 170],
  },
  13: {
    low: [8.1, 4, 3, 1.9, 1.2, 0.9, 0.7, 0.7, 0.9, 1.2, 1.9, 3, 4, 8.1],
    medium: [43, 13, 6, 3, 1.3, 0.7, 0.4, 0.4, 0.7, 1.3, 3, 6, 13, 43],
    high: [260, 37, 11, 4, 1, 0.2, 0.2, 0.2, 0.2, 1, 4, 11, 37, 260],
  },
  14: {
    low: [7.1, 4, 1.9, 1.4, 1.3, 1.1, 1, 0.5, 1, 1.1, 1.3, 1.4, 1.9, 4, 7.1],
    medium: [58, 15, 7, 4, 1.9, 1, 0.5, 0.2, 0.5, 1, 1.9, 4, 7, 15, 58],
    high: [420, 56, 18, 5, 1.9, 0.3, 0.2, 0.2, 0.2, 0.3, 1.9, 5, 18, 56, 420],
  },
  15: {
    low: [15, 8, 3, 2, 1.5, 1.1, 1, 0.7, 0.7, 1, 1.1, 1.5, 2, 3, 8, 15],
    medium: [88, 18, 11, 5, 3, 1.3, 0.5, 0.3, 0.3, 0.5, 1.3, 3, 5, 11, 18, 88],
    high: [620, 83, 27, 8, 3, 0.5, 0.2, 0.2, 0.2, 0.2, 0.5, 3, 8, 27, 83, 620],
  },
  16: {
    low: [16, 9, 2, 1.4, 1.4, 1.2, 1.1, 1, 0.5, 1, 1.1, 1.2, 1.4, 1.4, 2, 9, 16],
    medium: [110, 41, 10, 5, 3, 1.5, 1, 0.5, 0.3, 0.5, 1, 1.5, 3, 5, 10, 41, 110],
    high: [1000, 130, 26, 9, 4, 2, 0.2, 0.2, 0.2, 0.2, 0.2, 2, 4, 9, 26, 130, 1000],
  },
};

export function table(rows: number, risk: Risk): readonly number[] {
  return TABLES[clampRows(rows)][risk];
}

export function multiplierFor(rows: number, risk: Risk, bucket: number): number {
  return table(rows, risk)[bucket] ?? 0;
}

/** n choose k (exact for n ≤ 16). */
export function choose(n: number, k: number): number {
  if (k < 0 || k > n) return 0;
  const j = Math.min(k, n - k);
  let r = 1;
  for (let i = 1; i <= j; i++) r = (r * (n - j + i)) / i;
  return Math.round(r);
}

/** Chance a ball lands in bucket k after n fair left/right bounces: C(n, k) / 2ⁿ. */
export function bucketChance(rows: number, bucket: number): number {
  return choose(rows, bucket) / 2 ** rows;
}

/** Long-run share of each bet paid back: Σ C(n, k) / 2ⁿ · mₖ. */
export function expectedReturn(rows: number, risk: Risk): number {
  return table(rows, risk).reduce((sum, m, k) => sum + bucketChance(rows, k) * m, 0);
}

/** bet × multiplier, rounded down to the cent (whole-number math, so ×0.3 of $10 is $3.00, not $2.99). */
export function payoutFor(bet: number, mult: number): number {
  const cents = Math.round(bet * 100);
  const hundredths = Math.round(mult * 100);
  return Math.floor((cents * hundredths) / 100) / 100;
}

// ---------- One ball ----------

/** One ball's way down: `true` = it went right at that row's peg. Decided in full when it's released. */
export function dropPath(rows: number, rng: RandomFn = secureRandom): boolean[] {
  return Array.from({ length: rows }, () => rng() >= 0.5);
}

/** The bucket a path ends in: how many times it went right (0 = far left, rows = far right). */
export function bucketOf(path: readonly boolean[]): number {
  let k = 0;
  for (const right of path) if (right) k++;
  return k;
}

export interface Ball {
  path: boolean[];
  bucket: number;
  mult: number;
  payout: number;
}

/** Decide one ball: its path, bucket, multiplier and what it pays on `bet`. */
export function dropBall(rows: number, risk: Risk, bet: number, rng: RandomFn = secureRandom): Ball {
  const path = dropPath(rows, rng);
  const bucket = bucketOf(path);
  const mult = multiplierFor(rows, risk, bucket);
  return { path, bucket, mult, payout: payoutFor(bet, mult) };
}

/** Gap between balls in one drop: roomy for a few, quicker for a big batch so 100 don't take forever. */
export function releaseGap(balls: number): number {
  if (balls <= 5) return 200;
  if (balls <= 10) return 170;
  if (balls <= 25) return 150;
  if (balls <= 50) return 135;
  return 120;
}

// ---------- Labels ----------

/** "0.2" / "13" / "1,000" / "5.6": the multiplier as the tables write it (no trailing zeros). */
export function multNumber(m: number, lang: Lang, group = true): string {
  return m.toLocaleString(LOCALE[lang], { maximumFractionDigits: 1, useGrouping: group });
}

/** "×0.5" / "×1,000" for history notes and results. */
export function multText(m: number, lang: Lang): string {
  return `×${multNumber(m, lang)}`;
}

/** The short number printed on a bucket (the "×" is added by the UI): "1K" for 1000 so 17 buckets fit a phone. */
export function bucketLabel(m: number, lang: Lang): string {
  return m >= 1000 ? `${multNumber(m / 1000, lang)}K` : multNumber(m, lang, false);
}

/**
 * Bucket colour: warm yellow in the middle through orange to a hot pink-red at the edges, so the
 * rare big prizes stand out. `k` = bucket, `rows` = rows of pegs.
 */
export function bucketColor(k: number, rows: number): { bg: string; edge: string } {
  const d = rows ? Math.abs(k - rows / 2) / (rows / 2) : 0;
  // Hue 46° (yellow) → 350° (hot pink-red), going the short way through orange and red.
  const hue = (46 - d * 56 + 360) % 360;
  const light = 58 - d * 4;
  return { bg: `hsl(${hue.toFixed(1)} 100% ${light.toFixed(1)}%)`, edge: `hsl(${hue.toFixed(1)} 90% ${(light - 22).toFixed(1)}%)` };
}

// ---------- Board geometry and ball animation (board units: 1000 wide) ----------

export const BOARD_W = 1000;
/** The board keeps the same shape for every row count (height ÷ width). */
export const BOARD_ASPECT = 0.9;
export const BOARD_H = BOARD_W * BOARD_ASPECT;

export interface Geometry {
  rows: number;
  /** Horizontal distance between neighbouring pegs. */
  gap: number;
  /** Vertical distance between rows. */
  rowGap: number;
  /** y of the first (3-peg) row. */
  top: number;
  pegR: number;
  ballR: number;
  bucketTop: number;
  bucketH: number;
}

export function geometry(rows: number): Geometry {
  const n = clampRows(rows);
  // Bottom row has n + 2 pegs, i.e. n + 1 gaps; keep a little margin at each side.
  const gap = BOARD_W / (n + 1.8);
  const bucketH = Math.min(gap * 0.9, 62);
  const bucketTop = BOARD_H - bucketH - 12;
  const top = BOARD_H * 0.075;
  // The last row sits ~¾ of a row above the buckets.
  const rowGap = (bucketTop - top) / (n - 1 + 0.78);
  return { rows: n, gap, rowGap, top, pegR: gap * 0.1 + 2.2, ballR: gap * 0.235, bucketTop, bucketH };
}

/** Pegs in row r (0-based): 3 in the top row, one more each row. */
export const pegsInRow = (r: number) => r + 3;
/** Index of the first peg of row r in a flat list of every peg. */
export const pegOffset = (r: number) => (r * (r + 5)) / 2;
export const pegCount = (rows: number) => pegOffset(rows);

export function pegX(g: Geometry, r: number, i: number): number {
  return BOARD_W / 2 + (i - (r + 2) / 2) * g.gap;
}
export function pegY(g: Geometry, r: number): number {
  return g.top + r * g.rowGap;
}
/** Centre of bucket k (they sit between neighbouring pegs of the bottom row). */
export function bucketX(g: Geometry, k: number): number {
  return BOARD_W / 2 + (k - g.rows / 2) * g.gap;
}
/** Left edge of the bucket row and its width. */
export function bucketSpan(g: Geometry): { left: number; width: number } {
  const width = (g.rows + 1) * g.gap;
  return { left: (BOARD_W - width) / 2, width };
}

export interface Track {
  /** Ball centre at the start and at the end of each segment. */
  xs: number[];
  ys: number[];
  /** When each segment ends (ms after release); segment i runs from ends[i − 1] (or 0) to ends[i]. */
  ends: number[];
  /** How much the ball kicks up at the start of each segment (0 = a plain fall). */
  kick: number[];
  /** Flat index of the peg hit at the end of each segment (−1 for the last one, into the bucket). */
  pegs: number[];
  bucket: number;
}

/**
 * The on-screen route for a decided path: a short fall onto the top peg, then one hop per row
 * (a small bounce up, then gravity) touching the peg it deflects off slightly on the side it goes,
 * and a last drop into the bucket. `jitter` only changes the look (contact angles, timing);
 * the ball always ends in `bucketOf(path)`.
 */
export function ballTrack(g: Geometry, path: readonly boolean[], stepMs: number, opts: { jitter?: RandomFn; bounce?: number } = {}): Track {
  const rnd = opts.jitter ?? Math.random;
  const bounce = opts.bounce ?? 0.9;
  const reach = g.pegR + g.ballR;
  const xs: number[] = [];
  const ys: number[] = [];
  const ends: number[] = [];
  const kick: number[] = [];
  const pegs: number[] = [];
  let rights = 0;
  const contacts: { x: number; y: number; peg: number }[] = [];
  for (let r = 0; r < g.rows; r++) {
    const i = rights + 1;
    const dir = path[r] ? 1 : -1;
    // Where on the peg the ball touches: 12°–36° off the top, on the side it's about to go.
    const angle = dir * ((12 + rnd() * 24) * Math.PI) / 180;
    contacts.push({ x: pegX(g, r, i) + Math.sin(angle) * reach, y: pegY(g, r) - Math.cos(angle) * reach, peg: pegOffset(r) + i });
    if (path[r]) rights++;
  }
  // Start just inside the top edge, nearly straight above the first peg.
  xs.push(contacts[0].x + (rnd() - 0.5) * g.gap * 0.08);
  ys.push(g.ballR + 4);
  let t = 0;
  const fall = contacts[0].y - ys[0];
  t += stepMs * Math.sqrt(fall / g.rowGap) * 0.85;
  xs.push(contacts[0].x);
  ys.push(contacts[0].y);
  ends.push(t);
  kick.push(0);
  pegs.push(contacts[0].peg);
  for (let r = 1; r < g.rows; r++) {
    t += stepMs * (0.93 + rnd() * 0.14);
    xs.push(contacts[r].x);
    ys.push(contacts[r].y);
    ends.push(t);
    kick.push(bounce);
    pegs.push(contacts[r].peg);
  }
  // Into the bucket, landing a little way into it (it swallows the ball).
  const k = rights;
  const drop = g.bucketTop + g.ballR * 0.6 - contacts[g.rows - 1].y;
  t += stepMs * Math.sqrt(drop / g.rowGap) * 0.95;
  xs.push(bucketX(g, k) + (rnd() - 0.5) * g.gap * 0.22);
  ys.push(g.bucketTop + g.ballR * 0.6);
  ends.push(t);
  kick.push(bounce * 0.8);
  pegs.push(-1);
  return { xs, ys, ends, kick, pegs, bucket: k };
}

/** Total flight time of a track (ms). */
export const trackTime = (tr: Track) => tr.ends[tr.ends.length - 1];

/**
 * Ball centre `ms` after release. Each segment is a little projectile: x moves evenly, y follows
 * y₀ + Δy·((1 + a)u² − a·u), which starts by rising (a = kick) and ends exactly on the next contact.
 */
export function positionAt(tr: Track, ms: number): { x: number; y: number } {
  const last = tr.ends.length - 1;
  if (ms <= 0) return { x: tr.xs[0], y: tr.ys[0] };
  if (ms >= tr.ends[last]) return { x: tr.xs[last + 1], y: tr.ys[last + 1] };
  let i = 0;
  while (ms > tr.ends[i]) i++;
  const t0 = i ? tr.ends[i - 1] : 0;
  const u = (ms - t0) / (tr.ends[i] - t0);
  const a = tr.kick[i];
  const x = tr.xs[i] + (tr.xs[i + 1] - tr.xs[i]) * u;
  const y = tr.ys[i] + (tr.ys[i + 1] - tr.ys[i]) * ((1 + a) * u * u - a * u);
  return { x, y };
}

/** Time per row: a bit longer on boards with fewer (so bigger) rows. */
export function stepMs(rows: number, reduced: boolean): number {
  const base = 118 * Math.sqrt(16 / clampRows(rows));
  return reduced ? base * 0.5 : base;
}
