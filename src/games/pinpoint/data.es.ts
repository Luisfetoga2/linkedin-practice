import { parseCategories, type Category } from './data';
import juegos from './data/es/juegos';
import cosas from './data/es/cosas';
import saber from './data/es/saber';
import cultura from './data/es/cultura';

/** Spanish Pinpoint categories (written for Spanish, not translated from the English set). */
export const CATEGORIES_ES: readonly Category[] = [juegos, cosas, saber, cultura].flatMap(parseCategories);
