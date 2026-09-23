/**
 * Offline "how close was that guess?" estimate for Pinpoint's end-of-round recap.
 *
 * No word vectors: every category carries a hand-written list of related concepts (data/near/*.ts,
 * closest first). A wrong guess is scored against four evidence sources, each with its own ceiling:
 *   - the accepted answers (partial token overlap, e.g. "games" vs "card games")  → up to 0.90
 *   - the related-concept list (rank 0 → 0.84, last → 0.56)                        → up to 0.84
 *   - the clue/member words ("piano" for Things with keys)                          → up to 0.50
 *   - umbrella classes that cover many members ("animals" when most clues are animals) → up to 0.70
 *   - sibling instances of such a class ("sandwich" when most clues are foods)         → up to 0.45
 *   - character trigram similarity to the answers (typo-ish near misses)            → up to 0.35
 * The best source wins, the runner-up adds a little, and wrong guesses are capped below 100.
 * Correct guesses (isMatch) are always 100.
 */
import { englishLexicon, type Lexicon } from './lexicon';
import { editDistance, englishMatcher, type Matchable, type Matcher } from './match';

export interface Scorable extends Matchable {
  words: readonly string[];
}

export type Temperature = 'correct' | 'hot' | 'warm' | 'cold';

export interface Closeness {
  /** 0–100; 100 only for a correct guess. */
  pct: number;
  temp: Temperature;
}

const W_ANSWER = 0.9;
const W_NEAR_TOP = 0.84;
const W_NEAR_BOTTOM = 0.56;
const W_MEMBER = 0.5;
const W_CHARS = 0.35;
const W_UMBRELLA_BASE = 0.3;
const W_UMBRELLA_SPAN = 0.4;
const W_SIBLING_BASE = 0.15;
const W_SIBLING_SPAN = 0.3;
const SIBLING_MIN = 0.5;
const WRONG_CAP = 95;

interface Tok {
  t: string;
  prefix: boolean;
}

/** Similarity between two stemmed tokens, 0–1. */
export function tokenSim(g: string, t: Tok): number {
  if (t.prefix) return g.startsWith(t.t) ? 1 : 0;
  if (g === t.t) return 1;
  const short = g.length < t.t.length ? g : t.t;
  const long = short === g ? t.t : g;
  // music / musical, but not play / playground
  if (short.length >= 4 && short.length >= 0.6 * long.length && long.startsWith(short)) return 0.85;
  const len = long.length;
  if (short.length >= 5 && editDistance(g, t.t, 1) <= 1) return 0.8;
  if (len >= 8 && editDistance(g, t.t, 2) <= 2) return 0.65;
  return 0;
}

/**
 * How well a guess's tokens cover a term: mostly "how much of the guess is on-topic" (precision),
 * partly "how much of the term the guess named" (coverage).
 */
function termScore(guess: string[], term: Tok[]): number {
  if (!guess.length || !term.length) return 0;
  let cov = 0;
  for (const t of term) cov += Math.max(0, ...guess.map((g) => tokenSim(g, t)));
  let prec = 0;
  for (const g of guess) prec += Math.max(0, ...term.map((t) => tokenSim(g, t)));
  cov /= term.length;
  prec /= guess.length;
  if (cov === 0 || prec === 0) return 0;
  return 0.65 * prec + 0.35 * cov;
}

/** Character trigram Dice coefficient on space-free cleaned strings. */
export function trigramSim(a: string, b: string): number {
  const grams = (s: string) => {
    const p = `  ${s} `;
    const m = new Map<string, number>();
    for (let i = 0; i + 3 <= p.length; i++) {
      const g = p.slice(i, i + 3);
      m.set(g, (m.get(g) ?? 0) + 1);
    }
    return m;
  };
  if (!a || !b) return 0;
  const A = grams(a);
  const B = grams(b);
  let inter = 0;
  let na = 0;
  let nb = 0;
  for (const v of A.values()) na += v;
  for (const v of B.values()) nb += v;
  for (const [g, v] of A) inter += Math.min(v, B.get(g) ?? 0);
  return (2 * inter) / (na + nb);
}

interface Compiled {
  answers: Tok[][];
  answerPhrases: string[];
  near: Tok[][];
  members: Tok[][];
  nearSrc: readonly string[];
}

