import { secureRandom, type RandomFn } from '../../random';

export type Level = 'easy' | 'medium' | 'hard' | 'expert';
export const LEVELS: readonly Level[] = ['easy', 'medium', 'hard', 'expert'];
export const DEFAULT_LEVEL: Level = 'medium';

/** Chance that a car comes down any one lane as the chicken steps into it. */
export const HIT_CHANCE: Record<Level, number> = { easy: 0.04, medium: 0.12, hard: 0.2, expert: 0.4 };

/** Lanes between the start grass and the far sidewalk. */
export const LANES = 20;

/** Return to player: every multiplier is the fair price times this (a 1% house edge). */
export const RTP = 0.99;

export function isLevel(v: unknown): v is Level {
  return typeof v === 'string' && (LEVELS as readonly string[]).includes(v);
}

/** Chance of getting through one lane. */
export function survival(level: Level): number {
  return 1 - HIT_CHANCE[level];
}

/**
 * What the bet is multiplied by after crossing `lanes` lanes: 0.99 / s^lanes, floored to cents of a
 * multiplier (so the house edge never rounds in the player's favour). 0 lanes = ×1 (nothing won yet).
 */
export function multiplier(level: Level, lanes: number): number {
  if (lanes <= 0) return 1;
  const fair = RTP / Math.pow(survival(level), lanes);
  // The epsilon keeps exact values such as 1.125 from flooring a cent low through float noise.
  return Math.floor(fair * 100 + 1e-7) / 100;
}

/** Multipliers for lanes 1..LANES (index 0 = lane 1). */
export function multiplierTable(level: Level, lanes = LANES): number[] {
  return Array.from({ length: lanes }, (_, i) => multiplier(level, i + 1));
}

/** What the chicken meets in the next lane: a draw below the hit chance is a car. */
export function stepOutcome(level: Level, rng: RandomFn = secureRandom): 'safe' | 'hit' {
  return rng() < HIT_CHANCE[level] ? 'hit' : 'safe';
}

export type Phase = 'idle' | 'live' | 'hit' | 'cashed' | 'crossed';

export interface RoadState {
  phase: Phase;
  level: Level;
  /** Lanes crossed safely (the chicken stands in this lane; 0 = still on the start grass). */
  lane: number;
  /** Lane where the car got the chicken (phase 'hit'). */
  hitLane?: number;
}

export function startRoad(level: Level): RoadState {
  return { phase: 'live', level, lane: 0 };
}

/** One "Go": the chicken steps into the next lane. Reaching the last lane ends the round as 'crossed'. */
export function advance(state: RoadState, rng: RandomFn = secureRandom): RoadState {
  if (state.phase !== 'live') return state;
  const next = state.lane + 1;
  if (stepOutcome(state.level, rng) === 'hit') return { ...state, phase: 'hit', hitLane: next };
  return { ...state, lane: next, phase: next >= LANES ? 'crossed' : 'live' };
}

/** Cash out is allowed once at least one lane is crossed. */
export function canCashOut(state: RoadState): boolean {
  return state.phase === 'live' && state.lane >= 1;
}

export function cashOut(state: RoadState): RoadState {
  return canCashOut(state) ? { ...state, phase: 'cashed' } : state;
}

/** Everything paid back for this state (stake included): 0 when hit, bet × multiplier when cashed or across. */
export function payoutFor(state: RoadState, bet: number): number {
  if (state.phase === 'hit') return 0;
  return Math.round(bet * multiplier(state.level, state.lane) * 100) / 100;
}
