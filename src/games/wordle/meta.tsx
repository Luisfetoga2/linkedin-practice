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
  tagline: { en: 'Guess the hidden word', es: 'Adivina la palabra oculta' },
  color: '#4e8a48',
  colorEnd: '#3b7036',
  tint: '#e2f3de',
  scoring: 'guesses',
  maxGuesses: 6,
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
  settings: [
    {
      key: 'hardMode',
      label: { en: 'Hard mode', es: 'Modo difícil' },
      description: {
        en: 'Any revealed hints must be used in later guesses.',
        es: 'Las letras que ya descubriste deben usarse en los siguientes intentos.',
      },
      default: false,
    },
    {
      key: 'highContrast',
      label: { en: 'High contrast', es: 'Alto contraste' },
      description: { en: 'Orange and blue instead of green and yellow.', es: 'Naranja y azul en lugar de verde y amarillo.' },
      default: false,
    },
  ],
  howToPlay: {
    en: (
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
        <p>Stuck? Tap Hint (up to 2 per round) to reveal one letter in its correct spot.</p>
      </>
    ),
    es: (
      <>
        <p>Adivina la palabra de 5 letras en 6 intentos.</p>
        <ul>
          <li>Cada intento debe ser una palabra válida de 5 letras.</li>
          <li>
            <strong>Verde</strong> significa que la letra está en la palabra y en el lugar correcto.
          </li>
          <li>
            <strong>Amarillo</strong> significa que la letra está en la palabra, pero en otro lugar.
          </li>
          <li>
            <strong>Gris</strong> significa que la letra no está en la palabra.
          </li>
        </ul>
        <p>
          Con la lista en español, los acentos no cuentan (Á es A) y la Ñ es una letra aparte. En el inicio puedes elegir
          palabras en inglés o en español.
        </p>
        <p>¿Te trabaste? Toca Pista (hasta 2 por ronda) para revelar una letra en su lugar correcto.</p>
      </>
    ),
  },
};