function compileWith(m: Matcher, cache: WeakMap<object, Compiled>, cat: Scorable, near: readonly string[]): Compiled {
  let c = cache.get(cat);
  if (!c || c.nearSrc !== near) {
    const toks = (s: string): Tok[] => m.tokenize(s).map((t) => ({ t, prefix: false }));
    const answers = m.patternsFor(cat).map((p) => p.toks);
    c = {
      answers,
      answerPhrases: answers.map((a) => a.map((t) => t.t).join('')),
      near: near.map(toks).filter((t) => t.length),
      members: cat.words.map(toks).filter((t) => t.length),
      nearSrc: near,
    };
    cache.set(cat, c);
  }
  return c;
}

export function temperature(pct: number): Temperature {
  if (pct >= 100) return 'correct';
  if (pct >= 65) return 'hot';
  if (pct >= 35) return 'warm';
  return 'cold';
}

export interface Scorer {
  /** Raw 0–1 relatedness of a (wrong) guess. Exposed for tests/tuning. */
  relatedness(guess: string, cat: Scorable, near: readonly string[]): number;
  closeness(guess: string, cat: Scorable, near: readonly string[]): Closeness;
}

/** Bind the scoring pipeline to one language's matcher and umbrella lexicon. */
export function createScorer(m: Matcher, lex: Lexicon): Scorer {
  const cache = new WeakMap<object, Compiled>();

  /** Raw 0–1 relatedness of a (wrong) guess. Exposed for tests/tuning. */
  function relatedness(guess: string, cat: Scorable, near: readonly string[]): number {
    const g = m.tokenize(guess);
    if (!g.length) return 0;
    const c = compileWith(m, cache, cat, near);

    let answer = 0;
    for (const a of c.answers) answer = Math.max(answer, termScore(g, a));

    let nearBest = 0;
    const n = c.near.length;
    c.near.forEach((term, i) => {
      const level = n > 1 ? W_NEAR_TOP - ((W_NEAR_TOP - W_NEAR_BOTTOM) * i) / (n - 1) : W_NEAR_TOP;
      nearBest = Math.max(nearBest, termScore(g, term) * level);
    });

    let member = 0;
    let memberHits = 0;
    for (const mem of c.members) {
      const s = termScore(g, mem);
      if (s > 0.5) memberHits++;
      member = Math.max(member, s);
    }
    member = Math.min(1, member + 0.1 * Math.max(0, memberHits - 1));

    // Broad class guesses: best class-naming token, scaled by how much of the guess it is.
    let umbrella = 0;
    let classTokens = 0;
    const memberToks = c.members.map((mem) => mem.map((t) => t.t));
    for (const t of g) {
      const f = lex.umbrellaFraction(t, memberToks);
      if (f > 0) {
        classTokens++;
        umbrella = Math.max(umbrella, W_UMBRELLA_BASE + W_UMBRELLA_SPAN * f);
      }
    }
    umbrella *= Math.sqrt(classTokens / g.length);

    let sibling = 0;
    let siblingTokens = 0;
    for (const t of g) {
      const f = lex.siblingFraction(t, memberToks);
      if (f >= SIBLING_MIN) {
        siblingTokens++;
        sibling = Math.max(sibling, W_SIBLING_BASE + W_SIBLING_SPAN * f);
      }
    }
    sibling *= Math.sqrt(siblingTokens / g.length);

    const phrase = g.join('');
    let chars = 0;
    for (const p of c.answerPhrases) chars = Math.max(chars, trigramSim(phrase, p));

    const parts = [answer * W_ANSWER, nearBest, member * W_MEMBER, umbrella, sibling, chars * W_CHARS].sort((x, y) => y - x);
    const best = parts[0];
    return Math.min(1, best + 0.3 * parts[1] * (1 - best));
  }

  function closeness(guess: string, cat: Scorable, near: readonly string[]): Closeness {
    if (m.isMatch(guess, cat)) return { pct: 100, temp: 'correct' };
    const pct = Math.max(1, Math.min(WRONG_CAP, Math.round(relatedness(guess, cat, near) * 100)));
    return { pct, temp: temperature(pct) };
  }

  return { relatedness, closeness };
}

export const englishScorer: Scorer = createScorer(englishMatcher, englishLexicon);
export const { relatedness, closeness } = englishScorer;
