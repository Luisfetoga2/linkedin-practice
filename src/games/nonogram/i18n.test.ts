import { describe, expect, it } from 'vitest';
import { STR, hintMessage, pictureName } from './i18n';
import type { NonogramHint } from './logic';

describe('nonogram strings', () => {
  it('English and Spanish tables have the same keys', () => {
    expect(Object.keys(STR.es).sort()).toEqual(Object.keys(STR.en).sort());
  });

  it('words hints like before in English, and in Spanish', () => {
    const en = STR.en;
    const es = STR.es;
    expect(hintMessage(en, { kind: 'mistake', cell: 0, value: 0 })).toBe('This square shouldn’t be filled.');
    expect(hintMessage(en, { kind: 'mistake', cell: 0, value: 1 })).toBe('This square should be filled, not crossed out.');
    expect(hintMessage(en, { kind: 'reveal', cell: 0, value: 1 })).toBe('This square is filled.');
    const fill: NonogramHint = { kind: 'deduce', cell: 0, value: 1, line: { kind: 'row', index: 2, clue: [2, 1] } };
    const cross: NonogramHint = { kind: 'deduce', cell: 0, value: 0, line: { kind: 'col', index: 0, clue: [] } };
    expect(hintMessage(en, fill)).toBe('Row 3 (2 1) must fill this square.');
    expect(hintMessage(en, cross)).toBe('Column 1 (0) can’t use this square, so it gets an ✕.');
    expect(hintMessage(es, fill)).toBe('La fila 3 (2 1) tiene que usar esta casilla.');
    expect(hintMessage(es, cross)).toBe('La columna 1 (0) no puede usar esta casilla, así que lleva una ✕.');
    expect(hintMessage(es, { kind: 'mistake', cell: 0, value: 0 })).toBe('Esta casilla no debería estar rellena.');
  });

  it('uses the stored Spanish article and the English a/an rule', () => {
    expect(pictureName({ name: 'house', nameEs: 'una casa' }, 'es')).toEqual({ article: 'una', noun: 'casa' });
    expect(pictureName({ name: 'cat', nameEs: 'un gato' }, 'es')).toEqual({ article: 'un', noun: 'gato' });
    expect(pictureName({ name: 'coffee cup', nameEs: 'una taza de café' }, 'es')).toEqual({ article: 'una', noun: 'taza de café' });
    expect(pictureName({ name: 'owl', nameEs: 'un búho' }, 'en')).toEqual({ article: 'an', noun: 'owl' });
    expect(pictureName({ name: 'cat', nameEs: 'un gato' }, 'en')).toEqual({ article: 'a', noun: 'cat' });
    expect(pictureName({}, 'es')).toBeNull();
  });
});
