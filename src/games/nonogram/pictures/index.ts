import type { Picture } from './types';
import { PICTURES_5 } from './p5';
import { PICTURES_10 } from './p10';
import { PICTURES_15 } from './p15';

/** Hand-drawn pictures by grid size (a size without a library falls back to random pictures). */
export const PICTURES: Record<number, readonly Picture[]> = {
  5: PICTURES_5,
  10: PICTURES_10,
  15: PICTURES_15,
};
