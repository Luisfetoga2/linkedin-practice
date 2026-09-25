import { useCallback, useEffect, useRef, useState, type CSSProperties, type MouseEvent } from 'react';
import type { CasinoGameProps, Round } from '../../types';
import { BetInput, RoundResult } from '../../components';
import { formatMoney } from '../../wallet';
import { LOCALE, type Lang } from '../../../lib/i18n';
import { readJSON, writeJSON } from '../../../lib/storage';
import {
  clampMines,
  DEFAULT_MINES,
  MAX_MINES,
  maxGems,
  MIN_MINES,
  multiplier,
  multLabel,
  payoutFor,
  placeMines,
  QUICK_MINES,
  randomTile,
  safeChance,
  SIDE,
  TILES,
} from './logic';
import { STR } from './i18n';
import styles from './Game.module.css';

const MINES_KEY = 'casino-gems-mines';
/** End-of-round reveal ripples out from the last tile: per-step delay and where it starts. */
const RIPPLE_STEP_MS = 45;
const RIPPLE_START_MS = 160;

type Phase = 'idle' | 'live' | 'won' | 'lost';

interface State {
  phase: Phase;
  /** Mine tiles for this round (empty before the first bet). */
  mines: number[];
  /** Tiles the player opened. */
  opened: boolean[];
  gems: number;
  /** The mine that ended the round, or -1. */
  hit: number;
  /** The last tile picked: the end-of-round reveal ripples out from it. */
  last: number;
  stake: number;
  payout: number;
}

const closed = (): boolean[] => Array(TILES).fill(false);
const IDLE: State = { phase: 'idle', mines: [], opened: closed(), gems: 0, hit: -1, last: 12, stake: 0, payout: 0 };

function pct(p: number, lang: Lang): string {
  return p.toLocaleString(LOCALE[lang], { style: 'percent', maximumFractionDigits: 0 });
}

