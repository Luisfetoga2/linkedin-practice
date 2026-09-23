import { beforeAll, describe, expect, it } from 'vitest';
import {
  ANSWERS,
  displayAnswer,
  englishWords,
  hardModeError,
  hardModeViolation,
  keyToLetter,
  loadWordList,
  normalizeWord,
  isValidGuess,
  keyboardMarks,
  nextHintPosition,
  pickAnswer,
  scoreGuess,
  shareGrid,
  validGuesses,
  type Mark,
  type WordList,
} from './logic';
import { STR } from './i18n';
import { ES_ANSWERS_RAW } from './words-es';

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

describe('normalization', () => {
  it('uppercase/lowercase and accents collapse, Ñ stays its own letter', () => {
    expect(normalizeWord('ÁRBOL')).toBe('arbol');
    expect(normalizeWord('camión')).toBe('camion');
    expect(normalizeWord('pingüino')).toBe('pinguino');
    expect(normalizeWord('Éxito')).toBe('exito');
    expect(normalizeWord('AÑEJO')).toBe('añejo');
    expect(normalizeWord('niño')).not.toBe(normalizeWord('nino'));
    // Decomposed input (n + combining tilde) still becomes ñ.
    expect(normalizeWord('an\u0303o')).toBe('año');
  });

  it('maps physical keys per word list', () => {
    expect(keyToLetter('á', 'es')).toBe('a');
    expect(keyToLetter('Ü', 'es')).toBe('u');
    expect(keyToLetter('ñ', 'es')).toBe('ñ');
    expect(keyToLetter('Ñ', 'es')).toBe('ñ');
    expect(keyToLetter('ñ', 'en')).toBeNull();
    expect(keyToLetter('é', 'en')).toBe('e');
    expect(keyToLetter('Q', 'en')).toBe('q');
    for (const k of ['Dead', 'Enter', '1', ' ', 'ç']) expect(keyToLetter(k, 'es')).toBeNull();
  });
});

describe('Spanish word list', () => {
  let es: WordList;
  beforeAll(async () => {
    es = await loadWordList('es');
  });

  it('loads once and is cached', async () => {
    expect(await loadWordList('es')).toBe(es);
    expect(await loadWordList('en')).toBe(englishWords());
  });

  it('has curated normalized answers, all of them valid guesses', () => {
    expect(es.answers.length).toBeGreaterThanOrEqual(1400);
    expect(es.answers.length).toBeLessThanOrEqual(2500);
    expect(new Set(es.answers).size).toBe(es.answers.length);
    for (const w of es.answers) {
      expect(w).toMatch(/^[a-zñ]{5}$/);
      expect(es.valid.has(w)).toBe(true);
    }
    expect(es.valid.size).toBeGreaterThan(9000);
    for (const w of es.valid) expect(w).toMatch(/^[a-zñ]{5}$/);
    // Raw data: fixed-width 5-character display forms.
    expect(ES_ANSWERS_RAW.length).toBe(es.answers.length * 5);
  });

  it('accepts common words with or without accents and rejects junk', () => {
    for (const w of ['perro', 'ÁRBOL', 'arbol', 'Niños', 'jugar', 'queso', 'playa', 'huevo', 'señor', 'SEÑOR', 'comió', 'tengo', 'dimos', 'llave'])
      expect(isValidGuess(w, es), w).toBe(true);
    for (const w of ['xxxxx', 'aeiou', 'qwert', 'crane', 'senor', 'nino']) expect(isValidGuess(w, es)).toBe(false);
    // English list unaffected by Spanish-only words.
    expect(isValidGuess('perro')).toBe(false);
    expect(isValidGuess('crane')).toBe(true);
  });

  it('restores accents for display', () => {
    expect(displayAnswer('arbol', es)).toBe('ÁRBOL');
    expect(displayAnswer('perro', es)).toBe('PERRO');
    expect(displayAnswer('señor', es)).toBe('SEÑOR');
    expect(displayAnswer('crane')).toBe('CRANE');
  });

  it('picks answers deterministically per seed', () => {
    for (const seed of [1, 42, 123456, 2 ** 31 - 1]) {
      expect(pickAnswer(seed, es)).toBe(pickAnswer(seed, es));
      expect(es.answers).toContain(pickAnswer(seed, es));
    }
    const picks = new Set<string>();
    for (let s = 1; s <= 200; s++) picks.add(pickAnswer(s * 7919, es));
    expect(picks.size).toBeGreaterThan(150);
    // Same seed, different lists: English picks are unchanged by the Spanish list.
    expect(pickAnswer(42, englishWords())).toBe(pickAnswer(42));
  });

  it('scores Ñ as its own letter', () => {
    const str = (m: Mark[]) => m.map((x) => (x === 'correct' ? 'G' : x === 'present' ? 'Y' : '-')).join('');
    expect(str(scoreGuess('niños', 'niños'))).toBe('GGGGG');
    // N is not Ñ: "canon" vs "caños": C,A green; N absent (answer has Ñ, not N); O green; N absent.
    expect(str(scoreGuess('canon', 'caños'))).toBe('GG-G-');
    // Ñ in the wrong spot is yellow.
    expect(str(scoreGuess('ñandu', 'añejo'))).toBe('YY---');
    const k = keyboardMarks([row('añejo', 'niños'), row('canon', 'caños')]);
    expect(k['ñ']).toBe('present');
    expect(k.n).toBe('absent');
  });
});

describe('hard mode messages', () => {
  it('returns structured violations and localized text', () => {
    const prev = [row('crane', 'shame')];
    expect(hardModeViolation('steal', prev)).toEqual({ kind: 'position', index: 2, letter: 'A' });
    expect(hardModeError('steal', prev, STR.es)).toBe('La 3.ª letra debe ser A');
    const prev2 = [row('stare', 'crane')];
    expect(hardModeViolation('blame', prev2)).toEqual({ kind: 'contains', letter: 'R' });
    expect(hardModeError('blame', prev2, STR.es)).toBe('Debe incluir la R');
    expect(hardModeError('nieto', [row('añejo', 'niños')], STR.es)).toBe('Debe incluir la Ñ');
    expect(hardModeError('niños', [row('añejo', 'niños')], STR.es)).toBeNull();
  });
});

describe('strings', () => {
  it('English and Spanish tables have the same keys', () => {
    expect(Object.keys(STR.es).sort()).toEqual(Object.keys(STR.en).sort());
    expect(STR.es.praise.length).toBe(STR.en.praise.length);
    expect(STR.en.hintPill(1)).toBe('2nd letter');
    expect(STR.es.hintPill(1)).toBe('2.ª letra');
  });
});
