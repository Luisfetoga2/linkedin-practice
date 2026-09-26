import type { CasinoMeta } from '../../types';
import { IconFrame } from '../../../core/components/GameIcon';

function Icon({ size = 48 }: { size?: number }) {
  // A triangle of pegs, a ball on its way down, and the prize buckets.
  const rows = [3, 4, 5];
  const buckets = ['#ff4d4f', '#ff922b', '#ffd43b', '#ff922b', '#ff4d4f'];
  return (
    <IconFrame size={size} dark>
      <rect x="5.5" y="5.5" width="37" height="37" rx="5.5" fill="#1f2a44" />
      {rows.flatMap((n, r) =>
        Array.from({ length: n }, (_, i) => <circle key={`${r}${i}`} cx={24 + (i - (n - 1) / 2) * 6.4} cy={12.5 + r * 7} r="1.3" fill="#e9ecef" />),
      )}
      <circle cx="27.2" cy="22.8" r="2.4" fill="#ff5c93" />
      {buckets.map((c, i) => (
        <rect key={i} x={9.3 + i * 6.1} y="34" width="5.1" height="4.4" rx="1.2" fill={c} />
      ))}
    </IconFrame>
  );
}

export const meta: CasinoMeta = {
  id: 'plinko',
  name: 'Plinko',
  tagline: { en: 'Drop balls, watch them bounce', es: 'Suelta bolas y míralas rebotar' },
  color: '#c2255c',
  colorEnd: '#a61e4d',
  tint: '#ffe3ec',
  Icon,
  howToPlay: {
    en: (
      <>
        <p>Drop balls through the pegs and win the multiplier of the bucket each one lands in.</p>
        <ul>
          <li>Choose how many rows of pegs (8 to 16) and the risk: Low, Medium or High. Higher risk makes the edges pay much more and the middle much less.</li>
          <li>Choose how many balls to drop at once. Each ball is its own bet of your bet amount.</li>
          <li>At every peg a ball goes left or right with equal chance, so most balls land near the middle and the big edge prizes are rare.</li>
          <li>Each board pays back about 99% of what's bet over the long run.</li>
        </ul>
      </>
    ),
    es: (
      <>
        <p>Suelta bolas entre los clavos y gana el multiplicador de la casilla donde cae cada una.</p>
        <ul>
          <li>Elige cuántas filas de clavos (de 8 a 16) y el riesgo: Bajo, Medio o Alto. Con más riesgo, los extremos pagan mucho más y el centro mucho menos.</li>
          <li>Elige cuántas bolas soltar de una vez. Cada bola es una apuesta propia por el monto de tu apuesta.</li>
          <li>En cada clavo la bola va a la izquierda o a la derecha con la misma probabilidad, así que la mayoría cae cerca del centro y los premios grandes de los extremos son raros.</li>
          <li>Cada tablero devuelve alrededor del 99% de lo apostado a la larga.</li>
        </ul>
      </>
    ),
  },
};
