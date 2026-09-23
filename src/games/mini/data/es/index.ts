// Spanish (Latin American) clued vocabulary for the Mini Crossword. The 4- and 5-letter words and
// clues of Crossclimb's Spanish data are shared (imported read-only); the chunks here add 3-letter
// words and many more 4- and 5-letter entries (verb forms, plurals, places...) so grids fill
// reliably. Every clue is original. Chunks are template strings of `WORD|clue|alt clue` lines;
// words are uppercase without accents and Ñ is its own letter. Loaded with a dynamic import() only
// when the Words option is Spanish.
import cc4a from '../../../crossclimb/data/es/clues4_a';
import cc4b from '../../../crossclimb/data/es/clues4_b';
import cc4c from '../../../crossclimb/data/es/clues4_c';
import cc5a from '../../../crossclimb/data/es/clues5_a';
import cc5b from '../../../crossclimb/data/es/clues5_b';
import cc5c from '../../../crossclimb/data/es/clues5_c';
import cc5d from '../../../crossclimb/data/es/clues5_d';
import { parseEntries } from '../parse';
import type { ClueEntry } from '../types';
import c3 from './clues3';
import c4a from './clues4_a';
import c4b from './clues4_b';
import c5a from './clues5_a';
import c5b from './clues5_b';
import c5c from './clues5_c';
import c5d from './clues5_d';
import c5e from './clues5_e';
import c5f from './clues5_f';
import c5g from './clues5_g';
import ma from './more_a';
import mb from './more_b';
import mc from './more_c';
import md from './more_d';
import me from './more_e';
import mf from './more_f';

/** Chunks written for the Mini (Crossclimb's are listed separately in SHARED_CHUNKS). */
export const OWN_CHUNKS: readonly string[] = [c3, c4a, c4b, c5a, c5b, c5c, c5d, c5e, c5f, c5g];
/**
 * Extra material, parsed last: more clues for words that already exist (merged by the parser) plus
 * new words, which land at the end so current words keep their indexes.
 */
export const MORE_CHUNKS: readonly string[] = [ma, mb, mc, md, me, mf];
export const SHARED_CHUNKS: readonly string[] = [cc4a, cc4b, cc4c, cc5a, cc5b, cc5c, cc5d];

/** File order is kept (Crossclimb's chunks first), so generation stays deterministic. */
export const ENTRIES: ClueEntry[] = parseEntries([...SHARED_CHUNKS, ...OWN_CHUNKS, ...MORE_CHUNKS]);
