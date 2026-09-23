import { defineStrings } from '../../lib/i18n';
import type { Reason, Shape } from './generator';

export const STR = defineStrings(
  {
    undo: 'Undo',
    hint: 'Hint',
    clear: 'Clear',
    boardLabel: (n: number, placed: number, total: number) =>
      `Patches board, ${n} by ${n}. ${placed} of ${total} patches placed.`,
    needsOneClue: 'A patch needs exactly one clue',
    onlyOneClue: 'A patch can only hold one clue',
    wrongPatch: 'This patch isn’t right. Try removing it and drawing it again.',
    reason: {
      only: 'This clue only fits in one place.',
      claimed: 'The patches around it already claim the other cells it could use, so this clue only fits in one place.',
      reach: 'Some cells here can only be reached by this clue, which leaves just one patch that works.',
    } as Record<Reason, string>,
    clueLabel: (size: number | null, shape: Shape) =>
      `Clue: ${size != null ? `${size} cells` : 'any size'}, ${shape === 'any' ? 'any shape' : `${shape} shape`}`,
  },
  {
    undo: 'Deshacer',
    hint: 'Pista',
    clear: 'Borrar',
    boardLabel: (n: number, placed: number, total: number) =>
      `Tablero de Patches, ${n} por ${n}. ${placed} de ${total} parches colocados.`,
    needsOneClue: 'Un parche necesita exactamente una pista',
    onlyOneClue: 'Un parche solo puede tener una pista',
    wrongPatch: 'Este parche no es correcto. Intenta quitarlo y dibujarlo de nuevo.',
    reason: {
      only: 'Esta pista solo cabe en un lugar.',
      claimed: 'Los parches de alrededor ya ocupan las otras casillas que podría usar, así que esta pista solo cabe en un lugar.',
      reach: 'Algunas casillas de aquí solo las puede alcanzar esta pista, así que solo queda un parche posible.',
    },
    clueLabel: (size: number | null, shape: Shape) =>
      `Pista: ${size != null ? `${size} casillas` : 'cualquier tamaño'}, ${
        shape === 'any' ? 'cualquier forma' : `forma ${{ square: 'cuadrada', wide: 'ancha', tall: 'alta' }[shape]}`
      }`,
  },
);
