import { useSyncExternalStore } from 'react';
import type { GameId } from '../core/types';
import { readJSON, subscribeKey, writeJSON, removeKey } from './storage';
import { addDays, dayKey } from './time';

export interface PlayRecord {
  /** Finish timestamp (ms). */
  at: number;
  /** Active solve time (ms, pauses excluded). */
  ms: number;
  won: boolean;
  hints: number;
  /** Guess-scored games: guesses used. */
  guesses?: number;
  /** Variant key, e.g. "size=8" or "" for the default. */
  variant: string;
  seed: number;
}

const MAX_RECORDS = 2000;
const key = (game: GameId) => `history:${game}`;

export function loadHistory(game: GameId): PlayRecord[] {
  return readJSON<PlayRecord[]>(key(game), []);
}

export function addRecord(game: GameId, record: PlayRecord): void {
  const next = [...loadHistory(game), record].slice(-MAX_RECORDS);
  writeJSON(key(game), next);
}

export function clearHistory(game: GameId): void {
  removeKey(key(game));
}

export function useHistory(game: GameId): PlayRecord[] {
  return useSyncExternalStore(
    (fn) => subscribeKey(key(game), fn),
    () => loadHistory(game),
  );
}

export interface Streak {
  current: number;
  max: number;
  /** Did the streak already get extended today? */
  today: boolean;
}

/** Consecutive local days with at least one win. A streak survives until a full day is missed. */
export function dayStreak(days: Iterable<string>, now = Date.now()): Streak {
  const set = new Set(days);
  if (set.size === 0) return { current: 0, max: 0, today: false };
  const sorted = [...set].sort();
  let max = 1;
  let run = 1;
  for (let i = 1; i < sorted.length; i++) {
    run = addDays(sorted[i - 1], 1) === sorted[i] ? run + 1 : 1;
    max = Math.max(max, run);
  }
  const today = dayKey(now);
  let cursor = set.has(today) ? today : addDays(today, -1);
  let current = 0;
  while (set.has(cursor)) {
    current++;
    cursor = addDays(cursor, -1);
  }
  return { current, max, today: set.has(today) };
}

export interface GameStats {
  played: number;
  wins: number;
  winRate: number;
  streak: Streak;
  /** Consecutive wins (meaningful for games you can lose). */
  winStreak: number;
  maxWinStreak: number;
  bestMs: number | null;
  avgMs: number | null;
  medianMs: number | null;
  last10AvgMs: number | null;
  todayPlayed: number;
  hintsUsed: number;
  cleanWins: number;
  /** index = guesses used (1-based), value = wins with that many guesses */
  guessDist: number[];
  avgGuesses: number | null;
}

function median(values: number[]): number | null {
  if (!values.length) return null;
  const s = [...values].sort((a, b) => a - b);
  const mid = s.length >> 1;
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

const mean = (v: number[]) => (v.length ? v.reduce((a, b) => a + b, 0) / v.length : null);

export function computeStats(history: PlayRecord[], variant?: string, now = Date.now()): GameStats {
  const recs = variant === undefined ? history : history.filter((r) => r.variant === variant);
  const wins = recs.filter((r) => r.won);
  const times = wins.map((r) => r.ms);
  let winStreak = 0;
  let maxWinStreak = 0;
  let run = 0;
  for (const r of recs) {
    run = r.won ? run + 1 : 0;
    maxWinStreak = Math.max(maxWinStreak, run);
  }
  for (let i = recs.length - 1; i >= 0 && recs[i].won; i--) winStreak++;
  const guessDist: number[] = [];
  for (const r of wins) if (r.guesses) guessDist[r.guesses] = (guessDist[r.guesses] ?? 0) + 1;
  const guesses = wins.map((r) => r.guesses).filter((g): g is number => !!g);
  const today = dayKey(now);
  return {
    played: recs.length,
    wins: wins.length,
    winRate: recs.length ? wins.length / recs.length : 0,
    streak: dayStreak(
      wins.map((r) => dayKey(r.at)),
      now,
    ),
    winStreak,
    maxWinStreak,
    bestMs: times.length ? Math.min(...times) : null,
    avgMs: mean(times),
    medianMs: median(times),
    last10AvgMs: mean(times.slice(-10)),
    todayPlayed: recs.filter((r) => dayKey(r.at) === today).length,
    hintsUsed: recs.reduce((a, r) => a + r.hints, 0),
    cleanWins: wins.filter((r) => r.hints === 0).length,
    guessDist,
    avgGuesses: mean(guesses),
  };
}

/** Days on which any game was won, across all games. */
export function allWinDays(games: GameId[]): Map<string, number> {
  const days = new Map<string, number>();
  for (const g of games) for (const r of loadHistory(g)) if (r.won) days.set(dayKey(r.at), (days.get(dayKey(r.at)) ?? 0) + 1);
  return days;
}

export function variantKey(options: Record<string, string>): string {
  return Object.keys(options)
    .sort()
    .map((k) => `${k}=${options[k]}`)
    .join('&');
}
