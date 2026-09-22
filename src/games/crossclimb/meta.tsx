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
  settings: [
    {
      key: 'links',
      label: 'Show matching neighbors',
      description: 'While ordering, mark rows that already differ from the row below by one letter.',
      default: false,
    },
  ],
  howToPlay: (
    <>
      <p>Guess words from the clues, then order them into a word ladder.</p>
      <ul>
        <li>Answer the five middle clues in any order. Tap a row (or use the arrows on the clue card) to see its clue.</li>
        <li>You won't be told whether a single answer is right. Once all five are correct, you'll be asked to put them in order.</li>
        <li>Drag the rows by the ≡ handle so each word differs from its neighbors by exactly one letter.</li>
        <li>Once the ladder is in order, the top and bottom rows unlock. They share a single clue: two related words, or a compound read top then bottom. Solve both to finish.</li>
        <li>Stuck? A hint reveals the next letter, tells you when a filled-in word isn't right, or points out a row that is out of place.</li>
      </ul>
    </>
  ),
};
