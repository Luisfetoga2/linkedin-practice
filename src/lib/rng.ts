/** Deterministic PRNG so a puzzle can be replayed from its seed. */
export interface Rng {
  /** Float in [0, 1). */
  next(): number;
  /** Integer in [min, max] inclusive. */
  int(min: number, max: number): number;
  pick<T>(items: readonly T[]): T;
  /** Returns a new shuffled array; input is untouched. */
  shuffle<T>(items: readonly T[]): T[];
  chance(p: number): boolean;
  /** Derive an independent generator (e.g. for a retry attempt). */
  fork(): Rng;
}

export function createRng(seed: number): Rng {
  let a = seed >>> 0 || 0x9e3779b9;
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const rng: Rng = {
    next,
    int: (min, max) => min + Math.floor(next() * (max - min + 1)),
    pick: (items) => items[Math.floor(next() * items.length)],
    shuffle: (items) => {
      const out = items.slice();
      for (let i = out.length - 1; i > 0; i--) {
        const j = Math.floor(next() * (i + 1));
        [out[i], out[j]] = [out[j], out[i]];
      }
      return out;
    },
    chance: (p) => next() < p,
    fork: () => createRng(Math.floor(next() * 4294967296)),
  };
  return rng;
}

export function randomSeed(): number {
  return Math.floor(Math.random() * 2 ** 31) + 1;
}

export function seedToCode(seed: number): string {
  return seed.toString(36).toUpperCase();
}

export function codeToSeed(code: string | null | undefined): number | null {
  if (!code) return null;
  const n = parseInt(code, 36);
  return Number.isFinite(n) && n > 0 ? n : null;
}
