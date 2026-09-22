import type { GameMeta } from '../../core/types';

function Icon({ size = 48 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden>
      <rect x="4" y="4" width="40" height="40" rx="7" fill="#fff" stroke="#1f1f1f" strokeWidth="3" />
      <rect x="8" y="8" width="13" height="32" rx="3" fill="#4a8bf5" />
      <rect x="24" y="8" width="16" height="15" rx="3" fill="#f54545" />
      <rect x="24" y="26" width="16" height="14" rx="3" fill="#ffc93c" />
      <text x="32" y="19.3" textAnchor="middle" fontSize="9" fontWeight="700" fill="#fff" fontFamily="system-ui">4</text>
    </svg>
  );
}

export const meta: GameMeta = {
  id: 'patches',
  name: 'Patches',
  tagline: 'Piece it together',
  color: '#f54545',
  colorEnd: '#d93333',
  tint: '#fddada',
  scoring: 'time',
  Icon,
  options: [
    {
      id: 'size',
      label: 'Size',
      default: '6',
      choices: ['5', '6', '7', '8'].map((v) => ({ value: v, label: `${v}×${v}` })),
    },
  ],
  howToPlay: (
    <>
      <p>Cover the whole grid with rectangular patches.</p>
      <ul>
        <li>Each patch must contain exactly one clue.</li>
        <li>A number tells you how many cells the patch covers.</li>
        <li>A shape tells you whether the patch is a square, wide (wider than tall) or tall (taller than wide). A dashed shape can be any rectangle.</li>
        <li>Drag across cells to draw a patch; tap a patch to remove it.</li>
      </ul>
    </>
  ),
};
