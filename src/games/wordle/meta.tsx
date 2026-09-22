import type { GameMeta } from '../../core/types';

function Icon({ size = 48 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden>
      <rect x="4" y="4" width="40" height="40" rx="7" fill="#fff" stroke="#1f1f1f" strokeWidth="3" />
      <rect x="8" y="8" width="15" height="15" rx="2" fill="#6aaa64" />
      <rect x="25" y="8" width="15" height="15" rx="2" fill="#c9b458" />
      <rect x="8" y="25" width="15" height="15" rx="2" fill="#787c7e" />
      <rect x="25" y="25" width="15" height="15" rx="2" fill="#6aaa64" />
    </svg>
  );
}

export const meta: GameMeta = {
  id: 'wordle',
  name: 'Wordle',
  tagline: 'Guess the hidden word',
  color: '#4e8a48',
  colorEnd: '#3b7036',
  tint: '#e2f3de',
  scoring: 'guesses',
  maxGuesses: 6,
  Icon,
  settings: [
    { key: 'hardMode', label: 'Hard mode', description: 'Any revealed hints must be used in later guesses.', default: false },
    { key: 'highContrast', label: 'High contrast', description: 'Orange and blue instead of green and yellow.', default: false },
  ],
  howToPlay: (
    <>
      <p>Guess the 5-letter word in 6 tries.</p>
      <ul>
        <li>Each guess must be a valid 5-letter word.</li>
        <li>
          <strong>Green</strong> means the letter is in the word and in the right spot.
        </li>
        <li>
          <strong>Yellow</strong> means the letter is in the word but in the wrong spot.
        </li>
        <li>
          <strong>Gray</strong> means the letter is not in the word.
        </li>
      </ul>
    </>
  ),
};
