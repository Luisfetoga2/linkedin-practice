import type { GameMeta } from '../../core/types';
import { IconFrame, IconText, INK } from '../../core/components/GameIcon';

function Icon({ size = 48 }: { size?: number }) {
  // A 4×4 corner of the grid: thin cell lines, thick box lines, one selected square.
  const cell = 37 / 4;
  const at = (i: number) => 5.5 + i * cell;
  const mid = (i: number) => at(i) + cell / 2;
  return (
    <IconFrame size={size}>
      <rect x={at(2)} y={at(1)} width={cell} height={cell} fill="#9ce6c4" />
      <path d={`M${at(1)} 5.5V42.5M${at(3)} 5.5V42.5M5.5 ${at(1)}H42.5M5.5 ${at(3)}H42.5`} stroke="#bdbdbd" strokeWidth="1" />
      <path d={`M${at(2)} 5.5V42.5M5.5 ${at(2)}H42.5`} stroke={INK} strokeWidth="2" />
      <IconText x={mid(0)} y={mid(0)} size={6.5}>
        3
      </IconText>
      <IconText x={mid(2)} y={mid(1)} size={6.5}>
        5
      </IconText>
      <IconText x={mid(1)} y={mid(2)} size={6.5}>
        2
      </IconText>
      <IconText x={mid(3)} y={mid(3)} size={6.5} fill="#1f7a4f">
        1
      </IconText>
    </IconFrame>
  );
}

export const meta: GameMeta = {
  id: 'sudoku',
  name: 'Mini Sudoku',
  tagline: { en: 'The classic game, made mini', es: 'El clásico, en versión mini' },
  color: '#1f7a4f',
  colorEnd: '#2d9a66',
  tint: '#d6faee',
  scoring: 'time',
  Icon,
  options: [
    {
      id: 'difficulty',
      label: { en: 'Difficulty', es: 'Dificultad' },
      default: 'medium',
      choices: [
        { value: 'easy', label: { en: 'Easy', es: 'Fácil' } },
        { value: 'medium', label: { en: 'Medium', es: 'Media' } },
        { value: 'hard', label: { en: 'Hard', es: 'Difícil' } },
      ],
    },
  ],
  settings: [
    {
      key: 'showErrors',
      label: { en: 'Show conflicts', es: 'Mostrar conflictos' },
      description: {
        en: 'Highlight numbers that repeat in a row, column, or box.',
        es: 'Resalta los números que se repiten en una fila, columna o recuadro.',
      },
      default: true,
    },
    {
      key: 'autoNotes',
      label: { en: 'Auto-clear notes', es: 'Borrar notas automáticamente' },
      description: {
        en: 'Remove a note automatically when that number is placed nearby.',
        es: 'Quita una nota automáticamente cuando ese número se coloca en su fila, columna o recuadro.',
      },
      default: true,
    },
  ],
  howToPlay: {
    en: (
      <>
        <p>Fill the 6×6 grid so that every row, column, and 2×3 box contains the numbers 1 through 6.</p>
        <ul>
          <li>Select a cell, then tap a number (or type 1–6).</li>
          <li>Switch on Notes (or press N) to pencil in candidates. Arrow keys move, Backspace erases.</li>
          <li>Every puzzle has exactly one solution.</li>
        </ul>
      </>
    ),
    es: (
      <>
        <p>Llena la cuadrícula de 6×6 para que cada fila, columna y recuadro de 2×3 tenga los números del 1 al 6.</p>
        <ul>
          <li>Elige una casilla y luego toca un número (o escribe del 1 al 6).</li>
          <li>Activa Notas (o presiona N) para anotar posibles números. Las flechas te mueven y la tecla de retroceso borra.</li>
          <li>Cada tablero tiene una sola solución.</li>
        </ul>
      </>
    ),
  },
};
