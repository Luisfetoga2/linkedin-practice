import { secureRandom, shuffled, type RandomFn } from '../../random';

// ---------- Cards and the shoe ----------

export type Suit = 's' | 'h' | 'd' | 'c';
export type Rank = 'A' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10' | 'J' | 'Q' | 'K';

export const SUITS: readonly Suit[] = ['s', 'h', 'd', 'c'];
export const RANKS: readonly Rank[] = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
export const SUIT_SYMBOL: Record<Suit, string> = { s: '♠', h: '♥', d: '♦', c: '♣' };

export interface Card {
  rank: Rank;
  suit: Suit;
  /** Unique within its shoe (used as a React key). */
  id: number;
}

export const isRed = (c: Card) => c.suit === 'h' || c.suit === 'd';

/** Blackjack value of a card, counting an ace as 1 (hand totals add the 10 when it helps). */
export function cardPoints(r: Rank): number {
  if (r === 'A') return 1;
  if (r === 'J' || r === 'Q' || r === 'K') return 10;
  return Number(r);
}

export const DECKS = 6;
/** The shoe is replaced before a deal once fewer than this share of its cards is left. */
export const RESHUFFLE_FRACTION = 0.25;

export interface Shoe {
  cards: Card[];
  /** Index of the next card to draw. */
  next: number;
}

export function freshShoe(rng: RandomFn = secureRandom, decks = DECKS): Shoe {
  const cards: Card[] = [];
  let id = 0;
  for (let d = 0; d < decks; d++) for (const suit of SUITS) for (const rank of RANKS) cards.push({ rank, suit, id: id++ });
  return { cards: shuffled(cards, rng), next: 0 };
}

/** A shoe that deals exactly these cards in order (for tests). */
export function stackedShoe(cards: Card[]): Shoe {
  return { cards: cards.map((c, i) => ({ ...c, id: i })), next: 0 };
}

export const cardsLeft = (shoe: Shoe) => shoe.cards.length - shoe.next;

export function needsReshuffle(shoe: Shoe, fraction = RESHUFFLE_FRACTION): boolean {
  return cardsLeft(shoe) < shoe.cards.length * fraction;
}

/** Takes the next card off the shoe (mutates the shoe's position). */
export function draw(shoe: Shoe): Card {
  if (shoe.next >= shoe.cards.length) throw new Error('The shoe is empty');
  return shoe.cards[shoe.next++];
}

/** "As", "10h", "Kd" → a card (for tests and debugging). */
export function parseCard(s: string, id = 0): Card {
  const suit = s.slice(-1) as Suit;
  const rank = s.slice(0, -1).toUpperCase() as Rank;
  if (!SUITS.includes(suit) || !RANKS.includes(rank)) throw new Error(`Bad card ${s}`);
  return { rank, suit, id };
}

// ---------- Hand values ----------

export interface HandValue {
  total: number;
  /** An ace is being counted as 11. */
  soft: boolean;
}

export function handValue(cards: readonly Card[]): HandValue {
  let total = 0;
  let aces = 0;
  for (const c of cards) {
    total += cardPoints(c.rank);
    if (c.rank === 'A') aces++;
  }
  if (aces && total + 10 <= 21) return { total: total + 10, soft: true };
  return { total, soft: false };
}

/** Two cards making 21 (an ace and a 10-value card). Whether it counts as a blackjack also depends on splits. */
export function isTwoCard21(cards: readonly Card[]): boolean {
  return cards.length === 2 && handValue(cards).total === 21;
}

/** "7 / 17" for a soft total under 21, otherwise just the total. */
export function totalLabel(cards: readonly Card[]): string {
  const v = handValue(cards);
  return v.soft && v.total < 21 ? `${v.total - 10} / ${v.total}` : String(v.total);
}

/** S17: the dealer draws to 16 and stands on every 17, soft or hard. */
export function dealerShouldHit(cards: readonly Card[]): boolean {
  return handValue(cards).total < 17;
}

/** The dealer peeks at the hole card when the upcard is an ace or worth 10. */
export function dealerPeeks(upcard: Card): boolean {
  return upcard.rank === 'A' || cardPoints(upcard.rank) === 10;
}

// ---------- A round ----------

export interface Hand {
  cards: Card[];
  /** The bet on this hand before any double. */
  bet: number;
  doubled: boolean;
  /** Came from a split: 21 in two cards is not a blackjack. */
  split: boolean;
  /** Finished: stood, doubled, busted, reached 21, or a split ace. */
  done: boolean;
}

export type Phase = 'player' | 'dealer' | 'done';

export interface GameState {
  phase: Phase;
  /** dealer[0] is the upcard, dealer[1] the hole card. */
  dealer: Card[];
  holeRevealed: boolean;
  hands: Hand[];
  /** Hand being played (meaningful while phase is 'player'). */
  active: number;
}

export const handStake = (h: Hand) => (h.doubled ? h.bet * 2 : h.bet);
export const totalStake = (s: GameState) => s.hands.reduce((a, h) => a + handStake(h), 0);

/** A natural: two-card 21 on an unsplit hand. */
export function isBlackjack(h: Hand): boolean {
  return !h.split && isTwoCard21(h.cards);
}

export const dealerBlackjack = (s: GameState) => isTwoCard21(s.dealer);

/** Deals player, dealer up, player, dealer hole. Ends at once on a dealer (peeked) or player blackjack. */
export function deal(shoe: Shoe, bet: number): GameState {
  const p1 = draw(shoe);
  const up = draw(shoe);
  const p2 = draw(shoe);
  const hole = draw(shoe);
  const hand: Hand = { cards: [p1, p2], bet, doubled: false, split: false, done: false };
  const s: GameState = { phase: 'player', dealer: [up, hole], holeRevealed: false, hands: [hand], active: 0 };
  const dealerBJ = dealerPeeks(up) && isTwoCard21(s.dealer);
  if (dealerBJ || isBlackjack(hand)) {
    return { ...s, phase: 'done', holeRevealed: true, hands: [{ ...hand, done: true }] };
  }
  return s;
}

