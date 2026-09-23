import type { GameMeta } from '../../core/types';

function Icon({ size = 48 }: { size?: number }) {
  // A tiny heart picture with clue marks, like a solved nonogram.
  const on = ['01010', '11111', '11111', '01110', '00100'];
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden>
      <rect x="4" y="4" width="40" height="40" rx="7" fill="#fff" stroke="#1f1f1f" strokeWidth="3" />
      <rect x="8" y="8" width="8" height="2.5" rx="1" fill="#c9c9c9" />
      <rect x="8" y="12" width="5" height="2.5" rx="1" fill="#c9c9c9" />
      {on.flatMap((row, r) =>
        [...row].map((v, c) =>
          v === '1' ? <rect key={`${r}${c}`} x={17.5 + c * 5} y={17.5 + r * 5} width="4.4" height="4.4" rx="0.8" fill="#d63384" /> : null,
        ),
      )}
    </svg>
  );
}

export const meta: GameMeta = {
  id: 'nonogram',
  name: 'Nonogram',
  tagline: { en: 'Paint by numbers', es: 'Pinta con números' },
  color: '#c2296f',
  colorEnd: '#a11d5b',
  tint: '#fde3ef',
  scoring: 'time',
  Icon,
  options: [
    {
      id: 'size',
      label: { en: 'Size', es: 'Tamaño' },
      default: '10',
      choices: [
        { value: '5', label: '5×5' },
        { value: '10', label: '10×10' },
        { value: '15', label: '15×15' },
      ],
    },
  ],
  settings: [
    {
      key: 'autoCross',
      label: { en: 'Auto-cross finished lines', es: 'Marcar líneas terminadas' },
      description: {
        en: 'Fill the rest of a row or column with ✕ once it matches its clue.',
        es: 'Llena con ✕ el resto de una fila o columna en cuanto coincide con su pista.',
      },
      default: false,
    },
    {
      key: 'showMistakes',
      label: { en: 'Show mistakes', es: 'Mostrar errores' },
      description: {
        en: 'Mark filled squares that aren’t part of the picture.',
        es: 'Señala las casillas rellenas que no forman parte del dibujo.',
      },
      default: false,
    },
  ],
  howToPlay: {
    en: (
      <>
        <p>Fill squares to reveal a hidden picture.</p>
        <ul>
          <li>The numbers beside each row and above each column are the lengths of its runs of filled squares, in order.</li>
          <li>Runs are separated by at least one empty square.</li>
          <li>Tap or drag to fill. Switch to ✕ (or right-click) to mark squares you know are empty. Drag stays in a straight line.</li>
          <li>A clue turns gray once its line matches. Every puzzle can be solved by logic alone.</li>
        </ul>
      </>
    ),
    es: (
      <>
        <p>Rellena casillas para descubrir un dibujo oculto.</p>
        <ul>
          <li>Los números junto a cada fila y sobre cada columna son, en orden, las longitudes de sus grupos de casillas rellenas.</li>
          <li>Entre un grupo y otro hay al menos una casilla vacía.</li>
          <li>Toca o arrastra para rellenar. Cambia a ✕ (o haz clic derecho) para marcar las casillas que sabes que están vacías. El arrastre sigue una línea recta.</li>
          <li>Una pista se pone gris cuando su línea coincide. Todos los acertijos se pueden resolver solo con lógica.</li>
        </ul>
      </>
    ),
  },
};
