import type { CasinoMeta } from '../../types';
import { FaceCell, IconFrame } from '../../../core/components/GameIcon';

function Icon({ size = 48 }: { size?: number }) {
  // A 3×3 field: two gems found, one mine, the rest still hidden.
  const at = (i: number) => 5.5 + i * 13;
  const open: Record<number, 'gem' | 'mine'> = { 1: 'gem', 3: 'gem', 8: 'mine' };
  return (
    <IconFrame size={size} dark>
      {Array.from({ length: 9 }, (_, i) => (
        <FaceCell key={i} x={at(i % 3)} y={at(Math.floor(i / 3))} w={11} h={11} fill={open[i] ? '#241a3d' : '#6b4bd6'} />
      ))}
      {[1, 3].map((i) => {
        const cx = at(i % 3) + 5.5;
        const cy = at(Math.floor(i / 3)) + 5.5;
        return (
          <g key={i}>
            <path d={`M${cx - 3.6} ${cy - 1.2}L${cx - 1.8} ${cy - 3.4}H${cx + 1.8}L${cx + 3.6} ${cy - 1.2}L${cx} ${cy + 3.8}Z`} fill="#3ee0a0" />
            <path d={`M${cx - 3.6} ${cy - 1.2}H${cx + 3.6}M${cx - 1.8} ${cy - 3.4}L${cx} ${cy + 3.8}L${cx + 1.8} ${cy - 3.4}`} stroke="#0e8f5f" strokeWidth="0.6" fill="none" />
          </g>
        );
      })}
      <circle cx={at(2) + 5.5} cy={at(2) + 6} r="3.3" fill="#ff4d4f" />
      <path d={`M${at(2) + 6.8} ${at(2) + 2.6}l1.4-1.4`} stroke="#ffd43b" strokeWidth="1.1" strokeLinecap="round" />
    </IconFrame>
  );
}

export const meta: CasinoMeta = {
  id: 'gems',
  name: { en: 'Gems', es: 'Gemas' },
  tagline: { en: 'Find gems, dodge the mines', es: 'Encuentra gemas y esquiva las minas' },
  color: '#6b3fd6',
  colorEnd: '#4f2aa8',
  tint: '#ece4ff',
  Icon,
  howToPlay: {
    en: (
      <>
        <p>Uncover gems on a 5×5 field and cash out before you hit a mine.</p>
        <ul>
          <li>Choose how many mines hide in the field (1 to 24) and place your bet.</li>
          <li>Every gem you uncover raises the multiplier. Cash out whenever you like to collect your bet times the multiplier.</li>
          <li>Uncover a mine and you lose the bet. More mines mean bigger multipliers for each gem.</li>
          <li>Multipliers match the real odds of surviving, minus a 1% house edge.</li>
        </ul>
      </>
    ),
    es: (
      <>
        <p>Descubre gemas en un campo de 5×5 y cobra antes de tocar una mina.</p>
        <ul>
          <li>Elige cuántas minas se esconden en el campo (de 1 a 24) y haz tu apuesta.</li>
          <li>Cada gema que descubres sube el multiplicador. Cobra cuando quieras para llevarte tu apuesta por el multiplicador.</li>
          <li>Si descubres una mina, pierdes la apuesta. Más minas significan multiplicadores más altos por cada gema.</li>
          <li>Los multiplicadores corresponden a las probabilidades reales de seguir a salvo, menos una ventaja de la casa del 1%.</li>
        </ul>
      </>
    ),
  },
};
