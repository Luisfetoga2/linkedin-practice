import wordplay from './data/wordplay';
import things from './data/things';
import knowledge from './data/knowledge';
import culture from './data/culture';

export interface Category {
  /** Display name, e.g. "Things with keys". Always an accepted answer. */
  name: string;
  /** Member words, stored roughly from most ambiguous to most obvious. */
  words: string[];
  /** Extra accepted phrasings (matched leniently, see match.ts). */
  accept: string[];
}

function parse(src: string): Category[] {
  const out: Category[] = [];
  for (const raw of src.split('\n')) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const [name, words = '', accept = ''] = line.split('|');
    out.push({
      name: name.trim(),
      words: words
        .split(',')
        .map((w) => w.trim())
        .filter(Boolean),
      accept: accept
        .split(';')
        .map((a) => a.trim())
        .filter(Boolean),
    });
  }
  return out;
}

export const CATEGORIES: readonly Category[] = [wordplay, things, knowledge, culture].flatMap(parse);