export default function Game({ lang, bet, setBet, begin, onBusy }: CasinoGameProps) {
  const t = STR[lang];
  const [mines, setMinesState] = useState(() => clampMines(readJSON<number>(MINES_KEY, DEFAULT_MINES)));
  const [game, setGame] = useState<State>(IDLE);
  // The end-of-round banner sits over the board; a tap on it moves it out of the way.
  const [showResult, setShowResult] = useState(true);
  // Handlers read the ref so two fast taps never act on a stale render.
  const gameRef = useRef(game);
  const roundRef = useRef<Round | null>(null);

  const commit = useCallback((next: State) => {
    gameRef.current = next;
    setGame(next);
  }, []);

  const live = game.phase === 'live';
  const total = maxGems(mines);

  const setMines = (m: number) => {
    if (gameRef.current.phase === 'live') return;
    const c = clampMines(m);
    setMinesState(c);
    writeJSON(MINES_KEY, c);
    // A finished board belongs to the old mine count: clear it.
    if (gameRef.current.phase !== 'idle') commit(IDLE);
  };

  const start = () => {
    if (gameRef.current.phase === 'live') return;
    roundRef.current = begin(bet, t.noteStart(mines));
    onBusy(true);
    setShowResult(true);
    commit({ phase: 'live', mines: placeMines(mines), opened: closed(), gems: 0, hit: -1, last: 12, stake: bet, payout: 0 });
  };

  const finish = (next: State, note: string) => {
    commit(next);
    roundRef.current?.settle(next.payout, note);
    roundRef.current = null;
    onBusy(false);
  };

  const cashOut = () => {
    const g = gameRef.current;
    if (g.phase !== 'live' || g.gems < 1) return;
    const m = g.mines.length;
    const payout = payoutFor(g.stake, m, g.gems);
    finish({ ...g, phase: 'won', payout }, t.noteWin(g.gems, m, multLabel(multiplier(m, g.gems), lang)));
  };

  const open = (i: number) => {
    const g = gameRef.current;
    if (g.phase !== 'live' || i < 0 || g.opened[i]) return;
    const opened = g.opened.slice();
    opened[i] = true;
    const m = g.mines.length;
    if (g.mines.includes(i)) {
      finish({ ...g, opened, phase: 'lost', hit: i, last: i, payout: 0 }, t.noteLoss(g.gems, m));
      return;
    }
    const gems = g.gems + 1;
    const next: State = { ...g, opened, gems, last: i };
    if (gems >= maxGems(m)) {
      // Every safe tile found: nothing left to risk, so cash out for them.
      const payout = payoutFor(g.stake, m, gems);
      finish({ ...next, phase: 'won', payout }, t.noteWin(gems, m, multLabel(multiplier(m, gems), lang)));
    } else commit(next);
  };

  const openRandom = () => {
    const g = gameRef.current;
    if (g.phase === 'live') open(randomTile(g.opened));
  };

  const main = () => (gameRef.current.phase === 'live' ? cashOut() : start());

  // Keyboard: Space / Enter bets or cashes out, R opens a random tile.
  const keys = useRef({ main, openRandom });
  keys.current = { main, openRandom };
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey || e.repeat) return;
      if (document.querySelector('[role="dialog"]')) return;
      const el = e.target instanceof HTMLElement ? e.target : null;
      if (el?.closest('input, textarea, select, [contenteditable="true"]')) return;
      if (e.key === ' ' || e.key === 'Enter') {
        // A focused button (a tile picked with the keyboard) handles its own activation.
        if (el?.closest('button, a')) return;
        e.preventDefault();
        keys.current.main();
      } else if (e.key === 'r' || e.key === 'R') {
        e.preventDefault();
        keys.current.openRandom();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Mouse clicks shouldn't leave focus on a button, so Space keeps meaning "bet / cash out".
  const noFocus = (e: MouseEvent) => e.preventDefault();

  const over = game.phase === 'won' || game.phase === 'lost';
  const stake = live || over ? game.stake : bet;
  const gems = game.gems;
  const mult = multiplier(mines, gems);
  const canNext = gems < total && game.phase !== 'lost' && game.phase !== 'won';
  const payoutShown = game.phase === 'lost' ? 0 : gems ? payoutFor(stake, mines, gems) : null;
  const mineSet = new Set(game.mines);
  const lastR = Math.floor(game.last / SIDE);
  const lastC = game.last % SIDE;

  return (
    <div className={styles.wrap}>
      <div className={styles.stats} aria-live="polite">
        <div className={styles.stat}>
          <span className={styles.statLabel}>{t.multiplier}</span>
          <strong className={`${styles.statValue} ${gems && game.phase !== 'lost' ? styles.up : ''}`}>{multLabel(mult, lang)}</strong>
          <span className={styles.statSub}>{t.gemsOf(gems, total)}</span>
        </div>
        <div className={styles.stat}>
          <span className={styles.statLabel}>{t.payout}</span>
          <strong className={styles.statValue}>{payoutShown == null ? '—' : formatMoney(payoutShown, lang)}</strong>
          <span className={styles.statSub}>{t.stakeOf(formatMoney(stake, lang))}</span>
        </div>
        <div className={styles.stat}>
          <span className={styles.statLabel}>{t.nextTile}</span>
          <strong className={styles.statValue}>{canNext ? multLabel(multiplier(mines, gems + 1), lang) : '—'}</strong>
          <span className={styles.statSub}>{canNext ? t.safeChance(pct(safeChance(mines, gems), lang)) : ' '}</span>
        </div>
      </div>

      <div className={styles.boardWrap}>
        <div
          className={`${styles.board} ${live ? styles.live : ''} ${game.phase === 'lost' ? styles.lost : ''} ${game.phase === 'won' ? styles.won : ''}`}
          role="group"
          aria-label={t.boardLabel(mines)}
        >
          {Array.from({ length: TILES }, (_, i) => {
            const r = Math.floor(i / SIDE);
            const c = i % SIDE;
            const isMine = mineSet.has(i);
            const picked = game.opened[i];
            const shown = picked || over;
            const dim = over && !picked;
            const hit = game.hit === i;
            const dist = Math.max(Math.abs(r - lastR), Math.abs(c - lastC));
            const cls = [styles.tile, shown ? styles.open : styles.closed, shown && (isMine ? styles.isMine : styles.isGem), dim && styles.dim, hit && styles.hit]
              .filter(Boolean)
              .join(' ');
            const state = !shown ? t.hidden : hit ? t.hitMine : isMine ? t.mine : t.gem;
            return (
              <button
                key={i}
                type="button"
                className={cls}
                style={dim ? ({ '--d': `${RIPPLE_START_MS + dist * RIPPLE_STEP_MS}ms` } as CSSProperties) : undefined}
                disabled={!live || picked}
                onMouseDown={noFocus}
                onClick={() => open(i)}
                aria-label={t.tileLabel(r + 1, c + 1, state)}
              >
                {shown && <span className={styles.face}>{isMine ? <MineIcon /> : <GemIcon />}</span>}
              </button>
            );
          })}
        </div>
        {over && showResult && (
          <div className={styles.overlay} onClick={() => setShowResult(false)}>
            <div className={styles.overlayCard}>
              <RoundResult
                stake={game.stake}
                payout={game.payout}
                lang={lang}
                detail={
                  game.phase === 'lost'
                    ? t.resultLoss(game.gems)
                    : game.gems >= maxGems(game.mines.length)
                      ? t.resultAll(multLabel(multiplier(game.mines.length, game.gems), lang))
                      : t.resultWin(game.gems, multLabel(multiplier(game.mines.length, game.gems), lang))
                }
              />
            </div>
          </div>
        )}
      </div>

      <div className={styles.controls}>
        <div className={styles.minesBlock}>
          <div className={styles.minesHead}>
            <span className={styles.label}>{t.mines}</span>
            <span className={styles.minesInfo}>{t.nGems(total)}</span>
          </div>
          <div className={styles.minesRow}>
            <div className={styles.stepper}>
              <button type="button" className={styles.step} disabled={live || mines <= MIN_MINES} onClick={() => setMines(mines - 1)} aria-label={t.fewerMines}>
                <svg viewBox="0 0 16 16" aria-hidden>
                  <path d="M3.5 8h9" />
                </svg>
              </button>
              <output className={styles.minesValue} aria-label={t.minesPick(mines)}>
                {mines}
              </output>
              <button type="button" className={styles.step} disabled={live || mines >= MAX_MINES} onClick={() => setMines(mines + 1)} aria-label={t.moreMines}>
                <svg viewBox="0 0 16 16" aria-hidden>
                  <path d="M3.5 8h9M8 3.5v9" />
                </svg>
              </button>
            </div>
            <div className={styles.quick}>
              {QUICK_MINES.map((q) => (
                <button
                  key={q}
                  type="button"
                  className={`${styles.chip} ${q === mines ? styles.chipOn : ''}`}
                  disabled={live}
                  aria-pressed={q === mines}
                  aria-label={t.minesPick(q)}
                  onClick={() => setMines(q)}
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        </div>

        <BetInput value={bet} onChange={setBet} disabled={live} lang={lang} />

        <div className={styles.actions}>
          <button
            type="button"
            className={`btn btn-primary ${styles.mainBtn} ${live ? styles.cashBtn : ''}`}
            disabled={live && gems < 1}
            onMouseDown={noFocus}
            onClick={main}
          >
            {live ? (gems ? t.cashOutAmount(formatMoney(payoutFor(game.stake, mines, gems), lang)) : t.cashOut) : t.bet}
          </button>
          <button type="button" className={`btn btn-secondary ${styles.randomBtn}`} disabled={!live} onMouseDown={noFocus} onClick={openRandom}>
            <svg viewBox="0 0 20 20" aria-hidden className={styles.dice}>
              <rect x="2.5" y="2.5" width="15" height="15" rx="3.5" />
              <circle cx="7" cy="7" r="1.3" />
              <circle cx="13" cy="13" r="1.3" />
              <circle cx="13" cy="7" r="1.3" />
              <circle cx="7" cy="13" r="1.3" />
            </svg>
            {t.randomTile}
          </button>
        </div>
        <p className={styles.keys}>{t.keys}</p>
      </div>
    </div>
  );
}

/** A faceted brilliant-cut gem: a light table on top, darker pavilion facets below. */
function GemIcon() {
  return (
    <svg className={styles.gem} viewBox="0 0 64 64" aria-hidden>
      <path d="M13 23 22 11h20l9 12-19 32Z" fill="#0b7f57" />
      <path d="M13 23 22 11l4 12Z" fill="#6ef0bf" />
      <path d="M22 11h20l-4 12H26Z" fill="#a8ffe0" />
      <path d="M42 11l9 12H38Z" fill="#3ee0a0" />
      <path d="M13 23h13l6 32Z" fill="#26c98a" />
      <path d="M26 23h12l-6 32Z" fill="#17b077" />
      <path d="M38 23h13L32 55Z" fill="#0d8f61" />
      <path d="M13 23h38M22 11l4 12 6 32 6-32 4-12" fill="none" stroke="#065c3e" strokeOpacity="0.35" strokeWidth="0.8" strokeLinejoin="round" />
      <path d="M25 13.5h8l-3 5h-6.5Z" fill="#fff" fillOpacity="0.75" />
    </svg>
  );
}

/** A round bomb with a lit fuse. */
function MineIcon() {
  return (
    <svg className={styles.mine} viewBox="0 0 64 64" aria-hidden>
      <path d="M41 17c3-6 8-8 12-5" fill="none" stroke="#d9c6a5" strokeWidth="2.6" strokeLinecap="round" />
      <path d="m53 6 1.4 3.6L58 8l-2 3.4 3.4 2-3.9.5.3 3.9-2.7-2.8-2.9 2.6.5-3.9-3.9-.7 3.5-1.8-1.7-3.5 3.6 1.6Z" fill="#ffd43b" />
      <circle cx="54.6" cy="11.4" r="1.8" fill="#fff4c2" />
      <rect x="35" y="15" width="11" height="9" rx="2" transform="rotate(40 40.5 19.5)" fill="#3a2d4f" />
      <circle cx="29" cy="37" r="19" fill="#e5484d" />
      <path d="M44.5 26A19 19 0 0 1 17 52a19 19 0 0 0 27.5-26Z" fill="#b8232f" />
      <ellipse cx="22" cy="29" rx="6" ry="4" transform="rotate(-35 22 29)" fill="#fff" fillOpacity="0.55" />
    </svg>
  );
}
