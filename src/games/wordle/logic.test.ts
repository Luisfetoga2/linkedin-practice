import { describe, expect, it } from 'vitest';
import {
  ANSWERS,
  hardModeError,
  isValidGuess,
  keyboardMarks,
  nextHintPosition,
  pickAnswer,
  scoreGuess,
  shareGrid,
  validGuesses,
  type Mark,
} from './logic';

const row = (word: string, answer: string) => ({ word, marks: scoreGuess(word, answer) });

describe('word lists', () => {
  it('has a curated answer list of the right size and shape', () => {
    expect(ANSWERS.length).toBeGreaterThanOrEqual(2000);
    expect(ANSWERS.length).toBeLessThanOrEqual(2500);
    for (const w of ANSWERS) expect(w).toMatch(/^[a-z]{5}$/);
    expect(new Set(ANSWERS).size).toBe(ANSWERS.length);
  });

  it('has a broad valid-guess list containing every answer', () => {
    const valid = validGuesses();
    expect(valid.size).toBeGreaterThan(12000);
    for (const w of ANSWERS) expect(valid.has(w)).toBe(true);
    for (const w of valid) expect(w).toMatch(/^[a-z]{5}$/);
  });

  it('accepts common words case-insensitively and rejects junk', () => {
    for (const w of ['crane', 'SLATE', 'Adieu', 'speed', 'abide', 'alley', 'level', 'cares', 'baked']) expect(isValidGuess(w)).toBe(true);
    for (const w of ['xxxxx', 'aeiou', 'qwert', 'abcde']) expect(isValidGuess(w)).toBe(false);
  });
});

describe('pickAnswer', () => {
  it('is deterministic per seed', () => {
    for (const seed of [1, 42, 123456, 2 ** 31 - 1]) expect(pickAnswer(seed)).toBe(pickAnswer(seed));
  });

  it('varies across seeds and always yields an answer', () => {
    const picks = new Set<string>();
    for (let s = 1; s <= 200; s++) {
      const w = pickAnswer(s * 7919);
      expect(ANSWERS).toContain(w);
      picks.add(w);
    }
    expect(picks.size).toBeGreaterThan(150);
  });
});

describe('scoreGuess', () => {
  const str = (m: Mark[]) => m.map((x) => (x === 'correct' ? 'G' : x === 'present' ? 'Y' : '-')).join('');

  it('marks exact matches', () => {
    expect(str(scoreGuess('crane', 'crane'))).toBe('GGGGG');
    expect(str(scoreGuess('fghij', 'crane'))).toBe('-----');
  });

  it('SPEED vs ABIDE: only one E is yellow', () => {
    // ABIDE has a single E (pos 5) and a D (pos 4). SPEED: E at 3,4 → first E yellow, second gray; D at 5 → yellow.
    expect(str(scoreGuess('speed', 'abide'))).toBe('--Y-Y');
  });

  it('ALLEY vs LEVEL: duplicate L handled by remaining counts', () => {
    // LEVEL has L×2, E×2, V. ALLEY: A gray, L yellow, L yellow, E green, Y gray.
    expect(str(scoreGuess('alley', 'level'))).toBe('-YYG-');
  });

  it('greens take priority over earlier yellows', () => {
    // ROBOT has two O's: one matched green, the other still available as a yellow.
    expect(str(scoreGuess('boost', 'robot'))).toBe('YGY-G');
    // SHALL has one A: the first A in PAPAL takes it, the second is gray.
    expect(str(scoreGuess('papal', 'shall'))).toBe('-Y--G');
    // THOSE has one E, matched green at the end, so earlier E's in GEESE are gray.
    expect(str(scoreGuess('geese', 'those'))).toBe('---GG');
    expect(str(scoreGuess('llama', 'hello'))).toBe('YY---');
    expect(str(scoreGuess('eerie', 'there'))).toBe('Y-Y-G');
  });
});

describe('hardModeError', () => {
  it('requires greens to stay in place', () => {
    const prev = [row('crane', 'shame')]; // A green (3rd), E green (5th)
    expect(hardModeError('slate', prev)).toBeNull();
    expect(hardModeError('steal', prev)).toBe('3rd letter must be A');
    expect(hardModeError('shams', prev)).toBe('5th letter must be E');
  });

  it('requires yellows to be reused', () => {
    const prev2 = [row('stare', 'crane')]; // S-,T-,A G,R Y,E G
    expect(hardModeError('blame', prev2)).toBe('Guess must contain R');
    expect(hardModeError('grace', prev2)).toBeNull();
  });

  it('counts duplicate revealed letters', () => {
    const prev = [row('alley', 'level')]; // two L's revealed
    expect(hardModeError('lathe', prev)).toBe('4th letter must be E');
    expect(hardModeError('label', prev)).toBeNull();
    expect(hardModeError('ruled', prev)).toBe('Guess must contain L');
    expect(hardModeError('lower', prev)).toBe('Guess must contain L');
    expect(hardModeError('libel', prev)).toBeNull();
  });

  it('ignores gray letters and is fine with no history', () => {
    expect(hardModeError('xxxxx', [])).toBeNull();
    expect(hardModeError('crane', [row('fghij', 'crane')])).toBeNull();
  });
});

describe('keyboardMarks / share / hints', () => {
  it('keeps the best-known color per letter', () => {
    const k = keyboardMarks([row('speed', 'abide'), row('abide', 'abide')]);
    expect(k.e).toBe('correct');
    expect(k.s).toBe('absent');
    expect(k.d).toBe('correct');
  });

  it('builds the emoji grid', () => {
    expect(shareGrid([scoreGuess('alley', 'level'), scoreGuess('level', 'level')])).toBe('⬛🟨🟨🟩⬛\n🟩🟩🟩🟩🟩');
    expect(shareGrid([scoreGuess('stare', 'crane')], true)).toBe('⬛⬛🟧🟦🟧');
  });

  it('hints unknown positions deterministically', () => {
    const answer = 'crane';
    const rows = [row('stare', answer)]; // A (2) and E (4) known
    const a = nextHintPosition(9, answer, rows, []);
    expect(a).toBe(nextHintPosition(9, answer, rows, []));
    expect([0, 1, 3]).toContain(a);
    const b = nextHintPosition(9, answer, rows, [a!]);
    expect(b).not.toBe(a);
    expect([0, 1, 3]).toContain(b);
    expect(nextHintPosition(9, answer, [row('crane', answer)], [])).toBeNull();
  });
});
