import type { CasinoMeta } from '../../types';
import { IconFrame, FONT } from '../../../core/components/GameIcon';

function Card({ x, y, rot, rank, suit, red }: { x: number; y: number; rot: number; rank: string; suit: string; red?: boolean }) {
  const ink = red ? '#d62d20' : '#1f1f1f';
  return (
    <g transform={`rotate(${rot} ${x + 8} ${y + 11})`}>
      <rect x={x} y={y} width="16" height="22" rx="2.5" fill="#fff" stroke="#1f1f1f" strokeWidth="1.4" />
      <text x={x + 3} y={y + 7.4} fontSize="6.4" fontWeight="800" fill={ink} fontFamily={FONT}>
        {rank}
      </text>
      <text x={x + 8} y={y + 17.6} fontSize="9" textAnchor="middle" fill={ink} fontFamily={FONT}>
        {suit}
      </text>
    </g>
  );
}

function Icon({ size = 48 }: { size?: number }) {
  // An ace and a king fanned on the felt: a blackjack.
  return (
    <IconFrame size={size} dark>
      <rect x="5.5" y="5.5" width="37" height="37" rx="5.5" fill="#138a4f" />
      <Card x={10.5} y={13} rot={-12} rank="A" suit="♠" />
      <Card x={21.5} y={13} rot={10} rank="K" suit="♥" red />
    </IconFrame>
  );
}

export const meta: CasinoMeta = {
  id: 'blackjack',
  name: 'Blackjack',
  tagline: { en: 'Beat the dealer to 21', es: 'Gánale al crupier sin pasarte de 21' },
  color: '#0f6b3e',
  colorEnd: '#0a4f2d',
  tint: '#dcf3e5',
  Icon,
  howToPlay: {
    en: (
      <>
        <p>Finish closer to 21 than the dealer without going over.</p>
        <ul>
          <li>Cards 2–10 count their number, J, Q and K count 10, and an ace counts 1 or 11, whichever helps.</li>
          <li>A blackjack (an ace and a 10-value card as your first two cards) pays 3:2. Other wins pay 1:1, and a tie is a push: you get your bet back.</li>
          <li>Hit to take a card, Stand to keep your hand. Double doubles your bet for exactly one more card. Split turns a pair into two hands with a bet each; split aces get one card each.</li>
          <li>The dealer draws to 16 and stands on every 17, and checks for blackjack when showing an ace or a 10. Six decks, reshuffled when the shoe runs low.</li>
        </ul>
      </>
    ),
    es: (
      <>
        <p>Termina más cerca de 21 que el crupier sin pasarte.</p>
        <ul>
          <li>Las cartas del 2 al 10 valen su número, la J, la Q y la K valen 10, y el as vale 1 u 11, lo que más te convenga.</li>
          <li>Un blackjack (un as y una carta de valor 10 como tus dos primeras cartas) paga 3:2. Las demás victorias pagan 1:1, y un empate te devuelve la apuesta.</li>
          <li>Pide para tomar una carta y Plántate para quedarte. Doblar duplica tu apuesta a cambio de una sola carta más. Dividir separa un par en dos manos con su propia apuesta; los ases divididos reciben una carta cada uno.</li>
          <li>El crupier pide hasta 16 y se planta con cualquier 17, y revisa si tiene blackjack cuando muestra un as o un 10. Se juega con seis barajas que se mezclan cuando quedan pocas cartas.</li>
        </ul>
      </>
    ),
  },
};
