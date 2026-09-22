import { isLadder, MIDDLE, oneApart, RUNGS } from './generator';

/**
 * Pure game-flow rules for Crossclimb. The UI never reveals per-row or per-letter correctness while
 * typing: rows are only judged as a whole once every middle row is filled, and on demand via a hint.
 */

export type Phase = 'clues' | 'order' | 'final' | 'done';

export const MIDS = [1, 2, 3, 4, 5];

export const isFull = (entry: readonly string[]): boolean => entry.every(Boolean);
export const isCorrect = (word: string, entry: readonly string[]): boolean => entry.join('') === word;

/**
 * clues → all five middle rows filled and correct → order (skipped when already a valid ladder)
 * → top/bottom unlocked (final) → both filled and correct → done.
 */
export function computePhase(words: readonly string[], entries: readonly (readonly string[])[], order: readonly number[]): Phase {
  if (!MIDS.every((i) => isCorrect(words[i], entries[i]))) return 'clues';
  if (!isLadder(order.map((i) => words[i]))) return 'order';
  if (!(isCorrect(words[0], entries[0]) && isCorrect(words[RUNGS - 1], entries[RUNGS - 1]))) return 'final';
  return 'done';
}

/**
 * The end rungs are a fixed pair (top word first, e.g. FIRE over WORK), so once the middle is in a
 * valid order it is shown top-to-bottom: a reversed (but valid) order is flipped.
 */
export function forwardOrder(order: readonly number[]): number[] {
  return order[0] === MIDS[0] ? order.slice() : order.slice().reverse();
}

/** Row a letter/word hint applies to: the selected row, or else the first incorrect row in `seq`. */
export function hintRow(selected: number, seq: readonly number[], words: readonly string[], entries: readonly (readonly string[])[]): number | null {
  if (seq.includes(selected) && !isCorrect(words[selected], entries[selected])) return selected;
  return seq.find((w) => !isCorrect(words[w], entries[w])) ?? null;
}

export type HintAction = { kind: 'wrong' } | { kind: 'reveal'; col: number } | null;

/**
 * A completely filled but wrong row is only called out as a whole ("wrong"). Otherwise the first
 * position that has not been revealed yet gets its correct letter. Null when nothing is left to do.
 */
export function letterHint(word: string, entry: readonly string[], given: readonly boolean[]): HintAction {
  if (isCorrect(word, entry)) return null;
  if (isFull(entry)) return { kind: 'wrong' };
  const col = given.findIndex((g) => !g);
  return col < 0 ? null : { kind: 'reveal', col };
}

/** First row after `from` in display order (wrapping, including `from` last) that still has empty boxes, or null. */
export function nextRowWithEmpty(seq: readonly number[], from: number, entries: readonly (readonly string[])[]): number | null {
  const idx = seq.indexOf(from);
  for (let k = 1; k <= seq.length; k++) {
    const cand = seq[(idx + k + seq.length) % seq.length];
    if (!isFull(entries[cand])) return cand;
  }
  return null;
}

/** Ordering hint: a middle row that is out of place (preferring one with no valid neighbor). */
export function orderHint(order: readonly number[], words: readonly string[]): number | null {
  const ws = order.map((i) => words[i]);
  const link = (k: number) => oneApart(ws[k], ws[k + 1]);
  const lonely = order.filter((_, k) => !(k > 0 && link(k - 1)) && !(k < MIDDLE - 1 && link(k)));
  const rev = [...MIDS].reverse();
  const score = (t: number[]) => order.reduce((n, v, i) => n + (v === t[i] ? 1 : 0), 0);
  const target = score(MIDS) >= score(rev) ? MIDS : rev;
  const misplaced = order.filter((v, i) => v !== target[i]);
  if (!misplaced.length) return null;
  return lonely.find((v) => misplaced.includes(v)) ?? lonely[0] ?? misplaced[0];
}
