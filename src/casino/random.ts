/** A random float in [0, 1) from the browser's cryptographic generator (no seeds: every round is fresh). */
export function secureRandom(): number {
  try {
    const a = new Uint32Array(1);
    crypto.getRandomValues(a);
    return a[0] / 4294967296;
  } catch {
    return Math.random();
  }
}

export type RandomFn = () => number;

/** Integer in [0, n). */
export function randInt(n: number, rng: RandomFn = secureRandom): number {
  return Math.floor(rng() * n);
}

/** Fisher–Yates shuffle into a new array. */
export function shuffled<T>(items: readonly T[], rng: RandomFn = secureRandom): T[] {
  const out = items.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = randInt(i + 1, rng);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}
