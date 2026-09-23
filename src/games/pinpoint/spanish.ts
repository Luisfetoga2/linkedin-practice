/** Spanish Pinpoint content, loaded on demand (see content.ts). */
import type { Content } from './content';
import { createScorer } from './closeness';
import { CATEGORIES_ES } from './data.es';
import { spanishLexicon } from './lexicon.es';
import { spanishMatcher } from './match.es';
import { nearForEs } from './near.es';

export const ES_CONTENT: Content = {
  categories: CATEGORIES_ES,
  matcher: spanishMatcher,
  scorer: createScorer(spanishMatcher, spanishLexicon),
  nearFor: nearForEs,
};
