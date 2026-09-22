import { createRng } from '../../lib/rng';
import { CATEGORIES, type Category } from './data';

export const CLUE_COUNT = 5;

export interface Puzzle {
  category: Category;
  /** Five clue words, most ambiguous first. */
  clues: string[];
}

/**
 * Deterministic round from a seed: pick a category, then 5 of its members keeping their stored
 * (ambiguous → obvious) order. The final clue always comes from the two most obvious members.
 */
export function generatePuzzle(seed: number, pool: readonly Category[] = CATEGORIES): Puzzle {
  const rng = createRng(seed);
  const category = pool[Math.floor(rng.next() * pool.length)];
  const n = category.words.length;
  const idx = rng
    .shuffle(Array.from({ length: n }, (_, i) => i))
    .slice(0, CLUE_COUNT)
    .sort((a, b) => a - b);
  if (idx[idx.length - 1] < n - 2) idx[idx.length - 1] = n - 1 - (rng.chance(0.5) ? 0 : 1);
  return { category, clues: idx.map((i) => category.words[i]) };
}

/** Capitalise the first letter for display, leaving the rest as authored ("iPhone"-safe enough). */
export function displayWord(w: string): string {
  return w.charAt(0).toUpperCase() + w.slice(1);
}
