import { beforeEach, describe, expect, it } from 'vitest';
import { casinoStats, clampBet, closeAbandoned, formatMoney, formatMult, loadRecords, openRound, raiseRound, settleRound, clearCasino, type CasinoRecord } from './wallet';

const rec = (stake: number, payout: number): CasinoRecord => ({ id: String(Math.random()), game: 'gems', at: 0, stake, payout });

describe('casino stats', () => {
  it('adds up net, wins, losses and pushes', () => {
    const s = casinoStats([rec(100, 250), rec(100, 0), rec(50, 50), rec(200, 400)]);
    expect(s.rounds).toBe(4);
    expect(s.wagered).toBe(450);
    expect(s.returned).toBe(700);
    expect(s.net).toBe(250);
    expect([s.wins, s.losses, s.pushes]).toEqual([2, 1, 1]);
    expect(s.winRate).toBeCloseTo(2 / 3);
    expect(s.biggestWin).toBe(200);
    expect(s.biggestLoss).toBe(-100);
    expect(s.series).toEqual([150, 50, 50, 250]);
  });

  it('filters by game', () => {
    const list = [rec(100, 0), { ...rec(100, 200), game: 'blackjack' as const }];
    expect(casinoStats(list, 'blackjack').net).toBe(100);
    expect(casinoStats(list, 'gems').net).toBe(-100);
  });
});

describe('rounds in storage', () => {
  beforeEach(() => clearCasino());

  it('leaves a live round out of the totals until it is settled', () => {
    const id = openRound('blackjack', 100);
    expect(casinoStats(loadRecords()).rounds).toBe(0);
    raiseRound(id, 100); // double
    settleRound(id, 400, 'Win');
    const [r] = loadRecords();
    expect(r).toMatchObject({ stake: 200, payout: 400, open: false, note: 'Win' });
  });

  it('closes abandoned rounds as losses', () => {
    openRound('road', 50);
    closeAbandoned('road');
    expect(loadRecords()[0]).toMatchObject({ open: false, payout: 0 });
    expect(casinoStats(loadRecords()).net).toBe(-50);
    openRound('gems', 20);
    closeAbandoned(); // app start: every game
    expect(loadRecords().every((r) => !r.open)).toBe(true);
  });
});

describe('money formatting', () => {
  it('formats amounts and signs', () => {
    expect(formatMoney(1250, 'en')).toBe('$1,250');
    expect(formatMoney(12.5, 'en')).toBe('$12.50');
    expect(formatMoney(150, 'en', true)).toBe('+$150');
    expect(formatMoney(-100, 'en', true)).toBe('−$100');
    expect(formatMoney(0, 'en', true)).toBe('$0');
    expect(formatMult(1.2345, 'en')).toBe('×1.23');
    expect(formatMult(24.75, 'en')).toBe('×24.75');
    expect(formatMult(27077.6, 'en')).toBe('×27,078');
  });

  it('clamps bets', () => {
    expect(clampBet(0)).toBe(1);
    expect(clampBet(12.345)).toBe(12.35);
    expect(clampBet(5e9)).toBe(1_000_000);
    expect(clampBet(NaN)).toBe(100);
  });
});
