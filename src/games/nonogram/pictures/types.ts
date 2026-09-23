/** A hand-drawn nonogram picture: `rows` are N strings of N chars, '#' = filled, '.' = empty. */
export interface Picture {
  name: string;
  rows: string[];
}
