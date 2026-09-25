import { describe, expect, it } from 'vitest';
import {
  canDouble,
  canHit,
  canSplit,
  cardsLeft,
  deal,
  dealerShouldHit,
  double,
  draw,
  freshShoe,
  handValue,
  hit,
  isBlackjack,
  needsReshuffle,
  parseCard,
  playDealer,
  settle,
  split,
  stackedShoe,
  stand,
  totalLabel,
  type Hand,
} from './logic';

const cards = (s: string) => s.split(' ').map((c, i) => parseCard(c, i));
/** Deal order is player, dealer up, player, dealer hole, then every later draw. */
const shoe = (s: string) => stackedShoe(cards(s));
const hand = (s: string, split = false): Hand => ({ cards: cards(s), bet: 10, doubled: false, split, done: false });

/** A tiny seeded generator so shuffles are repeatable. */
function lcg(seed: number) {
  let x = seed >>> 0;
  return () => {
    x = (Math.imul(x, 1664525) + 1013904223) >>> 0;
    return x / 4294967296;
  };
}

describe('hand values', () => {
  it('counts faces as 10 and adds up plain cards', () => {
    expect(handValue(cards('Kh 7s'))).toEqual({ total: 17, soft: false });
    expect(handValue(cards('2c 3d 4h 5s'))).toEqual({ total: 14, soft: false });
    expect(handValue(cards('Js Qd'))).toEqual({ total: 20, soft: false });
  });

  it('counts an ace as 11 when that does not bust, otherwise 1', () => {
    expect(handValue(cards('As 6h'))).toEqual({ total: 17, soft: true });
    expect(handValue(cards('As 6h 9c'))).toEqual({ total: 16, soft: false });
    expect(handValue(cards('As Ad'))).toEqual({ total: 12, soft: true });
    expect(handValue(cards('As Ad Ah Ac'))).toEqual({ total: 14, soft: true });
    expect(handValue(cards('As Ad 9h'))).toEqual({ total: 21, soft: true });
    expect(handValue(cards('As Kd'))).toEqual({ total: 21, soft: true });
    expect(handValue(cards('Ks Qd 5h'))).toEqual({ total: 25, soft: false });
  });

  it('labels soft totals both ways', () => {
    expect(totalLabel(cards('As 6h'))).toBe('7 / 17');
    expect(totalLabel(cards('As Kh'))).toBe('21');
    expect(totalLabel(cards('As 6h 9c'))).toBe('16');
    expect(totalLabel(cards('9s 8h'))).toBe('17');
  });
});

describe('blackjack detection', () => {
  it('is an ace and a 10-value card as the first two cards', () => {
    expect(isBlackjack(hand('As Kd'))).toBe(true);
    expect(isBlackjack(hand('10c Ah'))).toBe(true);
    expect(isBlackjack(hand('7s 7d 7h'))).toBe(false);
    expect(isBlackjack(hand('As 9d'))).toBe(false);
  });

  it('is never a blackjack on a split hand', () => {
    expect(isBlackjack(hand('As Kd', true))).toBe(false);
  });

  it('pays a player blackjack 3:2 at once', () => {
    const s = deal(shoe('As 9h Kd 8c'), 10);
    expect(s.phase).toBe('done');
    expect(s.holeRevealed).toBe(true);
    const r = settle(s);
    expect(r.hands[0].outcome).toBe('blackjack');
    expect(r.payout).toBe(25);
  });

  it('dealer peeks with an ace or 10 up and ends the hand on a blackjack', () => {
    const up10 = deal(shoe('9s Kh 8d Ac'), 10);
    expect(up10.phase).toBe('done');
    expect(settle(up10)).toMatchObject({ dealerBlackjack: true, payout: 0 });
    const upAce = deal(shoe('9s Ah 8d Qc'), 10);
    expect(upAce.phase).toBe('done');
    expect(settle(upAce).payout).toBe(0);
  });

  it('keeps playing when the dealer peeks and has no blackjack', () => {
    const s = deal(shoe('9s Ah 8d 6c'), 10);
    expect(s.phase).toBe('player');
    expect(s.holeRevealed).toBe(false);
  });

  it('player blackjack against dealer blackjack is a push', () => {
    const r = settle(deal(shoe('As Ah Kd Qc'), 10));
    expect(r.hands[0].outcome).toBe('push');
    expect(r.payout).toBe(10);
  });

  it('3:2 keeps cents', () => {
    expect(settle(deal(shoe('As 9h Kd 8c'), 1.01)).payout).toBe(2.53);
  });
});

