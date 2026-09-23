import { parseNear } from './near';
import juegos from './data/es/near/juegos';
import cosas from './data/es/near/cosas';
import saber from './data/es/near/saber';
import cultura from './data/es/near/cultura';

/** Spanish category name → related concepts (closest first), for the end-of-round closeness recap. */
export const NEAR_ES: ReadonlyMap<string, readonly string[]> = parseNear([juegos, cosas, saber, cultura]);

export function nearForEs(name: string): readonly string[] {
  return NEAR_ES.get(name) ?? [];
}
