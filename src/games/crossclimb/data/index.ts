// Clued vocabulary for Crossclimb. English word lists were hand-picked for this project (checked against
// the public-domain Webster's 2nd word list in /usr/share/dict/words) and every clue is original. The
// Spanish (Latin American) data lives in ./es and is loaded on demand (see loadWords).
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

/** Language of the puzzle words (the `words` option), independent of the UI language. */
export type WordLang = 'en' | 'es';

/** Word (uppercase) → one or more clues, in file order (deterministic). */
export type ClueBank = Map<string, string[]>;

interface Sources {
  clues: Record<WordLength, readonly string[]>;
  pairs: Record<WordLength, string>;
}

const SOURCES: Partial<Record<WordLang, Sources>> = {
  en: {
    clues: { 4: [c4aa, c4ab, c4ac, c4ad, c4ae], 5: [c5aa, c5ab, c5ac, c5ad] },
    pairs: { 4: p4, 5: p5 },
  },
};

/**
 * Letters a word may use: A–Z, plus Ñ (its own letter) for Spanish. Spanish words are stored
 * without accents (CAFÉ is CAFE), like the tiles and keyboard.
 */
const WORD_RE: Record<WordLang, RegExp> = { en: /^[A-Z]+$/, es: /^[A-ZÑ]+$/ };

export function parseClues(length: number, texts: readonly string[], lang: WordLang = 'en'): ClueBank {
  const bank: ClueBank = new Map();
  for (const text of texts) {
    for (const raw of text.split('\n')) {
      const line = raw.trim();
      if (!line || line.startsWith('#')) continue;
      const [word, ...clues] = line.split('|').map((s) => s.trim());
      const w = word.normalize('NFC').toUpperCase();
      if (w.length !== length || !WORD_RE[lang].test(w)) continue;
      const list = clues.filter(Boolean);
      if (!list.length) continue;
      const prev = bank.get(w);
      if (prev) prev.push(...list);
      else bank.set(w, list);
    }
  }
  return bank;
}

function sources(lang: WordLang): Sources {
  const src = SOURCES[lang];
  if (!src) throw new Error(`Crossclimb: ${lang} words are not loaded yet (call loadWords first)`);
  return src;
}

/** Whether the data for a word language is in memory (English always is). */
export function wordsLoaded(lang: WordLang): boolean {
  return !!SOURCES[lang];
}

let esLoading: Promise<void> | null = null;

/** Load the data for a word language; the Spanish vocabulary is its own chunk. */
export function loadWords(lang: WordLang): Promise<void> {
  if (SOURCES[lang]) return Promise.resolve();
  esLoading ??= import('./es').then(
    (m) => {
      SOURCES.es = { clues: m.CLUES, pairs: m.PAIRS };
    },
    (err) => {
      esLoading = null;
      throw err;
    },
  );
  return esLoading;
}

const cache = new Map<string, ClueBank>();

export function getClueBank(length: WordLength, lang: WordLang = 'en'): ClueBank {
  const key = `${lang}${length}`;
  let bank = cache.get(key);
  if (!bank) {
    bank = parseClues(length, sources(lang).clues[length], lang);
    cache.set(key, bank);
  }
  return bank;
}

/** A top/bottom rung pair: two related words (or a compound, top first) sharing one clue. */
export interface EndPair {
  top: string;
  bottom: string;
  clue: string;
}

export function parsePairs(length: number, text: string, lang: WordLang = 'en'): EndPair[] {
  const out: EndPair[] = [];
  for (const raw of text.split('\n')) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const [top, bottom, ...rest] = line.split('|').map((s) => s.trim());
    const clue = rest.join('|');
    const t = (top ?? '').normalize('NFC').toUpperCase();
    const b = (bottom ?? '').normalize('NFC').toUpperCase();
    if (t.length !== length || b.length !== length || !WORD_RE[lang].test(t + b) || !clue) continue;
    out.push({ top: t, bottom: b, clue });
  }
  return out;
}

const pairCache = new Map<string, EndPair[]>();

/** Curated end-rung pairs for a word length, in file order (deterministic). */
export function getPairs(length: WordLength, lang: WordLang = 'en'): EndPair[] {
  const key = `${lang}${length}`;
  let pairs = pairCache.get(key);
  if (!pairs) {
    pairs = parsePairs(length, sources(lang).pairs[length], lang);
    pairCache.set(key, pairs);
  }
  return pairs;
}
