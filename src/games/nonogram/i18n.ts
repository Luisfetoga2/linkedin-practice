import { defineStrings, type Lang } from '../../lib/i18n';
import type { NonogramHint, NonogramPuzzle } from './logic';

type LineKind = 'row' | 'col';

export const STR = defineStrings(
  {
    undo: 'Undo',
    hint: 'Hint',
    clear: 'Clear',
    tapMode: 'Tap mode',
    fill: 'Fill',
    cross: 'Cross',
    gridLabel: (n: number) => `Nonogram ${n} by ${n}`,
    cellLabel: (r: number, c: number, state: 'filled' | 'crossed' | 'empty') =>
      `Row ${r}, column ${c}: ${state === 'filled' ? 'filled' : state === 'crossed' ? 'crossed out' : 'empty'}`,
    mistakeFilled: 'This square shouldn’t be filled.',
    mistakeCrossed: 'This square should be filled, not crossed out.',
    deduce: (kind: LineKind, line: number, clue: string, fill: boolean) =>
      `${kind === 'row' ? 'Row' : 'Column'} ${line} (${clue}) ${fill ? 'must fill' : 'can’t use'} this square${fill ? '' : ', so it gets an ✕'}.`,
    reveal: 'This square is filled.',
    /** Win caption / results summary around "<article> <strong>noun</strong>". */
    itIs: { pre: 'It’s ', post: '!' },
    itWas: { pre: 'It was ', post: '!' },
  },
  {
    undo: 'Deshacer',
    hint: 'Pista',
    clear: 'Borrar',
    tapMode: 'Modo de toque',
    fill: 'Rellenar',
    cross: 'Marcar',
    gridLabel: (n: number) => `Nonograma de ${n} por ${n}`,
    cellLabel: (r: number, c: number, state: 'filled' | 'crossed' | 'empty') =>
      `Fila ${r}, columna ${c}: ${state === 'filled' ? 'rellena' : state === 'crossed' ? 'marcada con ✕' : 'vacía'}`,
    mistakeFilled: 'Esta casilla no debería estar rellena.',
    mistakeCrossed: 'Esta casilla debería estar rellena, no marcada con ✕.',
    deduce: (kind: LineKind, line: number, clue: string, fill: boolean) =>
      `La ${kind === 'row' ? 'fila' : 'columna'} ${line} (${clue}) ${fill ? 'tiene que usar esta casilla' : 'no puede usar esta casilla, así que lleva una ✕'}.`,
    reveal: 'Esta casilla va rellena.',
    itIs: { pre: '¡Es ', post: '!' },
    itWas: { pre: '¡Era ', post: '!' },
  },
);

export type Strings = (typeof STR)['en'];

/** Words a structured hint from `hintFor` in the interface language. */
export function hintMessage(t: Strings, h: NonogramHint): string {
  if (h.kind === 'mistake') return h.value === 0 ? t.mistakeFilled : t.mistakeCrossed;
  if (h.kind === 'deduce' && h.line) return t.deduce(h.line.kind, h.line.index + 1, h.line.clue.join(' ') || '0', h.value === 1);
  return t.reveal;
}

/** The picture's name split into article and noun ("a" + "cat", "una" + "casa"), or null for random puzzles. */
export function pictureName(p: Pick<NonogramPuzzle, 'name' | 'nameEs'>, lang: Lang): { article: string; noun: string } | null {
  if (lang === 'es' && p.nameEs) {
    const sp = p.nameEs.indexOf(' ');
    return sp > 0 ? { article: p.nameEs.slice(0, sp), noun: p.nameEs.slice(sp + 1) } : { article: '', noun: p.nameEs };
  }
  if (!p.name) return null;
  return { article: /^[aeiou]/i.test(p.name) ? 'an' : 'a', noun: p.name };
}
