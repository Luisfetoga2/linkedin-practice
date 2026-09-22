// Clued vocabulary for Crossclimb. Word lists were hand-picked for this project (checked against the
// public-domain Webster's 2nd word list in /usr/share/dict/words) and every clue is original.
// Each chunk is a template string of lines `WORD|clue` or `WORD|clue|alternative clue`.
import c4aa from './clues4_aa';
import c4ab from './clues4_ab';
import c4ac from './clues4_ac';
import c4ad from './clues4_ad';
import c4ae from './clues4_ae';
import c5aa from './clues5_aa';
import c5ab from './clues5_ab';
import c5ac from './clues5_ac';
import c5ad from './clues5_ad';
import p4 from './pairs4';
import p5 from './pairs5';

export type WordLength = 4 | 5;

/** Word (uppercase) → one or more clues, in file order (deterministic). */
export type ClueBank = Map<string, string[]>;

const SOURCES: Record<WordLength, string[]> = {
  4: [c4aa, c4ab, c4ac, c4ad, c4ae],
  5: [c5aa, c5ab, c5ac, c5ad],
};

export function parseClues(length: number, texts: readonly string[]): ClueBank {
  const bank: ClueBank = new Map();
  for (const text of texts) {
    for (const raw of text.split('\n')) {
      const line = raw.trim();
      if (!line || line.startsWith('#')) continue;
      const [word, ...clues] = line.split('|').map((s) => s.trim());
      const w = word.toUpperCase();
      if (w.length !== length || !/^[A-Z]+$/.test(w)) continue;
      const list = clues.filter(Boolean);
      if (!list.length) continue;
      const prev = bank.get(w);
      if (prev) prev.push(...list);
      else bank.set(w, list);
    }
  }
  return bank;
}

const cache = new Map<WordLength, ClueBank>();

export function getClueBank(length: WordLength): ClueBank {
  let bank = cache.get(length);
  if (!bank) {
    bank = parseClues(length, SOURCES[length]);
    cache.set(length, bank);
  }
  return bank;
}

/** A top/bottom rung pair: two related words (or a compound, top first) sharing one clue. */
export interface EndPair {
  top: string;
  bottom: string;
  clue: string;
}

const PAIR_SOURCES: Record<WordLength, string> = { 4: p4, 5: p5 };

export function parsePairs(length: number, text: string): EndPair[] {
  const out: EndPair[] = [];
  for (const raw of text.split('\n')) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const [top, bottom, ...rest] = line.split('|').map((s) => s.trim());
    const clue = rest.join('|');
    const t = (top ?? '').toUpperCase();
    const b = (bottom ?? '').toUpperCase();
    if (t.length !== length || b.length !== length || !/^[A-Z]+$/.test(t + b) || !clue) continue;
    out.push({ top: t, bottom: b, clue });
  }
  return out;
}

const pairCache = new Map<WordLength, EndPair[]>();

/** Curated end-rung pairs for a word length, in file order (deterministic). */
export function getPairs(length: WordLength): EndPair[] {
  let pairs = pairCache.get(length);
  if (!pairs) {
    pairs = parsePairs(length, PAIR_SOURCES[length]);
    pairCache.set(length, pairs);
  }
  return pairs;
}
