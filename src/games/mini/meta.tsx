import type { GameMeta } from '../../core/types';

function Icon({ size = 48 }: { size?: number }) {
  // A tiny crossword: 3×3 with one black square and a numbered corner.
  const cells = [
    [0, 0],
    [1, 0],
    [2, 0],
    [0, 1],
    [1, 1],
    [0, 2],
    [2, 1],
    [1, 2],
  ];
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden>
      <rect x="4" y="4" width="40" height="40" rx="7" fill="#1f1f1f" />
      {cells.map(([c, r]) => (
        <rect key={`${c}${r}`} x={7 + c * 11.7} y={7 + r * 11.7} width="10.6" height="10.6" rx="1.4" fill={r === 0 ? '#9fb4ff' : '#fff'} />
      ))}
      <rect x={7 + 2 * 11.7} y={7 + 2 * 11.7} width="10.6" height="10.6" rx="1.4" fill="#1f1f1f" />
      <text x="9" y="12.6" fontSize="4.6" fontWeight="700" fill="#1f1f1f" fontFamily="system-ui">1</text>
    </svg>
  );
}

export const meta: GameMeta = {
  id: 'mini',
  name: { en: 'Mini Crossword', es: 'Mini crucigrama' },
  tagline: { en: 'A crossword in minutes', es: 'Un crucigrama en minutos' },
  color: '#4b50c9',
  colorEnd: '#3a3fa8',
  tint: '#e4e5ff',
  scoring: 'time',
  Icon,
  options: [
    {
      id: 'words',
      label: { en: 'Words', es: 'Palabras' },
      default: 'en',
      followsLanguage: true,
      choices: [
        { value: 'en', label: { en: 'English', es: 'Inglés' } },
        { value: 'es', label: { en: 'Spanish', es: 'Español' } },
      ],
    },
  ],
  howToPlay: {
    en: (
      <>
        <p>Fill the small grid so every row and column answers its clue.</p>
      </>
    ),
    es: (
      <>
        <p>Completa la cuadrícula para que cada fila y columna responda su pista.</p>
      </>
    ),
  },
};
