/** A hand-drawn nonogram picture: `rows` are N strings of N chars, '#' = filled, '.' = empty. */
export interface Picture {
  name: string;
  /** Spanish name with its indefinite article, so the reveal agrees in gender/number ("una casa"). */
  es: string;
  rows: string[];
}
