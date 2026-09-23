// English clued vocabulary for the Mini Crossword. The 4- and 5-letter words and clues are shared
// with Crossclimb (imported read-only); the extra chunks here add 3-letter words and more fill.
// Every clue is original. Chunks are template strings of `WORD|clue|alternative clue` lines.
import c4aa from '../../../crossclimb/data/clues4_aa';
import c4ab from '../../../crossclimb/data/clues4_ab';
import c4ac from '../../../crossclimb/data/clues4_ac';
import c4ad from '../../../crossclimb/data/clues4_ad';
import c4ae from '../../../crossclimb/data/clues4_ae';
import c5aa from '../../../crossclimb/data/clues5_aa';
import c5ab from '../../../crossclimb/data/clues5_ab';
import c5ac from '../../../crossclimb/data/clues5_ac';
import c5ad from '../../../crossclimb/data/clues5_ad';
import c3a from './clues3_a';
import c3b from './clues3_b';
import c4a from './clues4_a';
import c5a from './clues5_a';
import c5b from './clues5_b';
import { parseEntries } from '../parse';
import type { ClueEntry } from '../types';

export const ENTRIES: ClueEntry[] = parseEntries([c3a, c3b, c4a, c5a, c5b, c4aa, c4ab, c4ac, c4ad, c4ae, c5aa, c5ab, c5ac, c5ad]);
