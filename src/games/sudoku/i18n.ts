import { defineStrings } from '../../lib/i18n';
import type { HouseKind } from './logic';

/** Structured step explanation from the solver; format it with `STR[lang].step(msg)`. */
export type StepMsg =
  | { key: 'fullHouse' | 'hiddenSingle' | 'claiming'; kind: HouseKind; digit: number }
  | { key: 'nakedSingle'; digit: number }
  | { key: 'pointing'; line: 'row' | 'column'; digit: number }
  | { key: 'nakedPair' | 'hiddenPair'; kind: HouseKind; x: number; y: number };

function enStep(m: StepMsg): string {
  switch (m.key) {
    case 'fullHouse':
      return `This is the last empty cell in the highlighted ${m.kind}, so it must be ${m.digit}.`;
    case 'nakedSingle':
      return `The row, column and box of this cell already rule out every number except ${m.digit}.`;
    case 'hiddenSingle':
      return `${m.digit} can only go in this cell in the highlighted ${m.kind}.`;
    case 'pointing':
      return `In the highlighted box, ${m.digit} must go in this ${m.line}, so it can't go anywhere else in the ${m.line}.`;
    case 'claiming':
      return `In the highlighted ${m.kind}, ${m.digit} must go inside one box, so it can't go anywhere else in that box.`;
    case 'nakedPair':
      return `The two highlighted cells can only be ${m.x} or ${m.y}, so no other cell in the ${m.kind} can be ${m.x} or ${m.y}.`;
    case 'hiddenPair':
      return `In the highlighted ${m.kind}, ${m.x} and ${m.y} can only go in these two cells, so nothing else fits there.`;
  }
}

/** "la fila" / "la columna" / "el recuadro" (a 2×3 box). */
const esThe = (k: HouseKind) => (k === 'box' ? 'el recuadro' : k === 'row' ? 'la fila' : 'la columna');
/** "la fila resaltada" / "el recuadro resaltado". */
const esHighlighted = (k: HouseKind) => `${esThe(k)} ${k === 'box' ? 'resaltado' : 'resaltada'}`;
/** "de la fila" / "del recuadro". */
const esOf = (k: HouseKind) => (k === 'box' ? 'del recuadro' : `de ${esThe(k)}`);

function esStep(m: StepMsg): string {
  switch (m.key) {
    case 'fullHouse':
      return `Esta es la última casilla vacía en ${esHighlighted(m.kind)}, así que tiene que ser ${m.digit}.`;
    case 'nakedSingle':
      return `La fila, la columna y el recuadro de esta casilla ya descartan todos los números menos el ${m.digit}.`;
    case 'hiddenSingle':
      return `En ${esHighlighted(m.kind)}, el ${m.digit} solo puede ir en esta casilla.`;
    case 'pointing':
      return `En el recuadro resaltado, el ${m.digit} tiene que ir en esta ${m.line === 'row' ? 'fila' : 'columna'}, así que no puede ir en ninguna otra parte ${esOf(m.line)}.`;
    case 'claiming':
      return `En ${esHighlighted(m.kind)}, el ${m.digit} tiene que ir dentro de un solo recuadro, así que no puede ir en ninguna otra parte de ese recuadro.`;
    case 'nakedPair':
      return `Las dos casillas resaltadas solo pueden ser ${m.x} o ${m.y}, así que ninguna otra casilla ${esOf(m.kind)} puede ser ${m.x} ni ${m.y}.`;
    case 'hiddenPair':
      return `En ${esHighlighted(m.kind)}, el ${m.x} y el ${m.y} solo pueden ir en estas dos casillas, así que ahí no cabe ningún otro número.`;
  }
}

export const STR = defineStrings(
  {
    undo: 'Undo',
    erase: 'Erase',
    notes: 'Notes',
    hint: 'Hint',
    step: enStep,
    /** An elimination that unlocks the placement, then the placement itself. */
    thenStep: (via: string, placement: string) => `${via} Then: ${placement}`,
    wrongNumber: "This number isn't right.",
    reveal: (digit: number) => `This cell is ${digit}.`,
    boardLabel: 'Mini Sudoku board',
    cellLabel: (row: number, col: number, value: number, given: boolean) =>
      `Row ${row}, column ${col}: ${value || 'empty'}${given ? ', given' : ''}`,
    numberPad: 'Number pad',
    noteKey: (d: number) => `Note ${d}`,
  },
  {
    undo: 'Deshacer',
    erase: 'Borrar',
    notes: 'Notas',
    hint: 'Pista',
    step: esStep,
    thenStep: (via: string, placement: string) => `${via} Luego: ${placement}`,
    wrongNumber: 'Este número no es correcto.',
    reveal: (digit: number) => `En esta casilla va el ${digit}.`,
    boardLabel: 'Tablero de Mini Sudoku',
    cellLabel: (row: number, col: number, value: number, given: boolean) =>
      `Fila ${row}, columna ${col}: ${value || 'vacía'}${given ? ', fija' : ''}`,
    numberPad: 'Teclado numérico',
    noteKey: (d: number) => `Nota ${d}`,
  },
);
