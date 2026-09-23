/**
 * Lenient answer matching for Pinpoint.
 *
 * Both the player's guess and every accepted answer go through the same pipeline:
 *   lowercase → strip diacritics/punctuation → drop filler words ("things", "types of", "that", ...)
 *   → light stemming (plurals, -ed/-ing, trailing e) so "shuffled", "shuffle" and "shuffling" agree.
 * A guess is correct when, for any accepted answer:
 *   - every answer token appears in the guess (token-set match, tolerant of 1 typo on long words), or
 *   - the whole phrase is within a small edit distance (one swapped pair for ≤5 letters, ≤1 edit up to 9, else ≤2).
 * Answer tokens ending in `*` are prefixes (e.g. `contain*` matches "containing").
 */

const FILLER = new Set(
  (
    'things thing stuff item items object objects types type kinds kind sort sorts of words word terms term ' +
    'that which who whom what are is was were be been being can could a an the famous well known some ' +
    'you your one ones with has have having had and or in on at to for by from into it its all commonly ' +
    'often usually typically typical example examples list various different popular common blank ' +
    'find found see seen use used using made make makes get gets got something someone somebody called named ' +
    'do does they them their these those this there every any many also related associated involving i we ' +
    'category categories group'
  ).split(' '),
);

const VOWEL = /[aeiouy]/;

/** Light, symmetric stemmer. Not linguistically correct — only needs to map variants together. */
export function stem(word: string): string {
  let w = word;
  if (w.length <= 2 || /^\d+$/.test(w)) return w;
  // plurals
  if (w.length > 4 && w.endsWith('ies')) w = w.slice(0, -3) + 'y';
  else if (w.endsWith('sses')) w = w.slice(0, -2);
  else if (w.length > 4 && /(s|x|z|ch|sh)es$/.test(w)) w = w.slice(0, -2);
  else if (w.length > 3 && w.endsWith('s') && !/(ss|us|is)$/.test(w)) w = w.slice(0, -1);
  // verb endings
  let stripped = false;
  if (w.length > 4 && w.endsWith('ied')) w = w.slice(0, -3) + 'y';
  else if (w.length >= 5 && w.endsWith('ed') && w.length - 2 >= 3 && VOWEL.test(w.slice(0, -2))) {
    w = w.slice(0, -2);
    stripped = true;
  } else if (w.length >= 5 && w.endsWith('ing') && w.length - 3 >= 3 && VOWEL.test(w.slice(0, -3))) {
    w = w.slice(0, -3);
    stripped = true;
  }
  if (stripped && /([b-df-hj-kmnp-rtv-y])\1$/.test(w)) w = w.slice(0, -1);
  if (w.length >= 5 && w.endsWith('ie')) w = w.slice(0, -2) + 'y';
  if (w.length >= 4 && w.endsWith('e')) w = w.slice(0, -1);
  if (w.length >= 3 && w.endsWith('v')) w = w.slice(0, -1) + 'f';
  return w;
}

/** Lowercase, strip accents and punctuation. Keeps `*` only when asked (answer patterns). */
export function clean(s: string, keepStar = false): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/['’‘`]/g, '')
    .replace(keepStar ? /[^a-z0-9*]+/g : /[^a-z0-9]+/g, ' ')
    .trim();
}

/** Optimal string alignment distance (Levenshtein + adjacent transpositions), early-exit above `max`. */
export function editDistance(a: string, b: string, max = Infinity): number {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  const n = a.length;
  const m = b.length;
  let prev2 = new Array<number>(m + 1).fill(0);
  let prev = Array.from({ length: m + 1 }, (_, j) => j);
  let cur = new Array<number>(m + 1).fill(0);
  for (let i = 1; i <= n; i++) {
    cur[0] = i;
    let rowMin = cur[0];
    for (let j = 1; j <= m; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      let v = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) v = Math.min(v, prev2[j - 2] + 1);
      cur[j] = v;
      if (v < rowMin) rowMin = v;
    }
    if (rowMin > max) return max + 1;
    [prev2, prev, cur] = [prev, cur, prev2];
  }
  return prev[m];
}

/** Short words must be exact apart from one swapped pair ("kyes"); longer ones allow 1–2 edits. */
function closeEnough(a: string, b: string): boolean {
  if (a === b) return true;
  const len = Math.max(a.length, b.length);
  if (len <= 5) {
    if (a.length !== b.length) return false;
    const diff: number[] = [];
    for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) diff.push(i);
    return diff.length === 2 && diff[1] === diff[0] + 1 && a[diff[0]] === b[diff[1]] && a[diff[1]] === b[diff[0]];
  }
  const max = len <= 9 ? 1 : 2;
  return editDistance(a, b, max) <= max;
}

export interface PatternToken {
  t: string;
  prefix: boolean;
}
export interface Pattern {
  toks: PatternToken[];
  phrase: string;
  hasPrefix: boolean;
}

