import type { GameMeta } from '../../core/types';

function Icon({ size = 48 }: { size?: number }) {
  // A tiny crossword: 3×3 with one black square and a numbered corner.
  const cells = [
    [0, 0],
    [1, 0],
    [2, 0],
    [0, 1],
    [1, 1],
    [0, 2],
    [2, 1],
    [1, 2],
  ];
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden>
      <rect x="4" y="4" width="40" height="40" rx="7" fill="#1f1f1f" />
      {cells.map(([c, r]) => (
        <rect key={`${c}${r}`} x={7 + c * 11.7} y={7 + r * 11.7} width="10.6" height="10.6" rx="1.4" fill={r === 0 ? '#9fb4ff' : '#fff'} />
      ))}
      <rect x={7 + 2 * 11.7} y={7 + 2 * 11.7} width="10.6" height="10.6" rx="1.4" fill="#1f1f1f" />
      <text x="9" y="12.6" fontSize="4.6" fontWeight="700" fill="#1f1f1f" fontFamily="system-ui">1</text>
    </svg>
  );
}

export const meta: GameMeta = {
  id: 'mini',
  name: { en: 'Mini Crossword', es: 'Mini crucigrama' },
  tagline: { en: 'A crossword in minutes', es: 'Un crucigrama en minutos' },
  color: '#4b50c9',
  colorEnd: '#3a3fa8',
  tint: '#e4e5ff',
  scoring: 'time',
  Icon,
  options: [
    {
      id: 'words',
      label: { en: 'Words', es: 'Palabras' },
      default: 'en',
      followsLanguage: true,
      choices: [
        { value: 'en', label: { en: 'English', es: 'Inglés' } },
        { value: 'es', label: { en: 'Spanish', es: 'Español' } },
      ],
    },
    {
      id: 'size',
      label: { en: 'Size', es: 'Tamaño' },
      default: '5',
      choices: [
        { value: '4', label: '4×4' },
        { value: '5', label: '5×5' },
      ],
    },
  ],
  settings: [
    {
      key: 'autoCheck',
      label: { en: 'Autocheck', es: 'Revisión automática' },
      description: {
        en: 'Mark wrong letters as soon as you type them.',
        es: 'Marca las letras incorrectas en cuanto las escribes.',
      },
      default: false,
    },
    {
      key: 'skipFilled',
      label: { en: 'Skip filled squares', es: 'Saltar casillas llenas' },
      description: {
        en: 'While typing, jump over squares that already have a letter.',
        es: 'Al escribir, salta las casillas que ya tienen una letra.',
      },
      default: true,
    },
  ],
  howToPlay: {
    en: (
      <>
        <p>Fill the small grid so every row and column answers its clue.</p>
        <ul>
          <li>Tap a square to select it; tap it again (or the clue bar) to switch between Across and Down.</li>
          <li>Type with your keyboard or the one on screen. The cursor moves through the word and then on to the next clue. Enter or Tab jumps to the next clue; the arrows on the clue bar step through them.</li>
          <li>Numbers in the corners match the clues. On a wide screen, all the clues are listed beside the grid — click one to jump to it.</li>
          <li>Stuck? Reveal square fills in the selected letter (marked with a small triangle), and Check word marks wrong letters in the current word with a red slash. Each use counts as a hint.</li>
          <li>Turn on Autocheck in the settings to see wrong letters as you type. Pick the 4×4 size for a quicker, easier puzzle.</li>
        </ul>
      </>
    ),
    es: (
      <>
        <p>Completa la cuadrícula para que cada fila y columna responda su pista.</p>
        <ul>
          <li>Toca una casilla para seleccionarla; tócala otra vez (o toca la barra de la pista) para cambiar entre horizontal y vertical.</li>
          <li>Escribe con tu teclado o con el de la pantalla. El cursor avanza por la palabra y luego pasa a la siguiente pista. Enter o Tab saltan a la siguiente pista; las flechas de la barra recorren las pistas.</li>
          <li>Los números de las esquinas corresponden a las pistas. En una pantalla ancha, todas las pistas aparecen junto a la cuadrícula: haz clic en una para ir a ella.</li>
          <li>¿No sabes cómo seguir? Revelar casilla completa la letra seleccionada (marcada con un pequeño triángulo) y Revisar palabra marca con una raya roja las letras incorrectas de la palabra actual. Cada uso cuenta como una pista.</li>
          <li>Activa la revisión automática en la configuración para ver las letras incorrectas mientras escribes. Elige el tamaño 4×4 para un crucigrama más rápido y fácil.</li>
          <li>Con las palabras en español, los acentos no cuentan (Á es A) y la Ñ es una letra aparte.</li>
        </ul>
      </>
    ),
  },
};
