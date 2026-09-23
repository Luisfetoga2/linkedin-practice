import type { ClueEntry } from './types';

/** Accent-free uppercase: CAFÉ → CAFE, but Ñ stays its own letter. */
export function foldAccents(s: string): string {
  return s
    .toUpperCase()
    .replace(/Ñ/g, '\u0000')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\u0000/g, 'Ñ');
}

/** Whether a clue gives its own answer away (ignoring case and accents). */
export function clueLeaksAnswer(word: string, clue: string): boolean {
  return foldAccents(clue).includes(word);
}

const WORD_RE = /^[A-ZÑ]{3,5}$/;

/**
 * Parse `WORD|clue|alt clue` lines (blank lines and `#` comments skipped) into entries. Words are
 * upper-cased, lines with a word outside 3–5 letters or without a usable clue are dropped, and a
 * repeated word merges its clues. Clues that contain their answer are dropped.
 */
export function parseEntries(texts: readonly string[]): ClueEntry[] {
  const byWord = new Map<string, string[]>();
  for (const text of texts) {
    for (const raw of text.split('\n')) {
      const line = raw.trim();
      if (!line || line.startsWith('#')) continue;
      const [w, ...rest] = line.split('|').map((s) => s.trim());
      const word = foldAccents(w.normalize('NFC'));
      if (!WORD_RE.test(word)) continue;
      const clues = rest.filter((c) => c.length > 1 && !clueLeaksAnswer(word, c));
      if (!clues.length) continue;
      const prev = byWord.get(word);
      if (prev) {
        for (const c of clues) if (!prev.includes(c)) prev.push(c);
      } else byWord.set(word, clues);
    }
  }
  return [...byWord].map(([word, clues]) => ({ word, clues }));
}
