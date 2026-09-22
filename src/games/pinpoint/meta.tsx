import type { GameMeta } from '../../core/types';

function Icon({ size = 48 }: { size?: number }) {
  const shades = ['#b8d6ff', '#8dbcff', '#5f9dfb', '#3a7ff0', '#1d5fd6'];
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden>
      <rect x="4" y="4" width="40" height="40" rx="7" fill="#1f1f1f" />
      {shades.map((c, i) => (
        <rect key={c} x="7" y={7 + i * 7} width="34" height="6" rx="1.5" fill={c} />
      ))}
    </svg>
  );
}

export const meta: GameMeta = {
  id: 'pinpoint',
  name: 'Pinpoint',
  tagline: 'Guess the category',
  color: '#1a6ff2',
  colorEnd: '#0a45b8',
  tint: '#e0efff',
  scoring: 'guesses',
  maxGuesses: 5,
  Icon,
  howToPlay: (
    <>
      <p>Five clue words all belong to one hidden category. Pinpoint it in as few guesses as you can.</p>
      <ul>
        <li>You start with one clue. Type the category and press Enter.</li>
        <li>Each wrong guess reveals the next clue. You have 5 guesses.</li>
        <li>Close answers count — “keys” works for <em>Things with keys</em>.</li>
        <li>Stuck? <strong>Hint</strong> reveals the next clue, but it costs a guess.</li>
      </ul>
    </>
  ),
};