describe('dealer play (S17)', () => {
  it('hits 16 and below, stands on every 17 including soft 17', () => {
    expect(dealerShouldHit(cards('10s 6h'))).toBe(true);
    expect(dealerShouldHit(cards('As 5h'))).toBe(true);
    expect(dealerShouldHit(cards('As 6h'))).toBe(false);
    expect(dealerShouldHit(cards('10s 7h'))).toBe(false);
    expect(dealerShouldHit(cards('As 6h 9c'))).toBe(true); // hard 16
  });

  it('draws to 17 or more after the player stands', () => {
    // Player 9+10 = 19; dealer 6 up, 10 hole = 16, draws 5 → 21.
    let s = deal(shoe('9s 6h 10d 10c 5h 2c'), 10);
    s = stand(s);
    expect(s.phase).toBe('dealer');
    s = playDealer(s, shoe('5h'));
    expect(s.phase).toBe('done');
    expect(s.dealer.map((c) => c.rank)).toEqual(['6', '10', '5']);
    expect(settle(s)).toMatchObject({ dealerTotal: 21, payout: 0 });
  });

  it('stands on soft 17 without drawing', () => {
    const sh = shoe('10s 6h 9d As 5c');
    const s = stand(deal(sh, 10));
    expect(s.phase).toBe('done');
    expect(s.dealer).toHaveLength(2);
    expect(cardsLeft(sh)).toBe(1);
  });

  it('does not play when every player hand is bust', () => {
    const sh = shoe('10s 6h 6d 10c Kh 5c');
    let s = deal(sh, 10);
    s = hit(s, sh);
    expect(s.phase).toBe('done');
    expect(s.dealer).toHaveLength(2);
    expect(settle(s).hands[0].outcome).toBe('bust');
    expect(settle(s).payout).toBe(0);
  });
});

describe('payouts', () => {
  const play = (deck: string, act: (s: ReturnType<typeof deal>, sh: ReturnType<typeof shoe>) => ReturnType<typeof deal>) => {
    const sh = shoe(deck);
    let s = act(deal(sh, 10), sh);
    s = playDealer(s, sh);
    return settle(s);
  };

  it('win pays even money', () => {
    expect(play('10s 10h Qd 8c', (s) => stand(s))).toMatchObject({ stake: 10, payout: 20 });
  });
  it('dealer bust pays even money', () => {
    expect(play('10s 10h 2d 6c Kh', (s) => stand(s))).toMatchObject({ dealerBust: true, payout: 20 });
  });
  it('lose pays nothing', () => {
    expect(play('10s 10h 7d Qc', (s) => stand(s))).toMatchObject({ payout: 0 });
  });
  it('push returns the stake', () => {
    expect(play('10s 10h 9d 9c', (s) => stand(s))).toMatchObject({ payout: 10, hands: [{ outcome: 'push' }] });
  });
  it('a hit that makes 21 stands by itself', () => {
    const sh = shoe('10s 10h 5d 8c 6h');
    const s = hit(deal(sh, 10), sh);
    expect(s.hands[0].done).toBe(true);
    expect(settle(playDealer(s, sh)).payout).toBe(20);
  });
  it('double doubles the stake for exactly one card', () => {
    const sh = shoe('6s 10h 5d 7c 2h 9c');
    let s = deal(sh, 10);
    expect(canDouble(s)).toBe(true);
    s = double(s, sh);
    expect(s.hands[0].cards).toHaveLength(3);
    expect(s.hands[0].doubled).toBe(true);
    expect(s.phase).not.toBe('player');
    const r = settle(playDealer(s, sh));
    expect(r).toMatchObject({ stake: 20, payout: 0 }); // 13 vs 17
  });
  it('double win pays twice the doubled stake', () => {
    expect(play('6s 10h 5d 7c 10d', (s, sh) => double(s, sh))).toMatchObject({ stake: 20, payout: 40 });
  });
  it('no double after a third card', () => {
    const sh = shoe('2s 10h 3d 7c 2h');
    const s = hit(deal(sh, 10), sh);
    expect(canHit(s)).toBe(true);
    expect(canDouble(s)).toBe(false);
  });
});

