import { useEffect, useRef, useState, type CSSProperties } from 'react';
import type { CasinoGameProps, Round } from '../../types';
import { BetInput, RoundResult } from '../../components';
import { formatMoney } from '../../wallet';
import {
  canDouble,
  canHit,
  canSplit,
  deal,
  dealerStep,
  double,
  freshShoe,
  handValue,
  isBlackjack,
  isRed,
  needsReshuffle,
  settle,
  split,
  stand,
  hit,
  SUIT_SYMBOL,
  totalLabel,
  type Card,
  type GameState,
  type Hand,
  type HandResult,
  type Settlement,
  type Shoe,
} from './logic';
import { STR, type Strings } from './i18n';
import styles from './Game.module.css';

/** Gap between the four opening cards. */
const DEAL_STEP_MS = 170;
/** How long a card takes to slide in. */
const CARD_MS = 260;
/** How long the hole card takes to turn over. */
const FLIP_MS = 380;
/** Pause between dealer draws, after the previous card lands. */
const DEALER_PAUSE_MS = 260;
const SHUFFLE_NOTE_MS = 1600;

const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(' ');
const cardCount = (s: GameState) => s.dealer.length + s.hands.reduce((a, h) => a + h.cards.length, 0);
const lcFirst = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);

function handNote(t: Strings, r: HandResult, st: Settlement): string {
  switch (r.outcome) {
    case 'blackjack':
      return t.blackjack;
    case 'bust':
      return t.noteBust;
    case 'push':
      return st.dealerBlackjack ? t.noteBothBJ : t.notePush(r.total);
    case 'win':
      return st.dealerBust ? t.noteWinBust(r.total) : t.noteWin(r.total, st.dealerTotal);
    case 'lose':
      return st.dealerBlackjack ? t.noteDealerBJ : t.noteLose(r.total, st.dealerTotal);
  }
}

/** Short line for the history list: "Blackjack", "Win 20 vs 18", "Double: bust", "Split: win, lose". */
function roundNote(t: Strings, st: Settlement): string {
  if (st.hands.length > 1) return t.noteSplit(st.hands.map((h) => t.splitWord[h.outcome]).join(', '));
  const h = st.hands[0];
  const n = handNote(t, h, st);
  return h.doubled ? t.noteDouble(lcFirst(n)) : n;
}

/** The line under the result banner. */
function roundDetail(t: Strings, st: Settlement): string {
  const single = st.hands.length === 1 ? st.hands[0] : null;
  if (single?.outcome === 'blackjack') return t.bjPays;
  if (st.dealerBlackjack) return single?.outcome === 'push' ? t.bothBJ : t.dealerBJ;
  if (st.hands.every((h) => h.outcome === 'bust')) return single ? t.youBust(single.total) : t.bust;
  if (st.dealerBust) return t.dealerBusts(st.dealerTotal);
  return t.dealerHas(st.dealerTotal);
}

function PlayingCard({ card, faceDown, delay, moved, t }: { card: Card; faceDown?: boolean; delay?: number; moved?: boolean; t: Strings }) {
  const court = card.rank === 'J' || card.rank === 'Q' || card.rank === 'K';
  const sym = SUIT_SYMBOL[card.suit];
  return (
    <div
      className={cx(styles.card, faceDown && styles.down, moved && styles.moved)}
      style={{ '--d': `${delay ?? 0}ms` } as CSSProperties}
      role="img"
      aria-label={faceDown ? t.faceDown : t.cardName(card.rank, card.suit)}
    >
      <div className={styles.flip}>
        <div className={cx(styles.front, isRed(card) && styles.red)}>
          {!faceDown && (
            <>
              <span className={styles.corner} aria-hidden>
                <b>{card.rank}</b>
                <i>{sym}</i>
              </span>
              {court ? (
                <span className={styles.court} aria-hidden>
                  <b>{card.rank}</b>
                  <i>{sym}</i>
                </span>
              ) : (
                <span className={cx(styles.pip, card.rank === 'A' && styles.ace)} aria-hidden>
                  {sym}
                </span>
              )}
              <span className={cx(styles.corner, styles.cornerEnd)} aria-hidden>
                <b>{card.rank}</b>
                <i>{sym}</i>
              </span>
            </>
          )}
        </div>
        <div className={styles.back} aria-hidden />
      </div>
    </div>
  );
}

function Cards({ cards, hideHole, delays, moved, t }: { cards: Card[]; hideHole?: boolean; delays: Map<number, number>; moved: Set<number>; t: Strings }) {
  return (
    <div className={styles.cards} style={{ '--n': Math.max(cards.length, 2) } as CSSProperties}>
      {cards.map((c, i) => (
        <PlayingCard key={c.id} card={c} faceDown={hideHole && i === 1} delay={delays.get(c.id)} moved={moved.has(c.id)} t={t} />
      ))}
    </div>
  );
}

function Placeholder() {
  return (
    <div className={styles.cards} aria-hidden>
      <div className={styles.slot} />
      <div className={styles.slot} />
    </div>
  );
}

