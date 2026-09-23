/**
 * Spanish answer matching for Pinpoint. Same pipeline as the English matcher (match.ts), with
 * Spanish normalization, filler words and a light plural/gender stemmer:
 *   lowercase → strip accents (á é í ó ú ü) but keep ñ → drop filler ("cosas que", "tipos de", "la"...)
 *   → stem ("flores" = "flor", "luces" = "luz", "países" = "país", "rojas" = "rojo").
 * Typo tolerance is the English one, applied per word (see MatcherConfig.strictPhrase); in addition, tokens of 3+ letters also compare with ñ folded to n
 * ("montana" finds "montaña").
 */
import { createMatcher, type Matcher } from './match';

const FILLER = new Set(
  (
    'cosa cosas objeto objetos tipo tipos clase clases variedad variedades palabra palabras termino terminos ' +
    'que cual cuales quien quienes de del la las el los lo un una unos unas y e o u ni con en a al por ' +
    'se su sus le les me te nos mi mis tu tus si ' +
    'es son ser esta estan estar fue era hay tiene tienen tener tienes lleva llevan llevar ' +
    'puede pueden puedes poder podemos suele suelen sirve sirven ' +
    'famoso famosa famosos famosas conocido conocida conocidos conocidas celebre celebres ' +
    'algo alguien algun alguna algunos algunas varios varias cierto cierta ciertos ciertas ' +
    'ejemplo ejemplos lista comun comunes popular populares ' +
    'diferente diferentes distinto distinta distintos distintas muy mas ' +
    'usa usan usar usado usada usados usadas hecho hecha hechos hechas llamado llamados llamadas ' +
    'todo toda todos todas cada cualquier otro otra otros otras tambien ' +
    'este estos estas ese esa esos esas eso esto aquel aquella ' +
    'relacionado relacionada relacionados relacionadas asociado asociada asociados asociadas ' +
    'categoria categorias encuentra encuentran encontrar ver ves'
  ).split(' '),
);

/** Lowercase, strip accents and punctuation, keep ñ. Keeps `*` only when asked (answer patterns). */
export function cleanEs(s: string, keepStar = false): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/ñ/g, 'ñ')
    .replace(/[̀-ͯ]/g, '')
    .replace(/&/g, ' y ')
    .replace(/['’‘`´]/g, '')
    .replace(keepStar ? /[^a-z0-9ñ*]+/g : /[^a-z0-9ñ]+/g, ' ')
    .trim();
}

/**
 * Light, symmetric Spanish stemmer: plural -s/-es/-ces, final -e after a consonant, and the
 * gender vowel, so singular/plural and masculine/feminine forms meet. Not linguistically exact.
 */
export function stemEs(word: string): string {
  let w = word;
  if (w.length <= 2 || /^\d+$/.test(w)) return w;
  if (w.endsWith('z')) w = w.slice(0, -1) + 'c'; // luz ~ luces, lápiz ~ lápices
  if (w.endsWith('s')) w = w.slice(0, -1); // perros, flores, luces
  if (w.length >= 4 && /[^aeiou]e$/.test(w)) w = w.slice(0, -1); // flore → flor, luce → luc, dulce → dulc
  if (w.length >= 3 && w.endsWith('s')) w = w.slice(0, -1); // países → pais → pai (= país)
  if (w.length >= 4 && /[aeo]$/.test(w)) w = w.slice(0, -1); // roja / rojo → roj
  return w;
}

/** ñ → n, for lenient comparison only. */
export const foldEs = (s: string): string => s.replace(/ñ/g, 'n');

export const spanishMatcher: Matcher = createMatcher({ clean: cleanEs, filler: FILLER, stem: stemEs, fold: foldEs, strictPhrase: true });
