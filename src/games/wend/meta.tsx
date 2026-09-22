import type { GameMeta } from '../../core/types';

function Icon({ size = 48 }: { size?: number }) {
  const tile = (x: number, y: number, l: string) => (
    <g key={l}>
      <rect x={x} y={y} width="17" height="17" rx="3" fill="#ffd54a" stroke="#1f1f1f" strokeWidth="2" />
      <text x={x + 8.5} y={y + 12.5} textAnchor="middle" fontSize="11" fontWeight="800" fill="#1f1f1f" fontFamily="system-ui">
        {l}
      </text>
    </g>
  );
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden>
      <rect x="4" y="4" width="40" height="40" rx="7" fill="#fff" stroke="#1f1f1f" strokeWidth="3" />
      {tile(6.5, 6.5, 'W')}
      {tile(24.5, 6.5, 'E')}
      {tile(24.5, 24.5, 'N')}
      <rect x="6.5" y="24.5" width="17" height="17" rx="3" fill="#b9b9b9" />
    </svg>
  );
}

export const meta: GameMeta = {
  id: 'wend',
  name: 'Wend',
  tagline: 'Weave through words',
  color: '#eeb500',
  colorEnd: '#d99800',
  tint: '#fbf1cc',
  scoring: 'time',
  Icon,
  options: [
    {
      id: 'size',
      label: 'Grid',
      default: '5',
      choices: [
        { value: '5', label: '5×5' },
        { value: '6', label: '6×6' },
      ],
    },
  ],
  howToPlay: (
    <>
      <p>Find the hidden words that snake through the grid.</p>
      <ul>
        <li>Drag through neighboring letters — up, down, left or right, never diagonally — to spell a word.</li>
        <li>Words bend around the gray walls.</li>
        <li>Every letter is used by exactly one word, so a real word in the wrong place can block the rest.</li>
        <li>The slots below the grid show how long each hidden word is.</li>
        <li>Drag or tap tile by tile (tap the last tile again to submit). On a keyboard, type letters or use the arrows, then Enter.</li>
        <li>Stuck? Undo removes your last word, and Hint reveals the next letter of a word you're looking for.</li>
      </ul>
    </>
  ),
};
