import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from 'react';
import type { GameProps } from '../../core/types';
import { ControlBar, ControlButton, HintBubble } from '../../core/components/Controls';
import { Bulb } from '../../core/components/Icons';
import { generateBoard, hintFor, HIDDEN, LEVELS, levelOf, MINE, OPEN, openFrom, type Board, type Hint, type Knowledge } from './logic';
import { STR, type Strings } from './i18n';
import styles from './Game.module.css';

/** Player state per square: HIDDEN, OPEN, or FLAG (a flag is the player's "known mine"). */
const FLAG = MINE;
type Mode = 'dig' | 'flag';
const LONG_PRESS_MS = 380;
/** Opening ripples outward from the tapped square: per-square step and cap, kept short so play stays fast. */
const RIPPLE_STEP_MS = 16;
const RIPPLE_MAX_MS = 220;

interface ShownHint {
  text: string;
  cell: number;
  sources: number[];
  bad: boolean;
}

function flagsAround(b: Board, st: Knowledge, i: number): number {
  let k = 0;
  for (const j of b.nb[i]) if (st[j] === FLAG) k++;
  return k;
}

/** Squares between two cells, counting diagonals as one step. */
function steps(b: Board, a: number, c: number): number {
  return Math.max(Math.abs(Math.floor(a / b.w) - Math.floor(c / b.w)), Math.abs((a % b.w) - (c % b.w)));
}

/** Every flag placed, and every one of them on a mine. */
function flagsSolve(b: Board, st: Knowledge): boolean {
  let flags = 0;
  for (let i = 0; i < st.length; i++) {
    if (st[i] !== FLAG) continue;
    if (!b.mines[i]) return false;
    flags++;
  }
  return flags === b.mineCount;
}

function hiddenAround(b: Board, st: Knowledge, i: number): number[] {
  return b.nb[i].filter((j) => st[j] === HIDDEN);
}

/** Words a hint using the numbers the player sees (flags count as found mines). */
function describe(t: Strings, b: Board, st: Knowledge, h: Hint): ShownHint {
  if (h.kind === 'wrongFlag') return { text: t.wrongFlag, cell: h.cell, sources: [], bad: true };
  if (h.kind === 'reveal') return { text: t.reveal, cell: h.cell, sources: [], bad: false };
  const d = h.d;
  const need = (i: number) => b.counts[i] - flagsAround(b, st, i);
  switch (d.kind) {
    case 'single':
      return {
        text: d.mine ? t.singleMine(b.counts[d.source], need(d.source)) : t.singleSafe(b.counts[d.source]),
        cell: h.cell,
        sources: [d.source],
        bad: false,
      };
    case 'pair': {
      const a = d.source;
      const o = d.other;
      const aCells = hiddenAround(b, st, a);
      const k = hiddenAround(b, st, o).filter((x) => !aCells.includes(x)).length;
      const args = [b.counts[a], b.counts[o], need(a), need(o), k] as const;
      return { text: d.mine ? t.pairMine(...args) : t.pairSafe(...args), cell: h.cell, sources: [a, o], bad: false };
    }
    case 'count': {
      const left = b.mineCount - st.reduce((n, v) => n + (v === FLAG ? 1 : 0), 0);
      return { text: d.mine ? t.countMine(left) : t.countSafe(b.mineCount), cell: h.cell, sources: [], bad: false };
    }
    case 'enum':
      return { text: d.mine ? t.enumMine : t.enumSafe, cell: h.cell, sources: d.sources, bad: false };
  }
}

