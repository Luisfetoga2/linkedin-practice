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
  tagline: { en: 'Unlock a trivia ladder', es: 'Desbloquea una escalera de trivia' },
  color: '#0a8fa6',
  colorEnd: '#07778b',
  tint: '#def9fc',
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
    {
      id: 'length',
      label: { en: 'Word length', es: 'Longitud de palabra' },
      default: '4',
      choices: [
        { value: '4', label: { en: '4 letters', es: '4 letras' } },
        { value: '5', label: { en: '5 letters', es: '5 letras' } },
      ],
    },
  ],
  settings: [
    {
      key: 'links',
      label: { en: 'Show matching neighbors', es: 'Mostrar vecinas que coinciden' },
      description: {
        en: 'While ordering, mark rows that already differ from the row below by one letter.',
        es: 'Al ordenar, marca las filas que ya difieren en una sola letra de la fila de abajo.',
      },
      default: false,
    },
  ],
  howToPlay: {
    en: (
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
    es: (
      <>
        <p>Adivina palabras a partir de las pistas y luego ordénalas para formar una escalera de palabras.</p>
        <ul>
          <li>Responde las cinco pistas del medio en el orden que quieras. Toca una fila (o usa las flechas de la tarjeta de la pista) para ver su pista.</li>
          <li>No sabrás si una respuesta individual es correcta. Cuando las cinco estén bien, tendrás que ordenarlas.</li>
          <li>Arrastra las filas con el ícono ≡ para que cada palabra difiera de sus vecinas en exactamente una letra.</li>
          <li>Con la escalera en orden, se desbloquean la fila de arriba y la de abajo. Comparten una sola pista: dos palabras relacionadas o una palabra compuesta que se lee de arriba hacia abajo. Resuelve ambas para terminar.</li>
          <li>¿No sabes cómo seguir? Una pista revela la siguiente letra, te avisa cuando una palabra completa no es correcta o señala una fila fuera de lugar.</li>
          <li>Con las palabras en español, los acentos no cuentan (Á es A) y la Ñ es una letra aparte. En el inicio puedes elegir palabras en inglés o en español.</li>
        </ul>
      </>
    ),
  },
};