export const activeHand = (s: GameState): Hand | undefined => (s.phase === 'player' ? s.hands[s.active] : undefined);

export function canHit(s: GameState): boolean {
  const h = activeHand(s);
  return !!h && !h.done;
}

export function canDouble(s: GameState): boolean {
  const h = activeHand(s);
  return !!h && !h.done && h.cards.length === 2;
}

export function canSplit(s: GameState): boolean {
  const h = activeHand(s);
  if (!h || h.done || s.hands.length !== 1 || h.cards.length !== 2) return false;
  const [a, b] = h.cards;
  return a.rank === b.rank || (cardPoints(a.rank) === 10 && cardPoints(b.rank) === 10);
}

function withHand(s: GameState, i: number, h: Hand): GameState {
  const hands = s.hands.slice();
  hands[i] = h;
  return { ...s, hands };
}

/** A hand finishes by itself on a bust or on 21. */
function autoDone(h: Hand): Hand {
  return !h.done && handValue(h.cards).total >= 21 ? { ...h, done: true } : h;
}

/** Moves to the next unfinished hand, or on to the dealer when every hand is done. */
function advance(s: GameState): GameState {
  const next = s.hands.findIndex((h) => !h.done);
  if (next >= 0) return { ...s, active: next };
  const revealed = { ...s, holeRevealed: true };
  const allBust = s.hands.every((h) => handValue(h.cards).total > 21);
  if (allBust || !dealerShouldHit(s.dealer)) return { ...revealed, phase: 'done' };
  return { ...revealed, phase: 'dealer' };
}

export function hit(s: GameState, shoe: Shoe): GameState {
  if (!canHit(s)) return s;
  const h = s.hands[s.active];
  return advance(withHand(s, s.active, autoDone({ ...h, cards: [...h.cards, draw(shoe)] })));
}

export function stand(s: GameState): GameState {
  const h = activeHand(s);
  if (!h || h.done) return s;
  return advance(withHand(s, s.active, { ...h, done: true }));
}

/** Doubles the hand's bet for exactly one more card. The caller raises the round by `hand.bet`. */
export function double(s: GameState, shoe: Shoe): GameState {
  if (!canDouble(s)) return s;
  const h = s.hands[s.active];
  return advance(withHand(s, s.active, { ...h, cards: [...h.cards, draw(shoe)], doubled: true, done: true }));
}

/**
 * Splits a pair into two hands with the same bet each, and gives each a second card. Split aces get
 * that one card only. The caller raises the round by the bet.
 */
export function split(s: GameState, shoe: Shoe): GameState {
  if (!canSplit(s)) return s;
  const h = s.hands[0];
  const aces = h.cards[0].rank === 'A';
  const mk = (first: Card): Hand => {
    const hand: Hand = { cards: [first, draw(shoe)], bet: h.bet, doubled: false, split: true, done: aces };
    return autoDone(hand);
  };
  const a = mk(h.cards[0]);
  const b = mk(h.cards[1]);
  return advance({ ...s, hands: [a, b], active: 0 });
}

/** One dealer draw; the round is done once the dealer reaches 17 or more. */
export function dealerStep(s: GameState, shoe: Shoe): GameState {
  if (s.phase !== 'dealer') return s;
  const dealer = [...s.dealer, draw(shoe)];
  return { ...s, dealer, phase: dealerShouldHit(dealer) ? 'dealer' : 'done' };
}

/** Plays the dealer's hand out in one go. */
export function playDealer(s: GameState, shoe: Shoe): GameState {
  let cur = s;
  while (cur.phase === 'dealer') cur = dealerStep(cur, shoe);
  return cur;
}

// ---------- Settling ----------

export type HandOutcome = 'blackjack' | 'win' | 'push' | 'lose' | 'bust';

export interface HandResult {
  outcome: HandOutcome;
  total: number;
  stake: number;
  payout: number;
  doubled: boolean;
}

export interface Settlement {
  hands: HandResult[];
  stake: number;
  payout: number;
  dealerTotal: number;
  dealerBust: boolean;
  dealerBlackjack: boolean;
}

const cents = (n: number) => Math.round(n * 100) / 100;

/** Payout multiples of the hand's stake, stake included. */
export const PAYOUT: Record<HandOutcome, number> = { blackjack: 2.5, win: 2, push: 1, lose: 0, bust: 0 };

export function settle(s: GameState): Settlement {
  const dealerTotal = handValue(s.dealer).total;
  const dealerBJ = dealerBlackjack(s);
  const dealerBust = dealerTotal > 21;
  const hands = s.hands.map((h): HandResult => {
    const total = handValue(h.cards).total;
    const stake = handStake(h);
    let outcome: HandOutcome;
    if (isBlackjack(h)) outcome = dealerBJ ? 'push' : 'blackjack';
    else if (dealerBJ) outcome = 'lose';
    else if (total > 21) outcome = 'bust';
    else if (dealerBust || total > dealerTotal) outcome = 'win';
    else if (total === dealerTotal) outcome = 'push';
    else outcome = 'lose';
    return { outcome, total, stake, payout: Math.round(stake * 100 * PAYOUT[outcome]) / 100, doubled: h.doubled };
  });
  return {
    hands,
    stake: cents(hands.reduce((a, h) => a + h.stake, 0)),
    payout: cents(hands.reduce((a, h) => a + h.payout, 0)),
    dealerTotal,
    dealerBust,
    dealerBlackjack: dealerBJ,
  };
}