export default function Game({ seed, lang, options, paused, onReady, onHint, onComplete }: GameProps) {
  const t = STR[lang];
  const level = levelOf(options.level);
  const { w, h, mines: mineTotal } = LEVELS[level];

  // The board is generated on the first tap, around that square (so it's always safe).
  const [board, setBoard] = useState<Board | null>(null);
  const boardRef = useRef<Board | null>(null);
  const [st, setStState] = useState<Knowledge>(() => new Uint8Array(w * h));
  const stRef = useRef(st);
  const setSt = (next: Knowledge) => {
    stRef.current = next;
    setStState(next);
  };
  const [status, setStatus] = useState<'play' | 'won' | 'lost'>('play');
  const [boom, setBoom] = useState(-1);
  /** Reveal delay (ms) of the squares opened by the latest move. */
  const [delays, setDelays] = useState<Map<number, number>>(() => new Map());
  const [mode, setMode] = useState<Mode>('dig');
  const [hint, setHint] = useState<ShownHint | null>(null);
  const [focus, setFocus] = useState<number | null>(null);
  /** The focus ring only shows while playing with the keyboard. */
  const [kbd, setKbd] = useState(false);
  const [pressed, setPressed] = useState<number | null>(null);
  const press = useRef<{ id: number; cell: number; timer: number; done: boolean } | null>(null);
  const cellsRef = useRef<HTMLDivElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const cb = useRef({ onReady, onHint, onComplete });
  cb.current = { onReady, onHint, onComplete };
  const locked = paused || status !== 'play';

  useEffect(() => {
    cb.current.onReady();
  }, []);

  // ---------- Layout: whole-pixel squares; the wide board turns sideways on narrow screens ----------
  const [width, setWidth] = useState(360);
  useLayoutEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const measure = () => setWidth(el.clientWidth);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const transposed = w > h && width / w < 22;
  const cols = transposed ? h : w;
  const rows = transposed ? w : h;
  const cell = Math.max(14, Math.min(48, Math.floor(width / cols)));
  /** Board index of the square drawn at display row `dr`, column `dc`. */
  const at = (dr: number, dc: number) => (transposed ? dc * w + dr : dr * w + dc);
  const displayPos = (i: number): [number, number] => (transposed ? [i % w, Math.floor(i / w)] : [Math.floor(i / w), i % w]);

  // ---------- Game actions ----------
  const finish = (won: boolean, final: Knowledge, hit = -1) => {
    setStatus(won ? 'won' : 'lost');
    setHint(null);
    setBoom(hit);
    setSt(final);
    const name = lang === 'es' ? 'Buscaminas' : 'Minesweeper';
    cb.current.onComplete(won ? { won: true, share: `💣 ${name} ${w}×${h}` } : { won: false, summary: t.boom });
  };

  /** Applies a move that started at `origin`: animates what it opened and checks for a win. */
  const settle = (b: Board, next: Knowledge, origin: number) => {
    const prev = stRef.current;
    let open = 0;
    for (let i = 0; i < next.length; i++) if (next[i] === OPEN) open++;
    // Won by opening every safe square, or by flagging every mine correctly (the rest opens itself).
    const won = open === w * h - b.mineCount || flagsSolve(b, next);
    const final = next.slice();
    if (won) for (let i = 0; i < final.length; i++) final[i] = b.mines[i] ? FLAG : OPEN;
    const d = new Map<number, number>();
    for (let i = 0; i < final.length; i++) {
      if (final[i] === OPEN && prev[i] !== OPEN) d.set(i, Math.min(steps(b, origin, i) * RIPPLE_STEP_MS, RIPPLE_MAX_MS));
    }
    setDelays(d);
    if (won) finish(true, final);
    else setSt(final);
  };

  const chord = (i: number) => {
    const b = boardRef.current;
    const cur = stRef.current;
    if (!b || cur[i] !== OPEN || b.counts[i] === 0 || flagsAround(b, cur, i) !== b.counts[i]) return;
    const around = hiddenAround(b, cur, i);
    if (!around.length) return;
    const hit = around.find((j) => b.mines[j]);
    if (hit !== undefined) return finish(false, cur, hit);
    const next = cur.slice();
    for (const j of around) openFrom(b, next, j);
    settle(b, next, i);
  };

  const dig = (i: number) => {
    const cur = stRef.current;
    if (cur[i] === FLAG) return;
    if (cur[i] === OPEN) return chord(i);
    let b = boardRef.current;
    if (!b) {
      b = generateBoard(seed, level, i);
      boardRef.current = b;
      setBoard(b);
    }
    if (b.mines[i]) return finish(false, cur, i);
    const next = cur.slice();
    openFrom(b, next, i);
    settle(b, next, i);
  };

  const toggleFlag = (i: number) => {
    const cur = stRef.current;
    if (cur[i] === OPEN) return chord(i);
    const next = cur.slice();
    next[i] = cur[i] === FLAG ? HIDDEN : FLAG;
    const b = boardRef.current;
    if (b) settle(b, next, i);
    else setSt(next);
  };

  const primary = (i: number) => (mode === 'dig' ? dig(i) : toggleFlag(i));
  const secondary = (i: number) => (mode === 'dig' ? toggleFlag(i) : dig(i));

  // ---------- Pointer: tap = current mode, long-press / right-click = the other one ----------
  const cellAt = (x: number, y: number): number => {
    const el = cellsRef.current;
    if (!el) return -1;
    const r = el.getBoundingClientRect();
    const dc = Math.floor(((x - r.left) / r.width) * cols);
    const dr = Math.floor(((y - r.top) / r.height) * rows);
    if (dc < 0 || dr < 0 || dc >= cols || dr >= rows) return -1;
    return at(dr, dc);
  };

  const cancelPress = () => {
    if (press.current) window.clearTimeout(press.current.timer);
    press.current = null;
    setPressed(null);
  };

  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (locked) return;
    const i = cellAt(e.clientX, e.clientY);
    if (i < 0) return;
    setHint(null);
    setFocus(i);
    setKbd(false);
    if (e.pointerType === 'mouse' && e.button !== 0) {
      e.preventDefault();
      if (e.button === 2) toggleFlag(i);
      else if (e.button === 1) chord(i);
      return;
    }
    cancelPress();
    const p = { id: e.pointerId, cell: i, timer: 0, done: false };
    if (e.pointerType !== 'mouse') {
      p.timer = window.setTimeout(() => {
        p.done = true;
        setPressed(null);
        navigator.vibrate?.(12);
        secondary(p.cell);
      }, LONG_PRESS_MS);
    }
    press.current = p;
    setPressed(i);
  };

  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const p = press.current;
    if (p && p.id === e.pointerId && !p.done && cellAt(e.clientX, e.clientY) !== p.cell) cancelPress();
  };

  const onPointerUp = (e: ReactPointerEvent<HTMLDivElement>) => {
    const p = press.current;
    if (!p || p.id !== e.pointerId) return;
    cancelPress();
    if (p.done || locked || cellAt(e.clientX, e.clientY) !== p.cell) return;
    primary(p.cell);
  };

  useEffect(() => () => cancelPress(), []);

  // ---------- Hint ----------
  const giveHint = () => {
    if (locked) return;
    const b = boardRef.current;
    if (!b) {
      setHint({ text: t.start, cell: -1, sources: [], bad: false });
      return;
    }
    const hnt = hintFor(b, stRef.current);
    if (!hnt) return;
    cb.current.onHint();
    const shown = describe(t, b, stRef.current, hnt);
    setHint(shown);
    setFocus(hnt.cell);
    const next = stRef.current.slice();
    if (hnt.kind === 'wrongFlag') next[hnt.cell] = HIDDEN;
    else if (hnt.kind === 'deduce' && hnt.d.mine) next[hnt.cell] = FLAG;
    else openFrom(b, next, hnt.cell);
    settle(b, next, hnt.cell);
  };

  // ---------- Keyboard: arrows move, Space/Enter act, F flags ----------
  const live = useRef({ focus, locked, primary, toggleFlag, giveHint });
  live.current = { focus, locked, primary, toggleFlag, giveHint };
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const s = live.current;
      if (s.locked || document.querySelector('.lp-modal-backdrop')) return;
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'BUTTON')) return;
      const moves: Record<string, [number, number]> = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] };
      if (moves[e.key]) {
        e.preventDefault();
        setKbd(true);
        const [dr, dc] = s.focus === null ? [0, 0] : displayPos(s.focus);
        const r = Math.max(0, Math.min(rows - 1, dr + (s.focus === null ? 0 : moves[e.key][0])));
        const c = Math.max(0, Math.min(cols - 1, dc + (s.focus === null ? 0 : moves[e.key][1])));
        setFocus(at(r, c));
        return;
      }
      if (s.focus === null) return;
      if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        setHint(null);
        s.primary(s.focus);
      } else if (e.key.toLowerCase() === 'f') {
        e.preventDefault();
        setHint(null);
        s.toggleFlag(s.focus);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, cols, transposed]);

  // ---------- Render ----------
  const flags = st.reduce((n, v) => n + (v === FLAG ? 1 : 0), 0);
  const left = mineTotal - flags;
  const hintSources = new Set(hint?.sources ?? []);
  const squares = [];
  for (let dr = 0; dr < rows; dr++) {
    for (let dc = 0; dc < cols; dc++) {
      const i = at(dr, dc);
      const v = st[i];
      const isMine = !!board?.mines[i];
      const showMine = status === 'lost' && isMine && v !== FLAG;
      const wrongFlag = status === 'lost' && v === FLAG && !isMine;
      const n = board && v === OPEN ? board.counts[i] : 0;
      // Opened squares ripple out from the move; on a loss the mines ripple out from the one you hit.
      const rd = showMine && board && boom >= 0 ? Math.min(steps(board, boom, i) * 12, 300) : (delays.get(i) ?? 0);
      const state = v === OPEN ? (n ? String(n) : t.blank) : v === FLAG ? t.flagged : showMine ? t.mineSq : t.hiddenSq;
      const cls = [
        styles.sq,
        v === OPEN || showMine ? styles.open : styles.hidden,
        (dr + dc) % 2 ? styles.alt : '',
        pressed === i && v === HIDDEN ? styles.pressed : '',
        i === boom ? styles.boom : '',
        wrongFlag ? styles.wrongFlag : '',
        kbd && focus === i ? styles.focus : '',
        hint && hint.cell === i ? (hint.bad ? styles.hintBad : styles.hintCell) : '',
        hintSources.has(i) ? styles.hintSource : '',
        status === 'won' && v === FLAG ? styles.wonFlag : '',
      ].join(' ');
      squares.push(
        <div key={i} role="gridcell" aria-label={t.cellLabel(dr + 1, dc + 1, state)} className={cls} style={{ '--d': `${(dr + dc) * 18}ms`, '--rd': `${rd}ms` } as CSSProperties}>
          {n > 0 && <span className={styles[`n${n}`]}>{n}</span>}
          {v === FLAG && <FlagIcon />}
          {showMine && <MineIcon />}
        </div>,
      );
    }
  }

  return (
    <div className={styles.wrap} ref={wrapRef}>
      <div
        ref={cellsRef}
        className={`${styles.board}${status === 'won' ? ` ${styles.won}` : ''}${status === 'lost' ? ` ${styles.lost}` : ''}`}
        style={{ gridTemplateColumns: `repeat(${cols}, ${cell}px)`, gridTemplateRows: `repeat(${rows}, ${cell}px)`, '--cell': `${cell}px` } as CSSProperties}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={cancelPress}
        onPointerLeave={cancelPress}
        onContextMenu={(e) => e.preventDefault()}
        role="grid"
        aria-label={t.gridLabel(w, h, mineTotal)}
      >
        {squares}
      </div>

      {status === 'won' && <p className={styles.reveal}>{t.cleared}</p>}
      {hint && status === 'play' && <HintBubble onDismiss={() => setHint(null)}>{hint.text}</HintBubble>}

      <ControlBar>
        <div className={styles.modes} role="radiogroup" aria-label={t.tapMode}>
          <button type="button" role="radio" aria-checked={mode === 'dig'} className={mode === 'dig' ? styles.modeOn : ''} onClick={() => setMode('dig')} disabled={locked}>
            <span className={styles.modeDig} aria-hidden /> {t.dig}
          </button>
          <button type="button" role="radio" aria-checked={mode === 'flag'} className={mode === 'flag' ? styles.modeOn : ''} onClick={() => setMode('flag')} disabled={locked}>
            <FlagIcon small /> {t.flag}
          </button>
        </div>
      </ControlBar>
      <ControlBar>
        <div className={styles.counter} role="status" aria-label={t.minesLeft(left)}>
          <MineIcon small />
          <span>{left}</span>
        </div>
        <ControlButton icon={<Bulb size={18} />} label={t.hint} onClick={giveHint} disabled={locked} />
      </ControlBar>
    </div>
  );
}

function FlagIcon({ small }: { small?: boolean }) {
  return (
    <svg viewBox="0 0 20 20" className={small ? styles.iconSmall : styles.flag} aria-hidden>
      <path d="M6.5 3.5v13" className={styles.pole} />
      <path d="M7.3 3.6l8 3.4-8 3.4z" className={styles.cloth} />
      <path d="M4 16.5h6" className={styles.pole} />
    </svg>
  );
}

function MineIcon({ small }: { small?: boolean }) {
  return (
    <svg viewBox="0 0 20 20" className={small ? styles.iconSmall : styles.mine} aria-hidden>
      <path d="M10 2.5v15M2.5 10h15M4.7 4.7l10.6 10.6M15.3 4.7L4.7 15.3" className={styles.spikes} />
      <circle cx="10" cy="10" r="5.2" className={styles.body} />
      <circle cx="8.2" cy="8.2" r="1.4" className={styles.shine} />
    </svg>
  );
}
