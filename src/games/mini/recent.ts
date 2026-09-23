import type { ClueEntry } from './data/types';
import type { MiniClue, MiniPuzzle } from './generator';

/** How many recently shown word+clue pairs this device remembers (per word language). */
export const RECENT_MAX = 600;

const pairKey = (answer: string, clue: string) => `${answer}|${clue}`;

/**
 * Clue rotation: the grid comes from the seed, but when an answer's clue was shown recently on
 * this device, swap in one of the word's other clues that hasn't been seen lately. Falls back
 * to the least recently seen clue when all of them were shown.
 */
export function freshClues(p: MiniPuzzle, entries: readonly ClueEntry[], recent: readonly string[]): MiniPuzzle {
  if (!recent.length) return p;
  const age = new Map<string, number>();
  recent.forEach((k, i) => age.set(k, i)); // higher = seen more recently
  const bank = new Map(entries.map((e) => [e.word, e.clues]));
  const swap = (c: MiniClue): MiniClue => {
    if (!age.has(pairKey(c.answer, c.clue))) return c;
    const options = bank.get(c.answer) ?? [c.clue];
    const unseen = options.filter((o) => !age.has(pairKey(c.answer, o)));
    const pick = unseen.length
      ? unseen[c.num % unseen.length]
      : [...options].sort((a, b) => (age.get(pairKey(c.answer, a)) ?? -1) - (age.get(pairKey(c.answer, b)) ?? -1))[0];
    return pick === c.clue ? c : { ...c, clue: pick };
  };
  return { ...p, across: p.across.map(swap), down: p.down.map(swap) };
}

/** The recent list after showing `p` (oldest first, capped). */
export function remember(p: MiniPuzzle, recent: readonly string[]): string[] {
  const shown = [...p.across, ...p.down].map((c) => pairKey(c.answer, c.clue));
  const set = new Set(shown);
  return [...recent.filter((k) => !set.has(k)), ...shown].slice(-RECENT_MAX);
}