describe('split', () => {
  it('allows a pair or any two 10-value cards, once', () => {
    expect(canSplit(deal(shoe('8s 9h 8d 7c'), 10))).toBe(true);
    expect(canSplit(deal(shoe('Ks 9h Qd 7c'), 10))).toBe(true);
    expect(canSplit(deal(shoe('8s 9h 7d 7c'), 10))).toBe(false);
    const sh = shoe('8s 9h 8d 7c 8h 3c 2d');
    const s = split(deal(sh, 10), sh);
    expect(s.hands).toHaveLength(2);
    expect(canSplit(s)).toBe(false); // the new 8-8 pair can't be split again
  });

  it('plays two hands with the original bet each', () => {
    // Player 8,8 vs dealer 9 up / 7 hole (16). Hands get 10 (18) and 3 (11); hand 2 hits a 9 (20). Dealer draws 2 → 18.
    const sh = shoe('8s 9h 8d 7c 10h 3c 9d 2s');
    let s = deal(sh, 10);
    s = split(s, sh);
    expect(s.hands.map((h) => h.cards.length)).toEqual([2, 2]);
    expect(s.hands.every((h) => h.bet === 10 && h.split)).toBe(true);
    expect(s.active).toBe(0);
    s = stand(s);
    expect(s.active).toBe(1);
    expect(s.phase).toBe('player');
    s = hit(s, sh);
    s = stand(s);
    expect(s.phase).toBe('dealer');
    const r = settle(playDealer(s, sh));
    expect(r.hands.map((h) => h.outcome)).toEqual(['push', 'win']);
    expect(r).toMatchObject({ stake: 20, payout: 30, dealerTotal: 18 });
  });

  it('allows a double on a split hand', () => {
    const sh = shoe('8s 9h 8d 7c 3h 10c 10d 2s');
    let s = split(deal(sh, 10), sh);
    expect(canDouble(s)).toBe(true);
    s = double(s, sh); // 8+3+10 = 21
    s = stand(s); // 8+10 = 18
    const r = settle(playDealer(s, sh)); // dealer 16 + 2 = 18
    expect(r.hands.map((h) => [h.outcome, h.stake, h.payout])).toEqual([
      ['win', 20, 40],
      ['push', 10, 10],
    ]);
  });

  it('split aces get one card each and a 21 pays 1:1, not 3:2', () => {
    const sh = shoe('As 9h Ad 7c Kh 5c 10d');
    let s = split(deal(sh, 10), sh);
    expect(s.hands.every((h) => h.done && h.cards.length === 2)).toBe(true);
    expect(s.phase).toBe('dealer');
    expect(canHit(s)).toBe(false);
    s = playDealer(s, sh); // 16 + 10 = 26, dealer busts
    const r = settle(s);
    expect(r.hands.map((h) => [h.outcome, h.total, h.payout])).toEqual([
      ['win', 21, 20],
      ['win', 16, 20],
    ]);
  });

  it('a split 10 that draws an ace is a 21 that stands by itself and pays 1:1', () => {
    const sh2 = shoe('Ks 7h Qd 10c Ah 9c 4s');
    let t = split(deal(sh2, 10), sh2); // K+A = 21 (auto-stands), Q+9 = 19
    expect(t.hands[0].done).toBe(true);
    expect(t.active).toBe(1);
    t = stand(t);
    const r = settle(playDealer(t, sh2)); // dealer 17
    expect(r.hands.map((h) => h.outcome)).toEqual(['win', 'win']);
    expect(r.payout).toBe(40);
  });
});

describe('shoe', () => {
  it('holds six full decks', () => {
    const s = freshShoe(lcg(1));
    expect(s.cards).toHaveLength(312);
    const counts = new Map<string, number>();
    for (const c of s.cards) counts.set(c.rank + c.suit, (counts.get(c.rank + c.suit) ?? 0) + 1);
    expect(counts.size).toBe(52);
    expect([...counts.values()].every((n) => n === 6)).toBe(true);
    expect(new Set(s.cards.map((c) => c.id)).size).toBe(312);
  });

  it('is shuffled by the injected generator, repeatably', () => {
    const a = freshShoe(lcg(7)).cards.map((c) => c.id);
    expect(freshShoe(lcg(7)).cards.map((c) => c.id)).toEqual(a);
    expect(freshShoe(lcg(8)).cards.map((c) => c.id)).not.toEqual(a);
  });

  it('asks for a reshuffle once fewer than 25% of the cards are left', () => {
    const s = freshShoe(lcg(3));
    while (cardsLeft(s) > 78) draw(s);
    expect(cardsLeft(s)).toBe(78);
    expect(needsReshuffle(s)).toBe(false);
    draw(s);
    expect(needsReshuffle(s)).toBe(true);
  });

  it('throws instead of dealing from an empty shoe', () => {
    const s = shoe('As');
    draw(s);
    expect(() => draw(s)).toThrow();
  });
});
