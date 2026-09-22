import type { GameMeta } from '../../core/types';

function Icon({ size = 48 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden>
      <rect x="4" y="4" width="40" height="40" rx="7" fill="#fff" stroke="#1f1f1f" strokeWidth="3" />
      <path d="M14 14h20v10H14v10h20" fill="none" stroke="#ff7a2e" strokeWidth="7" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="14" cy="14" r="5" fill="#1f1f1f" />
      <circle cx="34" cy="34" r="5" fill="#1f1f1f" />
      <text x="14" y="16.6" textAnchor="middle" fontSize="7" fontWeight="700" fill="#fff" fontFamily="system-ui">1</text>
      <text x="34" y="36.6" textAnchor="middle" fontSize="7" fontWeight="700" fill="#fff" fontFamily="system-ui">2</text>
    </svg>
  );
}

export const meta: GameMeta = {
  id: 'zip',
  name: 'Zip',
  tagline: 'Complete the path',
  color: '#ee5b14',
  colorEnd: '#d24a0b',
  tint: '#ffdccd',
  scoring: 'time',
  Icon,
  options: [
    {
      id: 'size',
      label: 'Size',
      default: '7',
      choices: ['5', '6', '7', '8'].map((v) => ({ value: v, label: `${v}×${v}` })),
    },
  ],
  howToPlay: (
    <>
      <p>Draw a single path that connects the numbers in order and fills every cell.</p>
      <ul>
        <li>Start at 1 and visit every number in ascending order, ending on the highest number.</li>
        <li>The path must pass through every cell exactly once.</li>
        <li>The path can’t cross thick walls.</li>
        <li>Drag back over the path to erase part of it.</li>
      </ul>
    </>
  ),
};
