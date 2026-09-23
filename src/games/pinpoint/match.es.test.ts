import { describe, expect, it } from 'vitest';
import { CATEGORIES_ES } from './data.es';
import type { Category } from './data';
import { cleanEs, stemEs, spanishMatcher } from './match.es';
import { englishMatcher } from './match';

const { isMatch, isMeaningful, tokenize } = spanishMatcher;

function cat(name: string): Category {
  const c = CATEGORIES_ES.find((x) => x.name === name);
  if (!c) throw new Error(`missing category ${name}`);
  return c;
}

const cases: [string, string[], string[]][] = [
  [
    'Cosas con llave',
    ['llaves', 'Llave', 'cosas con llave', 'cosas que tienen llave', 'objetos con llaves', '¡LLAVES!', 'lalves', 'cosas que se cierran con llave'],
    ['cerraduras', 'candado', 'puertas', 'cosas', 'llavero', 'teclas'],
  ],
  [
    'Cosas que se pueden romper',
    ['romper', 'cosas que se pueden romper', 'se rompen', 'rompible', 'cosas rompibles', 'cosas rotas', 'romperse', 'cosas que se rompen'],
    ['quebrar', 'vidrio', 'frágil', 'cosas frágiles'],
  ],
  [
    'Frutas tropicales',
    ['frutas tropicales', 'fruta tropical', 'tropicales', 'FRUTAS TROPICALES', 'frutas tropicles', 'frutas del trópico tropicales'],
    ['frutas', 'mango', 'trópico', 'frutas exóticas'],
  ],
  [
    'Capitales de Sudamérica',
    ['capitales de sudamérica', 'capitales sudamericanas', 'Capitales de Sudamerica', 'capital sudamericana', 'capitales de américa del sur'],
    ['capitales', 'ciudades', 'sudamérica', 'países de sudamérica', 'capitales europeas'],
  ],
  [
    'Países de Sudamérica',
    ['Sudamérica', 'países de sudamérica', 'paises sudamericanos', 'América del Sur', 'suramérica', 'país sudamericano'],
    ['países', 'américa', 'europa', 'países de centroamérica'],
  ],
  [
    'Animales escondidos',
    ['animales escondidos', 'animales ocultos', 'palabras que contienen animales', 'contiene un animal', 'animal escondido', 'animales', 'esconden animales'],
    ['escondidos', 'palabras', 'zapatos', 'mascotas'],
  ],
  [
    'Palíndromos',
    ['palíndromos', 'palindromo', 'capicúa', 'se lee igual al revés', 'palabras que se leen igual al reves', 'palindormos'],
    ['al revés', 'palabras', 'anagramas', 'simétricas'],
  ],
  [
    'Formas de decir dinero',
    ['dinero', 'formas de decir dinero', 'sinónimos de dinero', 'jerga para dinero', 'modismos del dinero', 'DINERO'],
    ['plata', 'billetes', 'monedas', 'lana', 'formas'],
  ],
  ['Tres ___', ['tres', '3', 'palabras después de tres', 'tres ___', 'Tres'], ['trece', 'números', 'reyes', 'siete']],
  ['___ de mesa', ['mesa', 'de mesa', 'cosas de mesa', '___ de mesa', 'mesas', 'palabras antes de mesa'], ['juegos', 'silla', 'mesero', 'mes', 'meses']],
  ['Para___', ['para', 'Para___', 'palabras que empiezan con para', 'para-'], ['paraguas', 'sol', 'parabrisas']],
  ['Cosas de color rojo', ['rojo', 'cosas rojas', 'cosas de color rojo', 'rojas', 'color rojo', 'Roja'], ['colores', 'sangre', 'verde', 'rosa']],
  ['Personajes de El Chavo del 8', ['el chavo', 'chavo del 8', 'personajes del chavo', 'chavo del ocho', 'Chespirito', 'El Chavo del Ocho'], ['personajes', 'televisión', 'caricaturas', 'vecinos']],
  ['Cosas que se pueden echar', ['echar', 'cosas que se echan', 'se pueden echar', 'echarse'], ['tirar', 'botar', 'lanzar']],
  ['Homófonos', ['homófonos', 'suenan igual', 'palabras que suenan igual', 'homófonas', 'se pronuncian igual'], ['sinónimos', 'rimas', 'antónimos']],
  ['Riman con corazón', ['riman con corazón', 'rimas', 'rima con corazon', 'terminan en on', 'riman'], ['corazón', 'canciones', 'amor']],
  ['Chiles mexicanos', ['chiles', 'chiles mexicanos', 'ají', 'ajíes', 'chile', 'Chile mexicano'], ['picante', 'salsas', 'méxico', 'pimienta']],
  ['Nombres de mujer que son palabras', ['nombres de mujer', 'nombres femeninos', 'nombres', 'nombres de niña'], ['mujeres', 'palabras', 'flores']],
  ['Cosas con alas', ['alas', 'ala', 'cosas con alas', 'cosas aladas', 'Tienen alas'], ['aves', 'volar', 'pájaros', 'plumas']],
  ['Montañas de los Andes', ['montañas de los andes', 'montanas de los andes', 'andes', 'Cerros de los Andes'], ['montañas', 'volcanes', 'cordilleras']],
  ['Formas de decir niño', ['niños', 'ninos', 'formas de decir niño', 'Niña', 'chicos'], ['bebés', 'jóvenes', 'hijos']],
  ['Cosas que se pueden encender', ['encender', 'cosas que se encienden', 'se pueden prender', 'prender', 'encendidas'], ['luces', 'apagar', 'fuego']],
  ['Dioses griegos', ['dioses griegos', 'Dios griego', 'griegos', 'mitología griega', 'Olimpo'], ['dioses', 'mitología', 'dioses romanos', 'Grecia']],
  ['Signos del zodiaco', ['zodiaco', 'signos del zodíaco', 'horóscopo', 'signos zodiacales', 'astrología'], ['signos', 'estrellas', 'constelaciones']],
  ['Cosas con ojos', ['ojos', 'ojo', 'cosas con ojos', 'tienen ojos'], ['ojeras', 'caras', 'animales']],
  ['Cosas hechas con papa', ['papa', 'papas', 'hechas con papas', 'patatas', 'derivados de la papa'], ['comida', 'verduras', 'papaya']],
  ['Pokémon', ['pokémon', 'pokemon', 'pokemones', 'POKÉMON'], ['animales', 'videojuegos', 'caricaturas']],
  ['Palabras con las cinco vocales', ['cinco vocales', 'las 5 vocales', 'todas las vocales', 'palabras con todas las vocales', 'vocales'], ['consonantes', 'letras', 'cinco']],
];

