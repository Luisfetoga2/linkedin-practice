import type { GameMeta } from '../../core/types';

function Icon({ size = 48 }: { size?: number }) {
  const c = ['#bba3e2', '#ffc992', '#96beff', '#b3dfa0', '#dfdfdf', '#ff7b60'];
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden>
      <rect x="4" y="4" width="40" height="40" rx="7" fill="#1f1f1f" />
      {[0, 1, 2].flatMap((r) =>
        [0, 1, 2].map((q) => (
          <rect key={`${r}${q}`} x={7 + q * 11.7} y={7 + r * 11.7} width="10.6" height="10.6" rx="1.5" fill={c[(r * 2 + q) % c.length]} />
        )),
      )}
      <path d="M18.5 28.5l-1.5-8 3.8 3 3.2-5 3.2 5 3.8-3-1.5 8z" fill="#1f1f1f" />
    </svg>
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
