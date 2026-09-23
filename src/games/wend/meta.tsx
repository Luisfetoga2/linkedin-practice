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
  tagline: { en: 'Weave through words', es: 'Entrelaza palabras' },
  color: '#eeb500',
  colorEnd: '#d99800',
  tint: '#fbf1cc',
  scoring: 'time',
  Icon,
  options: [
    {
      id: 'size',
      label: { en: 'Grid', es: 'Cuadrícula' },
      default: '5',
      choices: [
        { value: '5', label: '5×5' },
        { value: '6', label: '6×6' },
      ],
    },
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
        <p>Find the hidden words that snake through the grid.</p>
        <ul>
          <li>Drag through neighboring letters — up, down, left or right, never diagonally — to draw a line. Lines stay on the board; a line that spells a hidden word lights up in color.</li>
          <li>Start a drag on an existing line to continue it from that letter. Drag into the start or end of another line to join them, or through its middle to erase it.</li>
          <li>Words bend around the gray walls.</li>
          <li>Every letter is used by exactly one word, so a real word in the wrong place can block the rest.</li>
          <li>The slots below the grid show how long each hidden word is.</li>
          <li>You can also tap tile by tile. On a keyboard, type letters (or Space and the arrows), then Enter.</li>
          <li>Stuck? Undo reverts your last move, and Hint reveals the next letter of a word you're looking for and fixes your lines to match. The little arrows on a line show which way it reads.</li>
        </ul>
      </>
    ),
    es: (
      <>
        <p>Encuentra las palabras ocultas que serpentean por la cuadrícula.</p>
        <ul>
          <li>Arrastra por letras vecinas (arriba, abajo, izquierda o derecha, nunca en diagonal) para trazar una línea. Las líneas se quedan en el tablero; si una línea forma una palabra oculta, se ilumina de color.</li>
          <li>Empieza a arrastrar sobre una línea que ya trazaste para continuarla desde esa letra. Arrastra hasta el inicio o el final de otra línea para unirlas, o por su parte media para borrarla.</li>
          <li>Las palabras rodean los muros grises.</li>
          <li>Cada letra pertenece a exactamente una palabra, así que una palabra real en el lugar equivocado puede bloquear las demás.</li>
          <li>Los espacios debajo de la cuadrícula muestran cuántas letras tiene cada palabra oculta.</li>
          <li>En las palabras en español, los acentos no cuentan (Á es A), pero la Ñ es una letra aparte.</li>
          <li>También puedes tocar casilla por casilla. Con teclado, escribe las letras (o usa Espacio y las flechas) y luego Enter.</li>
          <li>¿No sabes cómo seguir? Deshacer revierte tu último movimiento, y Pista revela la siguiente letra de una palabra que estás buscando y ajusta tus líneas para que coincidan. Las flechitas de cada línea muestran en qué sentido se lee.</li>
        </ul>
      </>
    ),
  },
};
