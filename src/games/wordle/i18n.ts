import { defineStrings } from '../../lib/i18n';

const EN_ORD = ['1st', '2nd', '3rd', '4th', '5th'];
/** Spanish feminine ordinal abbreviation ("letra" is feminine): 1.ª, 2.ª… */
const esOrd = (i: number) => `${i + 1}.ª`;

export const STR = defineStrings(
  {
    notEnoughLetters: 'Not enough letters',
    notInList: 'Not in word list',
    /** Hard mode, `index` is 0-based. */
    mustBeAt: (index: number, letter: string) => `${EN_ORD[index]} letter must be ${letter}`,
    mustContain: (letter: string) => `Guess must contain ${letter}`,
    praise: ['Genius', 'Magnificent', 'Impressive', 'Splendid', 'Great', 'Phew'],
    wordWas: 'The word was',
    hint: 'Hint',
    hintPill: (index: number) => `${EN_ORD[index]} letter`,
    hintPillAria: (index: number, letter: string) => `Position ${index + 1} is ${letter}`,
    board: 'Wordle board',
    row: (n: number) => `Row ${n}`,
    empty: 'empty',
    hintTile: (letter: string) => `hint ${letter}`,
    marks: { correct: 'correct', present: 'in the word', absent: 'not in the word' },
    keyboard: 'Keyboard',
    enter: 'Enter',
    enterAria: 'Enter',
    backspace: 'Backspace',
    loadingWords: 'Loading words…',
    loadFailed: 'Couldn’t load the word list.',
    retry: 'Try again',
  },
  {
    notEnoughLetters: 'Faltan letras',
    notInList: 'No está en la lista de palabras',
    mustBeAt: (index: number, letter: string) => `La ${esOrd(index)} letra debe ser ${letter}`,
    mustContain: (letter: string) => `Debe incluir la ${letter}`,
    praise: ['¡Genial!', '¡Magnífico!', '¡Impresionante!', '¡Espléndido!', '¡Muy bien!', '¡Uf, por poco!'],
    wordWas: 'La palabra era',
    hint: 'Pista',
    hintPill: (index: number) => `${esOrd(index)} letra`,
    hintPillAria: (index: number, letter: string) => `La posición ${index + 1} es ${letter}`,
    board: 'Tablero de Wordle',
    row: (n: number) => `Fila ${n}`,
    empty: 'vacía',
    hintTile: (letter: string) => `pista ${letter}`,
    marks: { correct: 'correcta', present: 'está en la palabra', absent: 'no está en la palabra' },
    keyboard: 'Teclado',
    // The key cap stays "Enter", as printed on Latin American keyboards; screen readers hear "Enviar".
    enter: 'Enter',
    enterAria: 'Enviar',
    backspace: 'Borrar',
    loadingWords: 'Cargando palabras…',
    loadFailed: 'No se pudo cargar la lista de palabras.',
    retry: 'Reintentar',
  },
);

export type WordleStrings = (typeof STR)['en'];
