import type { GameMeta } from '../../core/types';
import { FaceCell, IconFrame } from '../../core/components/GameIcon';

function Icon({ size = 48 }: { size?: number }) {
  const shades = ['#b8d6ff', '#8dbcff', '#5f9dfb', '#3a7ff0', '#1d5fd6'];
  return (
    <IconFrame size={size} dark>
      {shades.map((c, i) => (
        <FaceCell key={c} x={5.5} y={5.5 + i * 7.8} w={37} h={5.8} r={2} fill={c} />
      ))}
    </IconFrame>
  );
}

export const meta: GameMeta = {
  id: 'pinpoint',
  name: 'Pinpoint',
  tagline: { en: 'Guess the category', es: 'Adivina la categoría' },
  color: '#1a6ff2',
  colorEnd: '#0a45b8',
  tint: '#e0efff',
  scoring: 'guesses',
  maxGuesses: 5,
  hasHints: false,
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
  Icon,
  howToPlay: {
    en: (
      <>
        <p>Five clue words all belong to one hidden category. Pinpoint it in as few guesses as you can.</p>
        <ul>
          <li>You start with one clue. Type the category and press Enter.</li>
          <li>Each wrong guess reveals the next clue. You have 5 guesses.</li>
          <li>Stuck? Tap Skip to spend a guess and see the next clue.</li>
          <li>Close answers count — “keys” works for <em>Things with keys</em>.</li>
          <li>When the round ends, see how close each of your guesses was to the category.</li>
        </ul>
      </>
    ),
    es: (
      <>
        <p>Cinco palabras clave pertenecen a una categoría oculta. Descúbrela con la menor cantidad de intentos posible.</p>
        <ul>
          <li>Empiezas con una pista. Escribe la categoría y presiona Enter.</li>
          <li>Cada intento fallido revela la siguiente pista. Tienes 5 intentos.</li>
          <li>¿Sin ideas? Toca Saltar para usar un intento y ver la siguiente pista.</li>
          <li>Las respuestas aproximadas cuentan: “llaves” sirve para <em>Cosas con llave</em>.</li>
          <li>Al terminar la ronda, verás qué tan cerca estuvo cada uno de tus intentos de la categoría.</li>
        </ul>
      </>
    ),
  },
};
