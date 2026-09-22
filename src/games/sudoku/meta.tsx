import type { GameMeta } from '../../core/types';

function Icon({ size = 48 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden>
      <rect x="4" y="4" width="40" height="40" rx="7" fill="#fff" stroke="#1f1f1f" strokeWidth="3" />
      <path d="M24 5.5v37M5.5 18.5h37M5.5 30.5h37" stroke="#1f1f1f" strokeWidth="2.2" />
      <path d="M14 5.5v37M34 5.5v37" stroke="#1f1f1f" strokeWidth="1" opacity=".35" />
      <rect x="25" y="19.5" width="8" height="10" fill="#9ce6c4" />
      <text x="9.5" y="15.5" fontSize="9" fontWeight="700" fill="#1f1f1f" fontFamily="system-ui">3</text>
      <text x="28.5" y="27.5" fontSize="9" fontWeight="700" fill="#1f1f1f" fontFamily="system-ui" textAnchor="middle">5</text>
      <text x="36.5" y="39.5" fontSize="9" fontWeight="700" fill="#1f7a4f" fontFamily="system-ui">1</text>
    </svg>
  );
}

export const meta: GameMeta = {
  id: 'sudoku',
  name: 'Mini Sudoku',
  tagline: 'The classic game, made mini',
  color: '#1f7a4f',
  colorEnd: '#2d9a66',
  tint: '#d6faee',
  scoring: 'time',
  Icon,
  options: [
    {
      id: 'difficulty',
      label: 'Difficulty',
      default: 'medium',
      choices: [
        { value: 'easy', label: 'Easy' },
        { value: 'medium', label: 'Medium' },
        { value: 'hard', label: 'Hard' },
      ],
    },
  ],
  settings: [
    { key: 'showErrors', label: 'Show conflicts', description: 'Highlight numbers that repeat in a row, column, or box.', default: true },
    { key: 'autoNotes', label: 'Auto-clear notes', description: 'Remove a note automatically when that number is placed nearby.', default: true },
  ],
  howToPlay: (
    <>
      <p>Fill the 6×6 grid so that every row, column, and 2×3 box contains the numbers 1 through 6.</p>
      <ul>
        <li>Select a cell, then tap a number (or type 1–6).</li>
        <li>Switch on Notes to pencil in candidates.</li>
        <li>Every puzzle has exactly one solution.</li>
      </ul>
    </>
  ),
};
