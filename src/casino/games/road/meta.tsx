import type { CasinoMeta } from '../../types';
import { IconFrame } from '../../../core/components/GameIcon';

function Icon({ size = 48 }: { size?: number }) {
  // A chicken halfway across the road, a car coming down the next lane.
  return (
    <IconFrame size={size} dark>
      <rect x="5.5" y="5.5" width="37" height="37" rx="5.5" fill="#3d4450" />
      <rect x="5.5" y="5.5" width="7" height="37" fill="#5c940d" />
      <rect x="35.5" y="5.5" width="7" height="37" fill="#5c940d" />
      <path d="M20.5 7.5v33M28.5 7.5v33" stroke="#e9ecef" strokeWidth="1" strokeDasharray="3 3" />
      <rect x="29.8" y="9" width="5" height="9" rx="1.6" fill="#ffd43b" />
      <rect x="30.6" y="10.4" width="3.4" height="2.4" rx="0.6" fill="#1f1f1f" opacity=".6" />
      <circle cx="16.5" cy="28" r="4.2" fill="#fff" />
      <circle cx="16.5" cy="22.4" r="2.8" fill="#fff" />
      <path d="M15.4 19.8c.4-1.2 1.8-1.2 2.2 0" stroke="#e03131" strokeWidth="1.4" strokeLinecap="round" fill="none" />
      <path d="M19.2 22.4l1.8.6-1.8.6z" fill="#f59f00" />
      <circle cx="17.3" cy="22" r="0.55" fill="#1f1f1f" />
    </IconFrame>
  );
}

export const meta: CasinoMeta = {
  id: 'road',
  name: { en: 'Crossy Road', es: 'Cruza la calle' },
  tagline: { en: 'Cross lane by lane, cash out in time', es: 'Cruza carril por carril y cobra a tiempo' },
  color: '#4d7c0f',
  colorEnd: '#3a5f0b',
  tint: '#e8f5d6',
  Icon,
  howToPlay: {
    en: (
      <>
        <p>Help the chicken cross the road, one lane at a time.</p>
        <ul>
          <li>Pick a difficulty and place your bet. Each lane you cross safely raises the multiplier.</li>
          <li>Cash out whenever you like to collect your bet times the multiplier. If a car hits the chicken, you lose the bet.</li>
          <li>The difficulty sets the chance of a car in each lane: 4% on Easy, 12% on Medium, 20% on Hard and 40% on Expert. Harder roads pay more per lane.</li>
          <li>Make it all the way across and you're paid the top multiplier automatically. Multipliers match the real odds, minus a 1% house edge.</li>
        </ul>
      </>
    ),
    es: (
      <>
        <p>Ayuda a la gallina a cruzar la calle, carril por carril.</p>
        <ul>
          <li>Elige una dificultad y haz tu apuesta. Cada carril que cruzas a salvo sube el multiplicador.</li>
          <li>Cobra cuando quieras para llevarte tu apuesta por el multiplicador. Si un auto atropella a la gallina, pierdes la apuesta.</li>
          <li>La dificultad fija la probabilidad de que pase un auto en cada carril: 4% en Fácil, 12% en Media, 20% en Difícil y 40% en Experta. Las calles más difíciles pagan más por carril.</li>
          <li>Si llegas al otro lado, se te paga el multiplicador máximo automáticamente. Los multiplicadores corresponden a las probabilidades reales, menos una ventaja de la casa del 1%.</li>
        </ul>
      </>
    ),
  },
};
