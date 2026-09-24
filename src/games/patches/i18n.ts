import { defineStrings } from '../../lib/i18n';
import type { FitProblem } from './draw';
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
    oops: {
      area: (n: number) => `Oops! This shaded region can only contain ${n} cells.`,
      noFit: (n: number) => `Oops! This shaded region can’t grow into a rectangle of ${n} cells.`,
      tall: () => 'Oops! This shaded region must be taller than it is wide.',
      wide: () => 'Oops! This shaded region must be wider than it is tall.',
      square: () => 'Oops! This shaded region must be a square.',
    } as Record<FitProblem, (n: number) => string>,
    dismissOops: 'Dismiss and remove this patch',
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
    oops: {
      area: (n: number) => `¡Ups! Esta región sombreada solo puede tener ${n} casillas.`,
      noFit: (n: number) => `¡Ups! Esta región sombreada no puede formar un rectángulo de ${n} casillas.`,
      tall: () => '¡Ups! Esta región sombreada debe ser más alta que ancha.',
      wide: () => '¡Ups! Esta región sombreada debe ser más ancha que alta.',
      square: () => '¡Ups! Esta región sombreada debe ser un cuadrado.',
    },
    dismissOops: 'Cerrar y quitar este parche',
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
