import type { GameMeta } from '../../core/types';
import { IconFrame, IconText, INK } from '../../core/components/GameIcon';

function Icon({ size = 48 }: { size?: number }) {
  // A consistent corner of a board: the 1s and the 2 touch the two mines in the top row, one flagged.
  const cell = 31 / 3;
  const at = (i: number) => 8.5 + i * cell;
  const mid = (i: number) => at(i) + cell / 2;
  const hidden = ['011', '001', '000'];
  const numbers: [number, number, string, string][] = [
    [0, 0, '1', '#1a6ff2'],
    [1, 0, '1', '#1a6ff2'],
    [1, 1, '2', '#2e8b3a'],
  ];
  return (
    <IconFrame size={size}>
      {hidden.flatMap((row, r) =>
        [...row].map((v, c) => (
          <rect key={`${r}${c}`} x={at(c) + 0.5} y={at(r) + 0.5} width={cell - 1} height={cell - 1} rx="2" fill={v === '1' ? '#c9b49d' : '#f4eee6'} />
        )),
      )}
      {numbers.map(([r, c, n, fill]) => (
        <IconText key={`${r}${c}`} x={mid(c)} y={mid(r)} size={7.5} fill={fill}>
          {n}
        </IconText>
      ))}
      <path d={`M${mid(2) - 1.8} ${mid(0) - 3.4}v6.8`} stroke={INK} strokeWidth="1.3" strokeLinecap="round" />
      <path d={`M${mid(2) - 1.2} ${mid(0) - 3.5}l4.4 2.1-4.4 2.1z`} fill="#d62d20" strokeLinejoin="round" />
      <path d={`M${mid(2) - 3.3} ${mid(0) + 3.4}h3`} stroke={INK} strokeWidth="1.3" strokeLinecap="round" />
    </IconFrame>
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
