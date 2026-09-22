import { createRng } from '../../lib/rng';
import { ANSWERS_RAW, EXTRA_GUESSES_RAW } from './words';

export const WORD_LEN = 5;
export const MAX_GUESSES = 6;
export const MAX_HINTS = 2;

export type Mark = 'correct' | 'present' | 'absent';

function split(raw: string): string[] {
  const out: string[] = new Array(raw.length / WORD_LEN);
  for (let i = 0; i < out.length; i++) out[i] = raw.slice(i * WORD_LEN, i * WORD_LEN + WORD_LEN);
  return out;
}

/** Curated answer list (lowercase, sorted). */
export const ANSWERS: readonly string[] = split(ANSWERS_RAW);

let validSet: Set<string> | null = null;
/** Every accepted guess: answers + the broad extra list. */
export function validGuesses(): Set<string> {
  if (!validSet) validSet = new Set([...ANSWERS, ...split(EXTRA_GUESSES_RAW)]);
  return validSet;
}

export function isValidGuess(word: string): boolean {
  return validGuesses().has(word.toLowerCase());
}

/** Deterministic answer for a seed (lowercase). */
export function pickAnswer(seed: number): string {
  return createRng(seed).pick(ANSWERS);
}

/**
 * Score a guess against the answer with correct duplicate handling:
 * greens first, then yellows limited by the answer's remaining letter counts.
 */
export function scoreGuess(guess: string, answer: string): Mark[] {
  const g = guess.toLowerCase();
  const a = answer.toLowerCase();
  const marks: Mark[] = new Array(g.length).fill('absent');
  const remaining = new Map<string, number>();
  for (let i = 0; i < a.length; i++) {
    if (g[i] === a[i]) marks[i] = 'correct';
    else remaining.set(a[i], (remaining.get(a[i]) ?? 0) + 1);
  }
  for (let i = 0; i < g.length; i++) {
    if (marks[i] === 'correct') continue;
    const n = remaining.get(g[i]) ?? 0;
    if (n > 0) {
      marks[i] = 'present';
      remaining.set(g[i], n - 1);
    }
  }
  return marks;
}

const ORDINALS = ['1st', '2nd', '3rd', '4th', '5th'];

/**
 * Hard mode: revealed greens must stay in place and revealed yellows must be reused
 * (as many copies as any single earlier guess revealed). Returns the NYT-style message or null.
 */
export function hardModeError(guess: string, previous: readonly { word: string; marks: readonly Mark[] }[]): string | null {
  const g = guess.toLowerCase();
  for (const p of previous) {
    for (let i = 0; i < WORD_LEN; i++) {
      if (p.marks[i] === 'correct' && g[i] !== p.word[i]) return `${ORDINALS[i]} letter must be ${p.word[i].toUpperCase()}`;
    }
  }
  for (const p of previous) {
    const need = new Map<string, number>();
    for (let i = 0; i < WORD_LEN; i++) {
      if (p.marks[i] !== 'absent') need.set(p.word[i], (need.get(p.word[i]) ?? 0) + 1);
    }
    for (const [ch, n] of need) {
      let have = 0;
      for (const c of g) if (c === ch) have++;
      if (have < n) return `Guess must contain ${ch.toUpperCase()}`;
    }
  }
  return null;
}

const RANK: Record<Mark, number> = { absent: 1, present: 2, correct: 3 };

/** Best-known mark per letter, for coloring the on-screen keyboard. */
export function keyboardMarks(rows: readonly { word: string; marks: readonly Mark[] }[]): Record<string, Mark> {
  const out: Record<string, Mark> = {};
  for (const r of rows) {
    for (let i = 0; i < r.word.length; i++) {
      const ch = r.word[i];
      const m = r.marks[i];
      if (!out[ch] || RANK[m] > RANK[out[ch]]) out[ch] = m;
    }
  }
  return out;
}

/** Emoji grid for sharing. */
export function shareGrid(rows: readonly (readonly Mark[])[], highContrast = false): string {
  const sq: Record<Mark, string> = highContrast
    ? { correct: '🟧', present: '🟦', absent: '⬛' }
    : { correct: '🟩', present: '🟨', absent: '⬛' };
  return rows.map((r) => r.map((m) => sq[m]).join('')).join('\n');
}

/**
 * Next hint: a position whose correct letter the player doesn't know yet (not revealed green,
 * not already hinted). Order of positions is shuffled from the seed so hints are deterministic.
 */
export function nextHintPosition(seed: number, answer: string, rows: readonly { word: string; marks: readonly Mark[] }[], hinted: readonly number[]): number | null {
  const known = new Set<number>(hinted);
  for (const r of rows) r.marks.forEach((m, i) => m === 'correct' && known.add(i));
  const order = createRng(seed ^ 0x5bd1e995).shuffle([0, 1, 2, 3, 4]);
  for (const i of order) if (!known.has(i) && i < answer.length) return i;
  return null;
}
