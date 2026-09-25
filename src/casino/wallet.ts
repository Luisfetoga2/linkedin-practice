import { readJSON, useStoredState, writeJSON } from '../lib/storage';
import { LOCALE, type Lang } from '../lib/i18n';
import type { CasinoId } from './types';

/** One casino round. Play money only. */
export interface CasinoRecord {
  id: string;
  game: CasinoId;
  at: number;
  /** Everything put on the round (bet + doubles + splits). */
  stake: number;
  /** Everything returned, stake included (0 = lost). */
  payout: number;
  /** Still in progress. An open round that's never settled counts as lost. */
  open?: boolean;
  /** Short description for the history list ("Blackjack 3:2", "4 gems · 3 mines"...). */
  note?: string;
}

const KEY = 'casino-records';
const MAX = 5000;

const EMPTY: CasinoRecord[] = [];

export function loadRecords(): CasinoRecord[] {
  return readJSON<CasinoRecord[]>(KEY, EMPTY);
}

function save(list: CasinoRecord[]): void {
  writeJSON(KEY, list.length > MAX ? list.slice(-MAX) : list);
}

const round2 = (n: number) => Math.round(n * 100) / 100;

export function openRound(game: CasinoId, stake: number, note?: string): string {
  const id = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
  save([...loadRecords(), { id, game, at: Date.now(), stake: round2(stake), payout: 0, open: true, note }]);
  return id;
}

export function raiseRound(id: string, extra: number): void {
  save(loadRecords().map((r) => (r.id === id ? { ...r, stake: round2(r.stake + extra) } : r)));
}

export function settleRound(id: string, payout: number, note?: string): void {
  save(loadRecords().map((r) => (r.id === id ? { ...r, payout: round2(payout), open: false, note: note ?? r.note } : r)));
}

/**
 * A round left open (by leaving mid-round, closing the tab or reloading) is lost: close it with
 * no payout. Called when a casino game mounts and unmounts, and once on app start for all games.
 */
export function closeAbandoned(game?: CasinoId): void {
  const list = loadRecords();
  const stale = (r: CasinoRecord) => r.open && (!game || r.game === game);
  if (list.some(stale)) save(list.map((r) => (stale(r) ? { ...r, open: false } : r)));
}

export function clearCasino(game?: CasinoId): void {
  save(game ? loadRecords().filter((r) => r.game !== game) : []);
}

export function useCasinoRecords(): CasinoRecord[] {
  return useStoredState<CasinoRecord[]>(KEY, EMPTY)[0];
}

export interface CasinoStats {
  rounds: number;
  wagered: number;
  returned: number;
  /** returned − wagered. */
  net: number;
  wins: number;
  losses: number;
  pushes: number;
  winRate: number;
  biggestWin: number;
  biggestLoss: number;
  /** Running net after each round, oldest first. */
  series: number[];
}

/** Totals over finished rounds (a live round only counts once it's settled or abandoned). */
export function casinoStats(records: readonly CasinoRecord[], game?: CasinoId): CasinoStats {
  const list = records.filter((r) => !r.open && (!game || r.game === game));
  let wagered = 0;
  let returned = 0;
  let wins = 0;
  let losses = 0;
  let pushes = 0;
  let biggestWin = 0;
  let biggestLoss = 0;
  let run = 0;
  const series: number[] = [];
  for (const r of list) {
    const profit = r.payout - r.stake;
    wagered += r.stake;
    returned += r.payout;
    if (profit > 0) wins++;
    else if (profit < 0) losses++;
    else pushes++;
    biggestWin = Math.max(biggestWin, profit);
    biggestLoss = Math.min(biggestLoss, profit);
    run += profit;
    series.push(round2(run));
  }
  const decided = wins + losses;
  return {
    rounds: list.length,
    wagered: round2(wagered),
    returned: round2(returned),
    net: round2(returned - wagered),
    wins,
    losses,
    pushes,
    winRate: decided ? wins / decided : 0,
    biggestWin: round2(biggestWin),
    biggestLoss: round2(biggestLoss),
    series,
  };
}

// ---------- Money ----------

/** "$1,250" / "$12.50"; `sign` adds "+" to gains and a real minus to losses. */
export function formatMoney(n: number, lang: Lang, sign = false): string {
  const abs = Math.abs(n);
  const cents = Math.round(abs * 100) % 100 !== 0;
  const body = abs.toLocaleString(LOCALE[lang], { minimumFractionDigits: cents ? 2 : 0, maximumFractionDigits: 2 });
  if (!sign) return `${n < 0 ? '−' : ''}$${body}`;
  return `${n > 0 ? '+' : n < 0 ? '−' : ''}$${body}`;
}

/** "×1.24" / "×21.21" / "×1,024": two decimals (what's actually paid) until it gets huge. */
export function formatMult(m: number, lang: Lang): string {
  const digits = m < 1000 ? 2 : 0;
  return `×${m.toLocaleString(LOCALE[lang], { minimumFractionDigits: digits, maximumFractionDigits: digits })}`;
}

export const DEFAULT_BET = 100;
export const MIN_BET = 1;
export const MAX_BET = 1_000_000;

export function clampBet(v: number): number {
  if (!Number.isFinite(v)) return DEFAULT_BET;
  return Math.min(MAX_BET, Math.max(MIN_BET, round2(v)));
}