describe('pinpoint Spanish answer matching', () => {
  for (const [name, yes, no] of cases) {
    const c = cat(name);
    for (const g of yes) it(`"${g}" matches ${name}`, () => expect(isMatch(g, c)).toBe(true));
    for (const g of no) it(`"${g}" does not match ${name}`, () => expect(isMatch(g, c)).toBe(false));
  }

  it('does not let a typo-sized change swap the distinguishing short word', () => {
    expect(isMatch('dichos con oso', cat('Dichos con ojo'))).toBe(false);
    expect(isMatch('expresiones con pie', cat('Expresiones con pata'))).toBe(false);
    expect(isMatch('formas de decir pan', cat('Formas de decir auto'))).toBe(false);
    expect(isMatch('dichos con ojo', cat('Dichos con ojo'))).toBe(true);
    expect(isMatch('dichso con ojo', cat('Dichos con ojo'))).toBe(true);
  });

  it('rejects spray guesses that list many categories', () => {
    expect(isMatch('llaves planetas colores animales comida música', cat('Cosas con llave'))).toBe(false);
  });

  it('filler-only guesses are not meaningful', () => {
    expect(isMeaningful('')).toBe(false);
    expect(isMeaningful('cosas que son')).toBe(false);
    expect(isMeaningful('tipos de cosas')).toBe(false);
    expect(isMeaningful('las de los')).toBe(false);
    expect(isMeaningful('palabras famosas')).toBe(false);
    expect(isMeaningful('llaves')).toBe(true);
  });

  it('normalizes accents and ü but keeps ñ', () => {
    expect(cleanEs('Pingüino, ÑANDÚ y Canción!')).toBe('pinguino ñandu y cancion');
    expect(cleanEs('¿Qué?', true)).toBe('que');
    expect(cleanEs('contien*', true)).toBe('contien*');
    expect(tokenize('Los Niños de la montaña')).toEqual(['niñ', 'montañ']);
  });

  it('singularizes Spanish plurals and merges gender', () => {
    const same = (a: string, b: string) => expect(stemEs(cleanEs(a)), `${a} ~ ${b}`).toBe(stemEs(cleanEs(b)));
    same('flores', 'flor');
    same('luces', 'luz');
    same('lápices', 'lápiz');
    same('peces', 'pez');
    same('nueces', 'nuez');
    same('países', 'país');
    same('meses', 'mes');
    same('ingleses', 'inglés');
    same('japoneses', 'Japón');
    same('canciones', 'canción');
    same('animales', 'animal');
    same('ciudades', 'ciudad');
    same('reyes', 'rey');
    same('rubíes', 'rubí');
    same('dulces', 'dulce');
    same('nubes', 'nube');
    same('series', 'serie');
    same('perros', 'perra');
    same('rojas', 'rojo');
    same('osos', 'oso');
    expect(stemEs('flor')).not.toBe(stemEs('florero'));
    expect(stemEs('mesa')).not.toBe(stemEs('mes'));
  });

  it('leaves the English matcher untouched', () => {
    expect(englishMatcher.tokenize('Things with keys')).toEqual(['key']);
    expect(englishMatcher.isMeaningful('cosas')).toBe(true);
    expect(englishMatcher.tokenize('Crème Brûlée!')).toEqual(['crem', 'brule']);
    expect(englishMatcher.clean('niño')).toBe('nino');
  });
});
