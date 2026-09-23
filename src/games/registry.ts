import type { GameEntry, GameId } from '../core/types';
import { meta as wend } from './wend/meta';
import { meta as patches } from './patches/meta';
import { meta as sudoku } from './sudoku/meta';
import { meta as zip } from './zip/meta';
import { meta as tango } from './tango/meta';
import { meta as queens } from './queens/meta';
import { meta as pinpoint } from './pinpoint/meta';
import { meta as crossclimb } from './crossclimb/meta';
import { meta as wordle } from './wordle/meta';
import { meta as nonogram } from './nonogram/meta';
import { meta as mini } from './mini/meta';

/** Home-page order mirrors LinkedIn's games page; Wordle, Nonogram and the Mini Crossword are extras. */
export const games: GameEntry[] = [
  { meta: wend, load: () => import('./wend/Game') },
  { meta: patches, load: () => import('./patches/Game') },
  { meta: sudoku, load: () => import('./sudoku/Game') },
  { meta: zip, load: () => import('./zip/Game') },
  { meta: tango, load: () => import('./tango/Game') },
  { meta: queens, load: () => import('./queens/Game') },
  { meta: pinpoint, load: () => import('./pinpoint/Game') },
  { meta: crossclimb, load: () => import('./crossclimb/Game') },
  { meta: wordle, load: () => import('./wordle/Game') },
  { meta: nonogram, load: () => import('./nonogram/Game') },
  { meta: mini, load: () => import('./mini/Game') },
];

export const gameIds = games.map((g) => g.meta.id);

export function findGame(id: string | undefined): GameEntry | undefined {
  return games.find((g) => g.meta.id === (id as GameId));
}