/** Hand total badge; `pending` keeps its space but hides it while the opening cards are still landing. */
function Total({ cards, natural, pending, t }: { cards: Card[]; natural: boolean; pending?: boolean; t: Strings }) {
  const v = handValue(cards);
  const base = cx(styles.total, pending && styles.pending);
  if (natural) return <span className={cx(base, styles.totalBJ)}>{t.blackjack}</span>;
  if (v.total > 21)
    return (
      <span className={cx(base, styles.totalBust)}>
        {v.total}
        <span className={styles.bustWord}>{` · ${t.bust}`}</span>
      </span>
    );
  return <span className={cx(base, v.total === 21 && styles.total21)}>{totalLabel(cards)}</span>;
}

export default function Game({ lang, bet, setBet, begin, onBusy }: CasinoGameProps) {
  const t = STR[lang];
  const shoeRef = useRef<Shoe | null>(null);
  const [game, setGame] = useState<GameState | null>(null);
  const gameRef = useRef<GameState | null>(null);
  const [result, setResult] = useState<Settlement | null>(null);
  const [lock, setLockState] = useState(false);
  const lockRef = useRef(false);
  const [shuffling, setShuffling] = useState(false);
  const [dealing, setDealing] = useState(false);
  const roundRef = useRef<Round | null>(null);
  const delays = useRef(new Map<number, number>());
  const moved = useRef(new Set<number>());
  const timers = useRef<number[]>([]);
  const pendingFinish = useRef<(() => void) | null>(null);
  const langRef = useRef(lang);
  langRef.current = lang;

  const setLock = (v: boolean) => {
    lockRef.current = v;
    setLockState(v);
  };
  const later = (fn: () => void, ms: number) => {
    timers.current.push(window.setTimeout(fn, ms));
  };

  // Leaving mid-animation still records a round that has already been decided.
  useEffect(
    () => () => {
      timers.current.forEach(clearTimeout);
      timers.current = [];
      pendingFinish.current?.();
    },
    [],
  );

  const live = !!game && !result;

  function commit(next: GameState, wait: number) {
    gameRef.current = next;
    setGame(next);
    if (next.phase === 'player') {
      if (wait > 0) {
        setLock(true);
        later(() => setLock(false), wait);
      } else setLock(false);
      return;
    }
    setLock(true);
    if (next.phase === 'dealer') {
      later(() => {
        const cur = gameRef.current;
        if (cur && shoeRef.current) commit(dealerStep(cur, shoeRef.current), CARD_MS);
      }, wait + DEALER_PAUSE_MS);
      return;
    }
    const finish = () => {
      pendingFinish.current = null;
      const st = settle(next);
      roundRef.current?.settle(st.payout, roundNote(STR[langRef.current], st));
      roundRef.current = null;
      onBusy(false);
      setResult(st);
      setLock(false);
    };
    pendingFinish.current = finish;
    later(finish, wait + 120);
  }

  function startHand() {
    if (live || lockRef.current) return;
    let shoe = shoeRef.current;
    if (!shoe || needsReshuffle(shoe)) {
      const reshuffle = !!shoe;
      shoe = freshShoe();
      shoeRef.current = shoe;
      if (reshuffle) {
        setShuffling(true);
        later(() => setShuffling(false), SHUFFLE_NOTE_MS);
      }
    }
    const s = deal(shoe, bet);
    roundRef.current = begin(bet);
    onBusy(true);
    delays.current = new Map([
      [s.hands[0].cards[0].id, 0],
      [s.dealer[0].id, DEAL_STEP_MS],
      [s.hands[0].cards[1].id, DEAL_STEP_MS * 2],
      [s.dealer[1].id, DEAL_STEP_MS * 3],
    ]);
    moved.current = new Set();
    setResult(null);
    setDealing(true);
    later(() => setDealing(false), DEAL_STEP_MS * 3 + CARD_MS);
    commit(s, DEAL_STEP_MS * 3 + CARD_MS + (s.holeRevealed ? FLIP_MS : 0));
  }

  function act(kind: 'hit' | 'stand' | 'double' | 'split') {
    const cur = gameRef.current;
    const shoe = shoeRef.current;
    if (!cur || !shoe || cur.phase !== 'player' || lockRef.current) return;
    const h = cur.hands[cur.active];
    let next = cur;
    let extra = 0;
    if (kind === 'hit' && canHit(cur)) next = hit(cur, shoe);
    else if (kind === 'stand') next = stand(cur);
    else if (kind === 'double' && canDouble(cur)) {
      next = double(cur, shoe);
      extra = h.bet;
    } else if (kind === 'split' && canSplit(cur)) {
      next = split(cur, shoe);
      extra = h.bet;
      // The second card slides over to its own hand; the two new cards come off the shoe one after the other.
      moved.current.add(h.cards[1].id);
      delays.current.set(next.hands[0].cards[1].id, 0);
      delays.current.set(next.hands[1].cards[1].id, DEAL_STEP_MS);
    }
    if (next === cur) return;
    if (extra) roundRef.current?.raise(extra);
    const drawn = cardCount(next) - cardCount(cur);
    const drawMs = drawn > 0 ? CARD_MS + DEAL_STEP_MS * (drawn - 1) : 0;
    commit(next, drawMs + (next.holeRevealed && !cur.holeRevealed ? FLIP_MS : 0));
  }

  // Keyboard: H hit, S stand, D double, P split, Enter / Space deal.
  const keys = useRef({ act, startHand, live });
  keys.current = { act, startHand, live };
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey) return;
      const el = e.target as HTMLElement | null;
      if (el?.closest('input, textarea, select, [contenteditable="true"]')) return;
      if (document.querySelector('[aria-modal="true"]')) return;
      const k = keys.current;
      if (k.live) {
        const map: Record<string, 'hit' | 'stand' | 'double' | 'split'> = { h: 'hit', s: 'stand', d: 'double', p: 'split' };
        const a = map[e.key.toLowerCase()];
        if (a) {
          e.preventDefault();
          k.act(a);
        }
      } else if ((e.key === 'Enter' || e.key === ' ') && !el?.closest('button, a')) {
        e.preventDefault();
        k.startHand();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const playing = live && game?.phase === 'player' && !lock;
  const split2 = !!game && game.hands.length > 1;
  const dealerCards = game?.dealer ?? [];
  const hideHole = !!game && !game.holeRevealed;

  return (
    <div className={styles.wrap}>
      <div className={styles.table}>
        <div className={styles.shoe} aria-hidden>
          <span />
          <span />
        </div>
        {shuffling && (
          <div className={styles.shuffling} role="status">
            {t.shuffling}
          </div>
        )}

        <section className={styles.dealer} aria-label={t.dealer}>
          <div className={styles.who}>
            <span>{t.dealer}</span>
            {game && <Total key={dealing ? 'wait' : 'show'} pending={dealing} cards={hideHole ? dealerCards.slice(0, 1) : dealerCards} natural={!hideHole && dealerCards.length === 2 && handValue(dealerCards).total === 21} t={t} />}
          </div>
          {game ? <Cards cards={dealerCards} hideHole={hideHole} delays={delays.current} moved={moved.current} t={t} /> : <Placeholder />}
        </section>

        <div className={styles.band}>
          {result ? (
            <RoundResult stake={result.stake} payout={result.payout} lang={lang} detail={roundDetail(t, result)} />
          ) : (
            <div className={styles.rules}>
              <strong>{t.paysRule}</strong>
              <span>{t.dealerRule}</span>
            </div>
          )}
        </div>

        <section className={cx(styles.player, split2 && styles.isSplit)} aria-label={t.you}>
          {game ? (
            game.hands.map((h: Hand, i) => {
              const active = split2 && live && game.phase === 'player' && game.active === i;
              const r = result?.hands[i];
              return (
                <div key={i} className={cx(styles.hand, active && styles.active, r && styles.settled, split2 && live && game.phase === 'player' && !active && styles.waiting)}>
                  <Cards cards={h.cards} delays={delays.current} moved={moved.current} t={t} />
                  <div className={styles.handFoot}>
                    <Total key={dealing ? 'wait' : 'show'} pending={dealing} cards={h.cards} natural={isBlackjack(h)} t={t} />
                    <span className={styles.chip} title={t.betOnHand(formatMoney(h.bet * (h.doubled ? 2 : 1), lang))}>
                      <i aria-hidden />
                      <span>{formatMoney(h.bet * (h.doubled ? 2 : 1), lang)}</span>
                    </span>
                    {split2 && r && <span className={cx(styles.tag, styles[`tag_${r.outcome}`])}>{t.tag[r.outcome]}</span>}
                  </div>
                </div>
              );
            })
          ) : (
            <div className={styles.hand}>
              <Placeholder />
              <div className={styles.handFoot}>
                <span className={styles.hint}>{t.placeBet}</span>
              </div>
            </div>
          )}
        </section>
      </div>

      <div className={styles.controls}>
        <BetInput value={bet} onChange={setBet} disabled={live || lock} lang={lang} />
        {live ? (
          <div className={styles.actions}>
            <button type="button" className="btn btn-primary" disabled={!playing || !game || !canHit(game)} onClick={() => act('hit')}>
              {t.hit}
            </button>
            <button type="button" className="btn btn-primary" disabled={!playing} onClick={() => act('stand')}>
              {t.stand}
            </button>
            <button type="button" className="btn btn-secondary" disabled={!playing || !game || !canDouble(game)} onClick={() => act('double')}>
              {t.double}
            </button>
            <button type="button" className="btn btn-secondary" disabled={!playing || !game || !canSplit(game)} onClick={() => act('split')}>
              {t.split}
            </button>
          </div>
        ) : (
          <button type="button" className={cx('btn btn-primary btn-block', styles.deal)} disabled={lock} onClick={startHand}>
            {t.deal}
          </button>
        )}
        <p className={styles.keys}>{t.keys}</p>
      </div>
    </div>
  );
}
