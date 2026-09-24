import type { GameMeta } from '../../core/types';

function Icon({ size = 48 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden>
      <rect x="4" y="4" width="40" height="40" rx="7" fill="#fff" stroke="#1f1f1f" strokeWidth="3" />
      <rect x="8" y="8" width="13" height="32" rx="3" fill="#4a8bf5" />
      <rect x="24" y="8" width="16" height="15" rx="3" fill="#f54545" />
      <rect x="24" y="26" width="16" height="14" rx="3" fill="#ffc93c" />
      <text x="32" y="19.3" textAnchor="middle" fontSize="9" fontWeight="700" fill="#fff" fontFamily="system-ui">4</text>
    </svg>
  );
}

export const meta: GameMeta = {
  id: 'patches',
  name: 'Patches',
  tagline: { en: 'Piece it together', es: 'Arma el rompecabezas' },
  color: '#f54545',
  colorEnd: '#d93333',
  tint: '#fddada',
  scoring: 'time',
  Icon,
  options: [
    {
      id: 'size',
      label: { en: 'Size', es: 'Tamaño' },
      default: '6',
      choices: ['5', '6', '7', '8'].map((v) => ({ value: v, label: `${v}×${v}` })),
    },
  ],
  howToPlay: {
    en: (
      <>
        <p>Cover the whole grid with rectangular patches.</p>
        <ul>
          <li>Each patch must contain exactly one clue.</li>
          <li>A number tells you how many cells the patch covers.</li>
          <li>A shape tells you whether the patch is a square, wide (wider than tall) or tall (taller than wide). A dashed cross can be any rectangle.</li>
          <li>Drag across cells to draw a patch — every cell you pass through becomes part of it. Patches are never a single cell.</li>
          <li>Patches can’t overlap: a new patch stops at the edge of the patches already drawn, and so does a patch you resize.</li>
          <li>Press on a patch and drag to resize it; it stretches to the cell under your finger and shrinks back as you return.</li>
          <li>A patch that gets bigger than its number, or can never take its clue’s shape, blinks red. Tap the message to remove it.</li>
          <li>Tap (or right-click) a patch to remove it. Release off the board or press Esc to cancel a drag.</li>
        </ul>
      </>
    ),
    es: (
      <>
        <p>Cubre toda la cuadrícula con parches rectangulares.</p>
        <ul>
          <li>Cada parche debe contener exactamente una pista.</li>
          <li>Un número indica cuántas casillas cubre el parche.</li>
          <li>Una figura indica si el parche es cuadrado, ancho (más ancho que alto) o alto (más alto que ancho). Una cruz punteada puede ser cualquier rectángulo.</li>
          <li>Arrastra sobre las casillas para dibujar un parche: cada casilla por la que pases forma parte de él. Un parche nunca es de una sola casilla.</li>
          <li>Los parches no se pueden superponer: un parche nuevo se detiene en el borde de los que ya dibujaste, y lo mismo pasa al cambiar el tamaño de uno.</li>
          <li>Mantén presionado un parche y arrastra para cambiar su tamaño; se estira hasta la casilla bajo tu dedo y se encoge al regresar.</li>
          <li>Si un parche queda más grande que su número, o ya no puede tener la forma de su pista, parpadea en rojo. Toca el mensaje para quitarlo.</li>
          <li>Toca un parche (o haz clic derecho sobre él) para quitarlo. Suelta fuera del tablero o presiona Esc para cancelar un arrastre.</li>
        </ul>
      </>
    ),
  },
};
