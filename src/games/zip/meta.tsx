import type { GameMeta } from '../../core/types';
import { IconFrame, IconText, INK } from '../../core/components/GameIcon';

function Icon({ size = 48 }: { size?: number }) {
  // The path bends with round corners, like the drawn line in the game.
  return (
    <IconFrame size={size}>
      <path
        d="M14 14H29A5 5 0 0 1 34 19A5 5 0 0 1 29 24H19A5 5 0 0 0 14 29A5 5 0 0 0 19 34H34"
        fill="none"
        stroke="#ff7a2e"
        strokeWidth="7"
        strokeLinecap="round"
      />
      <circle cx="14" cy="14" r="5" fill={INK} />
      <circle cx="34" cy="34" r="5" fill={INK} />
      <IconText x={14} y={14} size={6.5} fill="#fff">
        1
      </IconText>
      <IconText x={34} y={34} size={6.5} fill="#fff">
        2
      </IconText>
    </IconFrame>
  );
}

export const meta: GameMeta = {
  id: 'zip',
  name: 'Zip',
  tagline: { en: 'Complete the path', es: 'Completa el camino' },
  color: '#ee5b14',
  colorEnd: '#d24a0b',
  tint: '#ffdccd',
  scoring: 'time',
  Icon,
  options: [
    {
      id: 'size',
      label: { en: 'Size', es: 'Tamaño' },
      default: '7',
      choices: ['5', '6', '7', '8'].map((v) => ({ value: v, label: `${v}×${v}` })),
    },
  ],
  howToPlay: {
    en: (
      <>
        <p>Draw a single path that connects the numbers in order and fills every cell.</p>
        <ul>
          <li>Start at 1 and visit every number in ascending order, ending on the highest number.</li>
          <li>The path must pass through every cell exactly once.</li>
          <li>The path can’t cross thick walls.</li>
          <li>Drag back over the path to erase part of it.</li>
        </ul>
      </>
    ),
    es: (
      <>
        <p>Traza un solo camino que una los números en orden y llene todas las casillas.</p>
        <ul>
          <li>Empieza en el 1 y pasa por cada número en orden ascendente, hasta terminar en el más alto.</li>
          <li>El camino debe pasar por cada casilla exactamente una vez.</li>
          <li>El camino no puede cruzar las paredes gruesas.</li>
          <li>Arrastra de regreso sobre el camino para borrar una parte.</li>
        </ul>
      </>
    ),
  },
};
