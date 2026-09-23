/**
 * One clued fill word. `word` is uppercase letters only (A–Z, plus Ñ for Spanish), accents
 * removed, length 3–5. `clues` has at least one clue; extra clues add variety.
 */
export interface ClueEntry {
  word: string;
  clues: string[];
}
