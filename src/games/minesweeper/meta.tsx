import type { GameMeta } from '../../core/types';

function Icon({ size = 48 }: { size?: number }) {
  // A corner of a board: open squares with numbers, hidden squares and a flag.
  const cell = 13;
  const hidden = ['011', '001', '000'];
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden>
      <rect x="4" y="4" width="40" height="40" rx="7" fill="#fff" stroke="#1f1f1f" strokeWidth="3" />
      {hidden.flatMap((row, r) =>
        [...row].map((v, c) =>
          v === '1' ? <rect key={`${r}${c}`} x={5.5 + c * cell + 1} y={5.5 + r * cell + 1} width={cell - 2} height={cell - 2} rx="2" fill="#c9b49d" /> : null,
        ),
      )}
      <text x="12" y="16.5" fontSize="9" fontWeight="800" fill="#1a6ff2" fontFamily="system-ui" textAnchor="middle">1</text>
      <text x="25" y="29.5" fontSize="9" fontWeight="800" fill="#2e8b3a" fontFamily="system-ui" textAnchor="middle">2</text>
      <text x="12" y="29.5" fontSize="9" fontWeight="800" fill="#1a6ff2" fontFamily="system-ui" textAnchor="middle">1</text>
      <text x="38" y="42" fontSize="9" fontWeight="800" fill="#d62d20" fontFamily="system-ui" textAnchor="middle">3</text>
      <path d="M36 9.5v8.5" stroke="#1f1f1f" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M36.6 9.5l5 2.4-5 2.4z" fill="#d62d20" />
    </svg>
  );
}

export const meta: GameMeta = {
  id: 'minesweeper',
  name: { en: 'Minesweeper', es: 'Buscaminas' },
  tagline: { en: 'Clear the field, no guessing', es: 'Despeja el campo sin adivinar' },
  color: '#8b5e34',
  colorEnd: '#6f4a27',
  tint: '#f5e9dc',
  scoring: 'time',
  canLose: true,
  boardMax: (o) => (o.level === 'hard' ? 860 : undefined),
  Icon,
  options: [
    {
      id: 'level',
      label: { en: 'Difficulty', es: 'Dificultad' },
      default: 'easy',
      choices: [
        { value: 'easy', label: { en: 'Easy · 9×9', es: 'Fácil · 9×9' } },
        { value: 'medium', label: { en: 'Medium · 16×16', es: 'Media · 16×16' } },
        { value: 'hard', label: { en: 'Hard · 30×16', es: 'Difícil · 30×16' } },
      ],
    },
  ],
  howToPlay: {
    en: (
      <>
        <p>Open every square that isn’t a mine, or flag every mine.</p>
        <ul>
          <li>A number tells you how many of the 8 squares around it hide a mine.</li>
          <li>Your first tap is always safe and opens an area. Every board can be cleared by logic alone, with no 50/50 guesses.</li>
          <li>Right-click, long-press, or switch to Flag mode to mark a mine. Tap a number whose mines are all flagged to open the rest of its neighbors.</li>
          <li>You win as soon as every safe square is open or every mine is flagged correctly. If all your flags are down and the round hasn’t ended, one of them is wrong. Opening a mine ends the round. Hints point out the next square you can be sure about, and why.</li>
        </ul>
      </>
    ),
    es: (
      <>
        <p>Abre todas las casillas que no tengan una mina, o marca todas las minas.</p>
        <ul>
          <li>Cada número indica cuántas de las 8 casillas que lo rodean esconden una mina.</li>
          <li>El primer toque siempre es seguro y abre una zona. Todos los tableros se resuelven solo con lógica, sin tener que adivinar.</li>
          <li>Haz clic derecho, mantén presionado o cambia al modo Bandera para marcar una mina. Toca un número con todas sus minas marcadas para abrir el resto de sus vecinas.</li>
          <li>Ganas en cuanto abres todas las casillas seguras o marcas bien todas las minas. Si ya pusiste todas las banderas y la ronda no termina, alguna está mal. Si abres una mina, pierdes la ronda. Las pistas te muestran la próxima casilla de la que puedes estar seguro, y por qué.</li>
        </ul>
      </>
    ),
  },
};
