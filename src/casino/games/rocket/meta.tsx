import type { CasinoMeta } from '../../types';
import { IconFrame } from '../../../core/components/GameIcon';

function Icon({ size = 48 }: { size?: number }) {
  // A rocket climbing the multiplier curve against a night sky.
  return (
    <IconFrame size={size} dark>
      <rect x="5.5" y="5.5" width="37" height="37" rx="5.5" fill="#1b2559" />
      <circle cx="12" cy="12" r="0.8" fill="#fff" opacity=".8" />
      <circle cx="20" cy="9" r="0.6" fill="#fff" opacity=".6" />
      <circle cx="35" cy="24" r="0.7" fill="#fff" opacity=".7" />
      <circle cx="10" cy="22" r="0.5" fill="#fff" opacity=".5" />
      <path d="M8.5 39C18 38.6 24 33 27 23.5" fill="none" stroke="#ff922b" strokeWidth="2.6" strokeLinecap="round" />
      <g transform="translate(31 16) rotate(32) scale(1.2) translate(-34 -12)">
        <path d="M34 4.6Q38.9 8.6 37.3 14.7H30.7Q29.1 8.6 34 4.6Z" fill="#f1f3f5" />
        <circle cx="34" cy="10.3" r="1.4" fill="#4dabf7" />
        <path d="M30.7 12.4l-2.1 3.3h2.3zM37.3 12.4l2.1 3.3h-2.3z" fill="#fa5252" />
        <path d="M32.2 14.7h3.6l-1.8 3.8z" fill="#ffd43b" />
      </g>
    </IconFrame>
  );
}

export const meta: CasinoMeta = {
  id: 'rocket',
  name: { en: 'Rocket', es: 'Cohete' },
  tagline: { en: 'Cash out before it blows up', es: 'Cobra antes de que explote' },
  color: '#364fc7',
  colorEnd: '#2b3fa0',
  tint: '#e3e8ff',
  Icon,
  howToPlay: {
    en: (
      <>
        <p>Launch the rocket and cash out before it explodes.</p>
        <ul>
          <li>Place your bet and launch. The multiplier starts at ×1.00 and climbs faster and faster the longer the rocket flies.</li>
          <li>Cash out whenever you like to collect your bet times the current multiplier. If the rocket explodes first, you lose the bet.</li>
          <li>Set an auto cash-out to be paid automatically when the rocket reaches that multiplier.</li>
          <li>Every flight is random: the chance of reaching ×2 is 49.5%, ×10 is 9.9%, and ×100 is 0.99%. About 2 flights in 100 explode right on the launch pad.</li>
        </ul>
      </>
    ),
    es: (
      <>
        <p>Lanza el cohete y cobra antes de que explote.</p>
        <ul>
          <li>Haz tu apuesta y lanza. El multiplicador empieza en ×1.00 y sube cada vez más rápido mientras el cohete siga volando.</li>
          <li>Cobra cuando quieras para llevarte tu apuesta por el multiplicador actual. Si el cohete explota antes, pierdes la apuesta.</li>
          <li>Configura un cobro automático para cobrar sin tocar nada cuando el cohete llegue a ese multiplicador.</li>
          <li>Cada vuelo es aleatorio: la probabilidad de llegar a ×2 es del 49.5%, a ×10 del 9.9% y a ×100 del 0.99%. Más o menos 2 de cada 100 vuelos explotan en la misma plataforma.</li>
        </ul>
      </>
    ),
  },
};
