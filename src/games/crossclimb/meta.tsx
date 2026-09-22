import type { GameMeta } from '../../core/types';

function Icon({ size = 48 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden>
      <rect x="4" y="4" width="40" height="40" rx="7" fill="#fff" stroke="#1f1f1f" strokeWidth="3" />
      {[0, 1, 2, 3].map((i) => (
        <rect key={i} x="9" y={9 + i * 8} width="30" height="6" rx="2" fill={i === 0 || i === 3 ? '#9fe3ee' : '#1fb6cc'} />
      ))}
    </svg>
  );
}

export const meta: GameMeta = {
  id: 'crossclimb',
  name: 'Crossclimb',
  tagline: 'Unlock a trivia ladder',
  color: '#0a8fa6',
  colorEnd: '#07778b',
  tint: '#def9fc',
  scoring: 'time',
  Icon,
  options: [
    {
      id: 'length',
      label: 'Word length',
      default: '4',
      choices: [
        { value: '4', label: '4 letters' },
        { value: '5', label: '5 letters' },
      ],
    },
  ],
  howToPlay: (
    <>
      <p>Guess words from the clues, then order them into a word ladder.</p>
      <ul>
        <li>Answer the five middle clues in any order.</li>
        <li>Drag the rows so each word differs from its neighbors by exactly one letter.</li>
        <li>Once the ladder is in order, the top and bottom rows unlock. Solve them to finish.</li>
      </ul>
    </>
  ),
};
