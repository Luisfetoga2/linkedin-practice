// Spanish (Latin American) Crossclimb data: clued vocabulary and end-rung pairs. This module is
// loaded with a dynamic import() only when the Words option is Spanish (see ../index.ts).
import c4_a from './clues4_a';
import c4_b from './clues4_b';
import c4_c from './clues4_c';
import c5_a from './clues5_a';
import c5_b from './clues5_b';
import c5_c from './clues5_c';
import c5_d from './clues5_d';
import p4 from './pairs4';
import p5 from './pairs5';

export const CLUES = { 4: [c4_a, c4_b, c4_c], 5: [c5_a, c5_b, c5_c, c5_d] };
export const PAIRS = { 4: p4, 5: p5 };
