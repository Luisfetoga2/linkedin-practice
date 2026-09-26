import type { CasinoEntry, CasinoId } from './types';
import { meta as blackjack } from './games/blackjack/meta';
import { meta as gems } from './games/gems/meta';
import { meta as road } from './games/road/meta';
import { meta as rocket } from './games/rocket/meta';
import { meta as plinko } from './games/plinko/meta';

export const casinoGames: CasinoEntry[] = [
  { meta: blackjack, load: () => import('./games/blackjack/Game') },
  { meta: gems, load: () => import('./games/gems/Game') },
  { meta: road, load: () => import('./games/road/Game') },
  { meta: rocket, load: () => import('./games/rocket/Game') },
  { meta: plinko, load: () => import('./games/plinko/Game') },
];

export function findCasino(id: string | undefined): CasinoEntry | undefined {
  return casinoGames.find((g) => g.meta.id === (id as CasinoId));
}
