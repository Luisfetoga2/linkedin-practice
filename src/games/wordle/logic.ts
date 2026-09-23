import { createRng } from '../../lib/rng';
import { ANSWERS_RAW, EXTRA_GUESSES_RAW } from './words';
import { STR, type WordleStrings } from './i18n';

export const WORD_LEN = 5;
export const MAX_GUESSES = 6;
export const MAX_HINTS = 2;

export type Mark = 'correct' | 'present' | 'absent';
/** Language of the word list (the `words` option), independent of the interface language. */
export type WordLang = 'en' | 'es';

export interface WordList {
  lang: WordLang;
  /** Curated answers, normalized (lowercase, no accents, Ñ kept), in a fixed order. */
  answers: readonly string[];
  /** Every accepted guess, normalized. */
  valid: ReadonlySet<string>;
  /** Accented spelling of an answer for display (e.g. "arbol" -> "árbol"); absent when identical. */
  display: ReadonlyMap<string, string>;
}

function split(raw: string): string[] {
  const out: string[] = new Array(raw.length / WORD_LEN);
  for (let i = 0; i < out.length; i++) out[i] = raw.slice(i * WORD_LEN, i * WORD_LEN + WORD_LEN);
  return out;
}

const BASE: Record<string, string> = {
  á: 'a', à: 'a', â: 'a', ä: 'a',
  é: 'e', è: 'e', ê: 'e', ë: 'e',
  í: 'i', ì: 'i', î: 'i', ï: 'i',
  ó: 'o', ò: 'o', ô: 'o', ö: 'o',
  ú: 'u', ù: 'u', û: 'u', ü: 'u',
};

/**
 * Canonical form used to store and compare words: lowercase, accents and diaeresis removed
 * (á→a … ü→u), but Ñ kept as its own letter. Rendered uppercase on screen.
 */
export function normalizeWord(s: string): string {
  const lower = s.normalize('NFC').toLowerCase();
  let out = '';
  for (const ch of lower) out += BASE[ch] ?? ch;
  return out;
}

/** Letters a physical key may type for this list, or null ("Á" → "a"; "ñ" only for Spanish). */
export function keyToLetter(key: string, lang: WordLang): string | null {
  if (key.length !== 1) return null;
  const ch = normalizeWord(key);
  if (/^[a-z]$/.test(ch)) return ch;
  if (ch === 'ñ' && lang === 'es') return ch;
  return null;
}

/** Curated English answer list (lowercase, sorted). */
export const ANSWERS: readonly string[] = split(ANSWERS_RAW);

let validSet: Set<string> | null = null;
/** Every accepted English guess: answers + the broad extra list. */
export function validGuesses(): Set<string> {
  if (!validSet) validSet = new Set([...ANSWERS, ...split(EXTRA_GUESSES_RAW)]);
  return validSet;
}

let englishList: WordList | null = null;
export function englishWords(): WordList {
  if (!englishList) englishList = { lang: 'en', answers: ANSWERS, valid: validGuesses(), display: new Map() };
  return englishList;
}

/** Build a list from raw concatenated data (answers may carry accents; extras are normalized). */
export function buildWordList(lang: WordLang, answersRaw: string, extraRaw: string): WordList {
  const display = new Map<string, string>();
  const answers = split(answersRaw).map((w) => {
    const n = normalizeWord(w);
    if (n !== w) display.set(n, w);
    return n;
  });
  return { lang, answers, valid: new Set([...answers, ...split(extraRaw)]), display };
}

let spanish: Promise<WordList> | null = null;
/**
 * Word list for a language. English is bundled; Spanish lives in its own chunk and is only
 * downloaded when a Spanish round starts.
 */
export function loadWordList(lang: WordLang): Promise<WordList> {
  if (lang === 'en') return Promise.resolve(englishWords());
  if (!spanish) {
    spanish = import('./words-es').then((m) => buildWordList('es', m.ES_ANSWERS_RAW, m.ES_EXTRA_RAW));
    spanish.catch(() => {
      spanish = null; // allow a retry after a network error
    });
  }
  return spanish;
}

export function isValidGuess(word: string, list: WordList = englishWords()): boolean {
  return list.valid.has(normalizeWord(word));
}

/** Deterministic answer for a seed (normalized). */
export function pickAnswer(seed: number, list: WordList = englishWords()): string {
  return createRng(seed).pick(list.answers);
}

/** Answer as it should be shown to the player (accents restored), uppercase. */
export function displayAnswer(answer: string, list: WordList = englishWords()): string {
  return (list.display.get(answer) ?? answer).toUpperCase();
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

export type HardModeViolation = { kind: 'position'; index: number; letter: string } | { kind: 'contains'; letter: string };

/**
 * Hard mode: revealed greens must stay in place and revealed yellows must be reused
 * (as many copies as any single earlier guess revealed). Letters are uppercase.
 */
export function hardModeViolation(guess: string, previous: readonly { word: string; marks: readonly Mark[] }[]): HardModeViolation | null {
  const g = guess.toLowerCase();
  for (const p of previous) {
    for (let i = 0; i < WORD_LEN; i++) {
      if (p.marks[i] === 'correct' && g[i] !== p.word[i]) return { kind: 'position', index: i, letter: p.word[i].toUpperCase() };
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
      if (have < n) return { kind: 'contains', letter: ch.toUpperCase() };
    }
  }
  return null;
}

/** Hard-mode message in the given language (NYT-style in English), or null. */
export function hardModeError(
  guess: string,
  previous: readonly { word: string; marks: readonly Mark[] }[],
  t: Pick<WordleStrings, 'mustBeAt' | 'mustContain'> = STR.en,
): string | null {
  const v = hardModeViolation(guess, previous);
  if (!v) return null;
  return v.kind === 'position' ? t.mustBeAt(v.index, v.letter) : t.mustContain(v.letter);
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
