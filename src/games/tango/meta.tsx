import type { GameMeta } from '../../core/types';

function Icon({ size = 48 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden>
      <rect x="4" y="4" width="40" height="40" rx="7" fill="#1f1f1f" />
      <rect x="7" y="7" width="16.5" height="16.5" rx="2" fill="#fff" />
      <rect x="24.5" y="7" width="16.5" height="16.5" rx="2" fill="#fff" />
      <rect x="7" y="24.5" width="16.5" height="16.5" rx="2" fill="#fff" />
      <rect x="24.5" y="24.5" width="16.5" height="16.5" rx="2" fill="#fff" />
      <circle cx="15.25" cy="15.25" r="5.2" fill="#ffb02e" stroke="#e8890c" strokeWidth="1.4" />
      <circle cx="32.75" cy="32.75" r="5.2" fill="#ffb02e" stroke="#e8890c" strokeWidth="1.4" />
      <path d="M35.5 11.3a5.4 5.4 0 104.6 7.8 4.3 4.3 0 01-4.6-7.8z" fill="#4a8bf5" transform="translate(-3.5 -.6)" />
      <path d="M18 28.8a5.4 5.4 0 104.6 7.8 4.3 4.3 0 01-4.6-7.8z" fill="#4a8bf5" transform="translate(-3.5 -.6)" />
    </svg>
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
