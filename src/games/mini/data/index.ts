import { ENTRIES as EN } from './en';
import type { ClueEntry } from './types';

/** Language of the puzzle words (the `words` option), independent of the UI language. */
export type WordLang = 'en' | 'es';

// The Spanish vocabulary is its own chunk, loaded only when the Words option is Spanish. A glob
// (instead of a plain import()) keeps the game working even while ./es doesn't exist yet.
const ES = import.meta.glob<{ ENTRIES: ClueEntry[] }>('./es/index.ts');

/** Thrown by loadEntries when a word language has no data in this build. */
export class WordsUnavailable extends Error {}

const loaded: Partial<Record<WordLang, ClueEntry[]>> = { en: EN };
let esLoading: Promise<ClueEntry[]> | null = null;

/** The word list if it's already in memory (English always is). */
export function entriesIfLoaded(lang: WordLang): ClueEntry[] | null {
  return loaded[lang] ?? null;
}

export function loadEntries(lang: WordLang): Promise<ClueEntry[]> {
  const have = loaded[lang];
  if (have) return Promise.resolve(have);
  const load = ES['./es/index.ts'];
  if (!load) return Promise.reject(new WordsUnavailable(`Mini: no ${lang} word list`));
  esLoading ??= load().then(
    (m) => {
      if (!m.ENTRIES?.length) throw new WordsUnavailable('Mini: empty es word list');
      loaded.es = m.ENTRIES;
      return m.ENTRIES;
    },
    (err) => {
      esLoading = null;
      throw err;
    },
  );
  return esLoading;
}
