import { CATEGORIES, type Category } from './data';
import { englishMatcher, type Matcher } from './match';
import { englishScorer, type Scorer } from './closeness';
import { nearFor } from './near';

export type WordLang = 'en' | 'es';

/** Everything a round needs for one content language: categories, answer matching and closeness. */
export interface Content {
  categories: readonly Category[];
  matcher: Matcher;
  scorer: Scorer;
  nearFor(name: string): readonly string[];
}

export const EN_CONTENT: Content = { categories: CATEGORIES, matcher: englishMatcher, scorer: englishScorer, nearFor };

let esContent: Content | null = null;
let esLoading: Promise<Content> | null = null;

export function contentIfLoaded(lang: WordLang): Content | null {
  return lang === 'es' ? esContent : EN_CONTENT;
}

/** Load the content for a word language; the Spanish data is its own chunk. */
export function loadContent(lang: WordLang): Promise<Content> {
  if (lang === 'en') return Promise.resolve(EN_CONTENT);
  if (esContent) return Promise.resolve(esContent);
  esLoading ??= import('./spanish').then(
    (m) => (esContent = m.ES_CONTENT),
    (err) => {
      esLoading = null;
      throw err;
    },
  );
  return esLoading;
}
