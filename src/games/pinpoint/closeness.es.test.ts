import { describe, expect, it } from 'vitest';
import type { Category } from './data';
import { temperature } from './closeness';
import { ES_CONTENT } from './spanish';

const { categories: CATEGORIES, matcher, scorer, nearFor } = ES_CONTENT;

function cat(name: string): Category {
  const c = CATEGORIES.find((x) => x.name === name);
  if (!c) throw new Error(`missing category ${name}`);
  return c;
}
const score = (guess: string, name: string) => scorer.closeness(guess, cat(name), nearFor(name)).pct;

/** [category, related guesses (should be warm/hot), unrelated guesses (should be cold)] */
const cases: [string, string[], string[]][] = [
  ['Cosas con teclas', ['instrumentos musicales', 'instrumentos', 'computadoras', 'botones', 'música'], ['planetas', 'sándwiches', 'fútbol', 'animales']],
  ['Cosas con llave', ['cerraduras', 'candados', 'puertas', 'cosas que se cierran'], ['frutas', 'planetas', 'colores']],
  ['Planetas', ['estrellas', 'espacio', 'dioses romanos', 'astronomía'], ['queso', 'zapatos', 'fútbol']],
  ['Quesos', ['lácteos', 'leche', 'productos lácteos', 'comida'], ['planetas', 'carros', 'cantantes']],
  ['Felinos', ['gatos', 'animales', 'animales salvajes', 'perros'], ['colores', 'herramientas']],
  ['Frutas tropicales', ['frutas', 'frutas exóticas', 'comida', 'mango'], ['herramientas', 'deportes']],
  ['Capitales de Sudamérica', ['capitales', 'ciudades', 'países de sudamérica', 'sudamérica'], ['instrumentos', 'emociones']],
  ['Cosas que se pueden romper', ['quebrar', 'cosas frágiles', 'vidrio', 'destruir'], ['frutas', 'planetas', 'ríos']],
  ['___ de mesa', ['juegos', 'muebles', 'comedor', 'silla'], ['planetas', 'ríos']],
  ['Formas de decir dinero', ['monedas', 'jerga', 'sinónimos', 'billetes'], ['planetas', 'reptiles']],
  ['Personajes de El Chavo del 8', ['personajes', 'televisión', 'comedia', 'chapulín colorado'], ['planetas', 'frutas']],
  ['Instrumentos de viento', ['instrumentos', 'música', 'orquesta', 'instrumentos de cuerda'], ['frutas', 'planetas']],
  ['Razas de perro', ['animales', 'mascotas', 'gatos'], ['planetas', 'herramientas']],
];

describe('pinpoint Spanish closeness', () => {
  it('scores the name and every accepted answer as 100 / correct', () => {
    for (const c of CATEGORIES) {
      for (const a of [c.name, ...c.accept.filter((x) => !x.includes('*'))]) {
        expect(scorer.closeness(a, c, nearFor(c.name)), `${c.name}: ${a}`).toEqual({ pct: 100, temp: 'correct' });
      }
    }
  });

  for (const [name, related, unrelated] of cases) {
    it(`ranks related guesses above unrelated ones for ${name}`, () => {
      const lo = Math.min(...related.map((g) => score(g, name)));
      const hi = Math.max(...unrelated.map((g) => score(g, name)));
      for (const g of related) {
        const s = score(g, name);
        expect(s, `${g} → ${s}`).toBeGreaterThanOrEqual(35);
        expect(s, `${g} → ${s}`).toBeLessThan(100);
      }
      for (const g of unrelated) expect(score(g, name), g).toBeLessThanOrEqual(25);
      expect(lo).toBeGreaterThan(hi);
    });
  }

  it('an answer-adjacent guess beats a merely topical one', () => {
    expect(score('cosas que se cierran', 'Cosas con llave')).toBeGreaterThan(score('puertas', 'Cosas con llave'));
    expect(score('capitales', 'Capitales de Sudamérica')).toBeGreaterThan(score('ciudades', 'Capitales de Sudamérica'));
  });

  it('accent-free and ñ-less spellings score like the accented ones', () => {
    expect(score('lacteos', 'Quesos')).toBe(score('lácteos', 'Quesos'));
    expect(score('astronomia', 'Planetas')).toBe(score('astronomía', 'Planetas'));
  });

  it('never gives a wrong guess 100', () => {
    for (const c of CATEGORIES) {
      for (const w of c.words) {
        if (matcher.isMatch(w, c)) continue;
        expect(scorer.closeness(w, c, nearFor(c.name)).pct, `${c.name}: ${w}`).toBeLessThan(100);
      }
    }
  });

  it('is deterministic and maps to temperatures', () => {
    expect(score('instrumentos musicales', 'Cosas con teclas')).toBe(score('instrumentos musicales', 'Cosas con teclas'));
    expect(temperature(score('planetas', 'Cosas con teclas'))).toBe('cold');
    expect(temperature(score('instrumentos musicales', 'Cosas con teclas'))).toBe('hot');
  });
});