export interface Matchable {
  name: string;
  accept: readonly string[];
}

/** Language-specific pieces of the pipeline. */
export interface MatcherConfig {
  /** Lowercase, strip accents and punctuation; keeps `*` when asked (answer patterns). */
  clean(s: string, keepStar?: boolean): string;
  filler: ReadonlySet<string>;
  stem(word: string): string;
  /**
   * Optional lenient fold applied when comparing tokens of 3+ letters (Spanish: ñ → n, so
   * "montana" still finds "montaña"). Identity when omitted.
   */
  fold?(s: string): string;
  /**
   * Whole-phrase typo tolerance per token instead of on the joined phrase: the guess must have the
   * same number of tokens, each within typo range of the answer's. Stops "dichos con oso" passing for
   * "dichos con ojo" when the distinguishing word is short. Off for English (original behaviour).
   */
  strictPhrase?: boolean;
}

export interface Matcher {
  clean(s: string, keepStar?: boolean): string;
  stem(word: string): string;
  /** Guess → meaningful stemmed tokens. */
  tokenize(s: string): string[];
  compilePattern(answer: string): Pattern | null;
  patternsFor(cat: Matchable): Pattern[];
  /** True when the guess has at least one meaningful (non-filler) token. */
  isMeaningful(guess: string): boolean;
  isMatch(guess: string, cat: Matchable): boolean;
}

export function createMatcher(cfg: MatcherConfig): Matcher {
  const { clean, filler, stem } = cfg;
  const fold = cfg.fold;
  const same = (a: string, b: string) => a === b || (!!fold && a.length >= 3 && b.length >= 3 && fold(a) === fold(b));

  const tokenize = (s: string): string[] =>
    clean(s)
      .split(' ')
      .filter((t) => t && !filler.has(t))
      .map(stem);

  function compilePattern(answer: string): Pattern | null {
    const toks: PatternToken[] = [];
    for (const raw of clean(answer, true).split(' ')) {
      if (!raw) continue;
      if (raw.endsWith('*')) {
        const p = raw.replace(/\*+$/, '');
        if (p) toks.push({ t: p, prefix: true });
        continue;
      }
      const r = raw.replace(/\*/g, '');
      if (!r || filler.has(r)) continue;
      toks.push({ t: stem(r), prefix: false });
    }
    if (!toks.length) return null;
    return { toks, phrase: toks.map((x) => x.t).join(''), hasPrefix: toks.some((x) => x.prefix) };
  }

  function tokenMatches(g: string, p: PatternToken): boolean {
    if (p.prefix) return g.startsWith(p.t) || (!!fold && p.t.length >= 3 && fold(g).startsWith(fold(p.t)));
    if (same(g, p.t)) return true;
    return g.length >= 6 && p.t.length >= 6 && editDistance(fold ? fold(g) : g, fold ? fold(p.t) : p.t, 1) <= 1;
  }

  /** Per-category compiled pattern cache (categories are module constants). */
  const cache = new WeakMap<object, Pattern[]>();
  function patternsFor(cat: Matchable): Pattern[] {
    let ps = cache.get(cat);
    if (!ps) {
      ps = [cat.name, ...cat.accept].map(compilePattern).filter((p): p is Pattern => p !== null);
      cache.set(cat, ps);
    }
    return ps;
  }

  function isMatch(guess: string, cat: Matchable): boolean {
    const g = tokenize(guess);
    if (!g.length) return false;
    const gPhrase = g.join('');
    for (const p of patternsFor(cat)) {
      // Token-set match. Cap extra tokens so "animals colors planets keys" can't spray-match everything.
      if (g.length <= p.toks.length + 3 && p.toks.every((pt) => g.some((gt) => tokenMatches(gt, pt)))) return true;
      if (p.hasPrefix) continue;
      if (cfg.strictPhrase) {
        const f = fold ?? ((x: string) => x);
        if (f(gPhrase) === f(p.phrase)) return true;
        if (g.length === p.toks.length && p.toks.every((pt, i) => closeEnough(f(g[i]), f(pt.t)))) return true;
      } else if (closeEnough(gPhrase, p.phrase) || (fold && gPhrase.length >= 3 && closeEnough(fold(gPhrase), fold(p.phrase)))) {
        return true;
      }
    }
    return false;
  }

  return {
    clean,
    stem,
    tokenize,
    compilePattern,
    patternsFor,
    isMeaningful: (guess) => tokenize(guess).length > 0,
    isMatch,
  };
}

/** The English matcher (the original Pinpoint pipeline). */
export const englishMatcher: Matcher = createMatcher({ clean, filler: FILLER, stem });

export const { tokenize, compilePattern, patternsFor, isMeaningful, isMatch } = englishMatcher;
