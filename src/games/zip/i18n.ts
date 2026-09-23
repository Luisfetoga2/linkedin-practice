import { defineStrings } from '../../lib/i18n';

export const STR = defineStrings(
  {
    generating: 'Generating…',
    undo: 'Undo',
    hint: 'Hint',
    clear: 'Clear',
    boardLabel: (size: number, covered: number, total: number) =>
      `Zip board, ${size} by ${size}. Path covers ${covered} of ${total} cells.`,
    fillEveryCell: 'Fill every cell before reaching the last number',
    hintNext: 'Here’s the next move.',
    hintTrimmed: 'Your path took a wrong turn, so it was trimmed back to the last correct cell. Here’s the next move.',
  },
  {
    generating: 'Generando…',
    undo: 'Deshacer',
    hint: 'Pista',
    clear: 'Borrar',
    boardLabel: (size: number, covered: number, total: number) =>
      `Tablero de Zip, ${size} por ${size}. El camino cubre ${covered} de ${total} casillas.`,
    fillEveryCell: 'Llena todas las casillas antes de llegar al último número',
    hintNext: 'Esta es la siguiente jugada.',
    hintTrimmed: 'Tu camino tomó un giro equivocado, así que lo recortamos hasta la última casilla correcta. Esta es la siguiente jugada.',
  },
);
