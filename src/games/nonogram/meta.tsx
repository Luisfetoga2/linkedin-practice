import type { GameMeta } from '../../core/types';
import { IconFrame } from '../../core/components/GameIcon';

function Icon({ size = 48 }: { size?: number }) {
  // A solved 5×5 heart, with one clue mark per run beside each row and above each column.
  const on = ['01010', '11111', '11111', '01110', '00100'];
  const cell = 4.8;
  const x0 = 15.5;
  // Only one clue mark sits above each column, so the block moves up a little to stay centered.
  const y0 = 14;
  const runs = (line: string) => line.split(/0+/).filter(Boolean).length;
  const cols = [0, 1, 2, 3, 4].map((c) => on.map((row) => row[c]).join(''));
  return (
    <IconFrame size={size}>
      {on.flatMap((row, r) =>
        [...row].map((v, c) => (
          <rect key={`${r}${c}`} x={x0 + c * cell + 0.3} y={y0 + r * cell + 0.3} width={cell - 0.6} height={cell - 0.6} rx="0.9" fill={v === '1' ? '#d63384' : '#f1f1f1'} />
        )),
      )}
      {on.flatMap((row, r) =>
        Array.from({ length: runs(row) }, (_, k) => (
          <rect key={`r${r}${k}`} x={11.3 - k * 3.4} y={y0 + r * cell + 1.1} width="2.6" height="2.6" rx="0.7" fill="#bdbdbd" />
        )),
      )}
      {cols.flatMap((col, c) =>
        Array.from({ length: runs(col) }, (_, k) => (
          <rect key={`c${c}${k}`} x={x0 + c * cell + 1.1} y={y0 - 4.2 - k * 3.4} width="2.6" height="2.6" rx="0.7" fill="#bdbdbd" />
        )),
      )}
    </IconFrame>
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
