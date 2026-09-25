import type { GameMeta } from '../../core/types';
import { FaceCell, IconFrame, INK } from '../../core/components/GameIcon';

function Icon({ size = 48 }: { size?: number }) {
  const colors = ['#bba3e2', '#ffc992', '#96beff', '#96beff', '#b3dfa0', '#dfdfdf', '#dfdfdf', '#ff7b60', '#bba3e2'];
  const at = (i: number) => 5.5 + i * 13;
  return (
    <IconFrame size={size} dark>
      {colors.map((fill, i) => (
        <FaceCell key={i} x={at(i % 3)} y={at(Math.floor(i / 3))} w={11} h={11} fill={fill} />
      ))}
      {/* A crown on the middle square. */}
      <path d="M20.3 26.4L19.5 21.6L22.3 23.7L24 20.4L25.7 23.7L28.5 21.6L27.7 26.4Z" fill={INK} strokeLinejoin="round" stroke={INK} strokeWidth="0.6" />
      <circle cx="19.5" cy="21.3" r="0.95" fill={INK} />
      <circle cx="24" cy="20" r="0.95" fill={INK} />
      <circle cx="28.5" cy="21.3" r="0.95" fill={INK} />
      <rect x="20.3" y="27.1" width="7.4" height="1.5" rx="0.6" fill={INK} />
    </IconFrame>
  );
}

export const meta: GameMeta = {
  id: 'queens',
  name: 'Queens',
  tagline: { en: 'Crown each region', es: 'Corona cada región' },
  color: '#704b95',
  colorEnd: '#5a3a7c',
  tint: '#f5ebff',
  scoring: 'time',
  Icon,
  options: [
    {
      id: 'size',
      label: { en: 'Size', es: 'Tamaño' },
      default: '8',
      choices: ['6', '7', '8', '9', '10'].map((v) => ({ value: v, label: `${v}×${v}` })),
    },
  ],
  settings: [
    {
      key: 'autoX',
      label: { en: 'Auto-place ✕', es: 'Poner ✕ automáticamente' },
      description: {
        en: 'Mark cells that can no longer hold a queen when you place one.',
        es: 'Al poner una reina, marca las casillas donde ya no puede ir otra.',
      },
      default: false,
    },
    {
      key: 'showClashes',
      label: { en: 'Show clashes', es: 'Mostrar conflictos' },
      description: { en: 'Highlight queens that break a rule.', es: 'Resalta las reinas que rompen una regla.' },
      default: true,
    },
  ],
  howToPlay: {
    en: (
      <>
        <p>Your goal is to have exactly one 👑 in each row, column, and color region.</p>
        <ul>
          <li>Tap once to place ✕ and tap twice for 👑. Use ✕ to mark where 👑 cannot be placed. Right-click places a 👑 directly.</li>
          <li>Two 👑 cannot touch each other, not even diagonally.</li>
          <li>Drag across cells to place several ✕ at once.</li>
        </ul>
      </>
    ),
    es: (
      <>
        <p>Tu objetivo es tener exactamente una 👑 en cada fila, columna y región de color.</p>
        <ul>
          <li>Toca una vez para poner ✕ y dos veces para poner 👑. Usa ✕ para marcar dónde no puede ir una 👑. Con clic derecho pones una 👑 directamente.</li>
          <li>Dos 👑 no pueden tocarse, ni siquiera en diagonal.</li>
          <li>Arrastra sobre las casillas para poner varias ✕ a la vez.</li>
        </ul>
      </>
    ),
  },
};
