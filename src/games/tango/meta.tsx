import type { GameMeta } from '../../core/types';
import { FaceCell, IconFrame } from '../../core/components/GameIcon';

/** Crescent moon centered on (cx, cy): a circle with an offset circle cut out of it. */
function moon(cx: number, cy: number) {
  const p = (x: number, y: number) => `${(cx + x).toFixed(2)} ${(cy + y).toFixed(2)}`;
  return `M${p(-0.68, -5.56)}A5.6 5.6 0 1 0 ${p(5.39, 1.52)}A4.7 4.7 0 0 1 ${p(-0.68, -5.56)}Z`;
}

function Icon({ size = 48 }: { size?: number }) {
  const cells = [5.5, 25];
  const c = (i: number) => cells[i] + 8.75;
  return (
    <IconFrame size={size} dark>
      {[0, 1].flatMap((r) => [0, 1].map((q) => <FaceCell key={`${r}${q}`} x={cells[q]} y={cells[r]} w={17.5} h={17.5} r={3} fill="#fff" />))}
      <circle cx={c(0)} cy={c(0)} r="5.3" fill="#ffb02e" stroke="#e8890c" strokeWidth="1.5" />
      <circle cx={c(1)} cy={c(1)} r="5.3" fill="#ffb02e" stroke="#e8890c" strokeWidth="1.5" />
      <path d={moon(c(1), c(0))} fill="#4a8bf5" />
      <path d={moon(c(0), c(1))} fill="#4a8bf5" />
    </IconFrame>
  );
}

export const meta: GameMeta = {
  id: 'tango',
  name: 'Tango',
  tagline: { en: 'Harmonize the grid', es: 'Armoniza la cuadrícula' },
  color: '#324152',
  colorEnd: '#222e3b',
  tint: '#e9edf1',
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
      label: { en: 'Show mistakes', es: 'Mostrar errores' },
      description: {
        en: 'Highlight cells that break a rule as you play.',
        es: 'Resalta las casillas que rompen una regla mientras juegas.',
      },
      default: true,
    },
  ],
  howToPlay: {
    en: (
      <>
        <p>Fill the grid so that each cell contains either a ☀️ or a 🌙.</p>
        <ul>
          <li>No more than 2 ☀️ or 🌙 may be next to each other, either vertically or horizontally.</li>
          <li>Each row (and each column) must contain the same number of ☀️ and 🌙.</li>
          <li>Cells separated by an <strong>=</strong> sign must be the same type.</li>
          <li>Cells separated by an <strong>×</strong> sign must be the opposite type.</li>
          <li>Each puzzle has one right answer and can be solved via deduction — no guessing needed.</li>
        </ul>
        <p>Tap a cell once for a ☀️, twice for a 🌙, and a third time to clear it. Right-click places a 🌙 directly. On a keyboard, use the arrow keys and Space.</p>
      </>
    ),
    es: (
      <>
        <p>Llena la cuadrícula para que cada casilla tenga un ☀️ o una 🌙.</p>
        <ul>
          <li>No puede haber más de 2 ☀️ o 🌙 seguidos, ni en vertical ni en horizontal.</li>
          <li>Cada fila (y cada columna) debe tener la misma cantidad de ☀️ y 🌙.</li>
          <li>Las casillas separadas por un signo <strong>=</strong> deben ser del mismo tipo.</li>
          <li>Las casillas separadas por un signo <strong>×</strong> deben ser de tipo opuesto.</li>
          <li>Cada tablero tiene una sola solución y se resuelve con lógica, sin adivinar.</li>
        </ul>
        <p>Toca una casilla una vez para poner un ☀️, dos veces para una 🌙 y una tercera vez para vaciarla. Con clic derecho pones una 🌙 directamente. Con el teclado, usa las flechas y la barra espaciadora.</p>
      </>
    ),
  },
};
