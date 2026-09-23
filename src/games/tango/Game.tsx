import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import type { GameProps } from '../../core/types';
import { ControlBar, ControlButton, HintBubble } from '../../core/components/Controls';
import { Bulb, Reset, Undo } from '../../core/components/Icons';
import { useGameSetting } from '../../lib/settings';
import {
  MOON,
  N,
  SUN,
  findDeduction,
  findViolations,
  generateTango,
  makeCtx,
  violationMessage,
  type Difficulty,
  type Val,
} from './logic';
import styles from './Game.module.css';
import { STR } from './i18n';

interface HintState {
  cell: number;
  related: number[];
  message: string;
  /** Faded preview of the deduced symbol. */
  ghost?: Val;
  mistake?: boolean;
}

const cycle = (v: Val): Val => (v === 0 ? SUN : v === SUN ? MOON : 0);

function SunIcon() {
  return (
    <svg viewBox="0 0 40 40" className={styles.sun} aria-hidden>
      <circle cx="20" cy="20" r="15" />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg viewBox="0 0 40 40" className={styles.moon} aria-hidden>
      <path d="M24.5 5.2A15.2 15.2 0 1034.8 27 12.2 12.2 0 0124.5 5.2z" />
    </svg>
  );
}

function SignGlyph({ eq }: { eq: boolean }) {
  return (
    <svg viewBox="0 0 20 20" aria-hidden>
      {eq ? <path d="M5.5 7.8h9M5.5 12.2h9" /> : <path d="M6.5 6.5l7 7M13.5 6.5l-7 7" />}
    </svg>
  );
}

export default function Game({ seed, lang, options, paused, onReady, onHint, onComplete }: GameProps) {
  const t = STR[lang];
  const difficulty = (options.difficulty ?? 'medium') as Difficulty;
  const puzzle = useMemo(() => generateTango(seed, difficulty), [seed, difficulty]);
  const ctx = useMemo(() => makeCtx(puzzle.signs), [puzzle]);
  const locked = useMemo(() => puzzle.givens.map((v) => v !== 0), [puzzle]);

  const [showErrors] = useGameSetting('tango', 'showErrors', true);
  const [board, setBoardRaw] = useState<Val[]>(() => puzzle.givens.slice());
  const [history, setHistoryRaw] = useState<Val[][]>([]);
  const [settled, setSettled] = useState<Val[]>(board);
  const [hint, setHint] = useState<HintState | null>(null);
  const [cursor, setCursorRaw] = useState<number | null>(null);
  const [won, setWon] = useState(false);
  const [keyboardMode, setKeyboardMode] = useState(false);

  // Mirrors updated synchronously so rapid input between renders never reads stale state.
  const live = useRef({ board, history, cursor });
  const setBoard = (b: Val[]) => {
    live.current.board = b;
    setBoardRaw(b);
  };
  const setHistory = (h: Val[][]) => {
    live.current.history = h;
    setHistoryRaw(h);
  };
  const setCursor = (c: number | null) => {
    live.current.cursor = c;
    setCursorRaw(c);
  };

  const cb = useRef({ onReady, onHint, onComplete });
  cb.current = { onReady, onHint, onComplete };
  const readyCalled = useRef(false);
  const completeCalled = useRef(false);

  useEffect(() => {
    if (readyCalled.current) return;
    readyCalled.current = true;
    cb.current.onReady();
  }, []);

  // Errors appear only after a short pause in play.
  useEffect(() => {
    const t = window.setTimeout(() => setSettled(board), 600);
    return () => window.clearTimeout(t);
  }, [board]);

  const inputBlocked = paused || won;

  const commit = (next: Val[]) => {
    setHistory([...live.current.history, live.current.board]);
    setBoard(next);
    setHint(null);
  };

  const setCell = (i: number, v: Val) => {
    const cur = live.current.board;
    if (inputBlocked || locked[i] || cur[i] === v) return;
    const next = cur.slice();
    next[i] = v;
    commit(next);
  };

  const tap = (i: number) => {
    if (inputBlocked) return;
    setCursor(i);
    setCell(i, cycle(live.current.board[i]));
  };

  // Right-click places a moon directly (or clears an existing moon).
  const placeMoon = (i: number) => {
    if (inputBlocked) return;
    setCursor(i);
    setCell(i, live.current.board[i] === MOON ? 0 : MOON);
  };

  const undo = () => {
    const h = live.current.history;
    if (inputBlocked || !h.length) return;
    setBoard(h[h.length - 1]);
    setHistory(h.slice(0, -1));
    setHint(null);
  };

  const clear = () => {
    if (inputBlocked) return;
    if (live.current.board.every((v, i) => v === puzzle.givens[i])) return;
    commit(puzzle.givens.slice());
  };

  const giveHint = () => {
    if (inputBlocked) return;
    cb.current.onHint();
    const board = live.current.board;
    const wrong = board.findIndex((v, i) => v && !locked[i] && v !== puzzle.solution[i]);
    if (wrong >= 0) {
      setHint({
        cell: wrong,
        related: [],
        mistake: true,
        message: t.wrongSymbol(board[wrong]),
      });
      return;
    }
    const d = findDeduction(board, ctx, 3);
    if (d) {
      setHint({ cell: d.cell, related: d.related, message: t.deduction(d.msg), ghost: d.value });
      return;
    }
    // Fallback: reveal one correct cell.
    const empty = board.findIndex((v) => !v);
    if (empty < 0) return;
    const next = board.slice();
    next[empty] = puzzle.solution[empty];
    setHistory([...live.current.history, board]);
    setBoard(next);
    setHint({ cell: empty, related: [], message: t.reveal });
  };

  // Win detection.
  useEffect(() => {
    if (won || completeCalled.current) return;
    if (board.every((v, i) => v === puzzle.solution[i])) {
      completeCalled.current = true;
      setWon(true);
      setHint(null);
      setCursor(null);
      cb.current.onComplete({ won: true, share: '☀️🌙 Tango' });
    }
  }, [board, puzzle, won]);

  // Keyboard: arrows move, Space/Enter cycles, Backspace clears, Cmd/Ctrl+Z undoes.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (inputBlocked) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
      if (document.querySelector('.lp-modal-backdrop')) return;
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        undo();
        return;
      }
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const cursor = live.current.cursor;
      const cur = cursor ?? 0;
      const r = Math.floor(cur / N);
      const c = cur % N;
      let next: number | null = null;
      switch (e.key) {
        case 'ArrowUp':
          next = ((r + N - 1) % N) * N + c;
          break;
        case 'ArrowDown':
          next = ((r + 1) % N) * N + c;
          break;
        case 'ArrowLeft':
          next = r * N + ((c + N - 1) % N);
          break;
        case 'ArrowRight':
          next = r * N + ((c + 1) % N);
          break;
        case ' ':
        case 'Enter':
          e.preventDefault();
          setKeyboardMode(true);
          if (cursor === null) setCursor(0);
          else setCell(cur, cycle(live.current.board[cur]));
          return;
        case 'Backspace':
        case 'Delete':
          if (cursor !== null) {
            e.preventDefault();
            setCell(cur, 0);
          }
          return;
        default:
          return;
      }
      e.preventDefault();
      setCursor(cursor === null ? 0 : next);
      setKeyboardMode(true);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  // Errors: violations from the settled board that still hold now (fixes clear instantly).
  const violations = useMemo(() => {
    if (!showErrors) return [];
    return findViolations(settled, puzzle.signs).filter((v) => v.cells.every((c) => board[c] === settled[c]));
  }, [board, settled, puzzle.signs, showErrors]);
  const errorCells = useMemo(() => new Set(violations.flatMap((v) => v.cells)), [violations]);
  const errorText = violations.length ? violationMessage(violations[0], t) : null;

  const hintCells = useMemo(() => (hint ? new Set([hint.cell, ...hint.related]) : null), [hint]);
  const canClear = board.some((v, i) => v !== puzzle.givens[i]);

  return (
    <div className={`${styles.wrap}${lang === 'es' ? ` ${styles.longLabels}` : ''}`}>
      <div
        className={`${styles.board}${hint ? ` ${styles.hinting}` : ''}${won ? ` ${styles.won}` : ''}`}
        role="grid"
        aria-label={t.boardLabel}
        onPointerDown={() => setKeyboardMode(false)}
      >
        <div className={styles.grid}>
          {board.map((v, i) => {
            const r = Math.floor(i / N);
            const c = i % N;
            const cls = [styles.cell];
            if (locked[i]) cls.push(styles.given);
            if (errorCells.has(i)) cls.push(styles.error);
            if (hintCells) {
              if (i === hint!.cell) cls.push(hint!.mistake ? styles.hintMistake : styles.hintTarget);
              else if (hintCells.has(i)) cls.push(styles.hintRelated);
              else cls.push(styles.dim);
            }
            if (keyboardMode && cursor === i && !won) cls.push(styles.cursor);
            const label = t.cellLabel(r + 1, c + 1, v, locked[i]);
            return (
              <button
                key={i}
                type="button"
                tabIndex={-1}
                className={cls.join(' ')}
                style={{ '--d': `${(r + c) * 45}ms` } as CSSProperties}
                aria-label={label}
                onClick={() => tap(i)}
                onContextMenu={(e) => {
                  e.preventDefault();
                  placeMoon(i);
                }}
                aria-disabled={locked[i] || undefined}
              >
                {v !== 0 && (
                  <span key={v} className={`${styles.sym}${locked[i] ? '' : ` ${styles.pop}`}`}>
                    {v === SUN ? <SunIcon /> : <MoonIcon />}
                  </span>
                )}
                {v === 0 && hint && hint.cell === i && hint.ghost && (
                  <span className={`${styles.sym} ${styles.ghost}`}>{hint.ghost === SUN ? <SunIcon /> : <MoonIcon />}</span>
                )}
              </button>
            );
          })}
        </div>
        {puzzle.signs.map((s) => {
          const horizontal = s.b === s.a + 1;
          const r = Math.floor(s.a / N);
          const c = s.a % N;
          const left = horizontal ? ((c + 1) / N) * 100 : ((c + 0.5) / N) * 100;
          const top = horizontal ? ((r + 0.5) / N) * 100 : ((r + 1) / N) * 100;
          return (
            <span
              key={`${s.a}-${s.b}`}
              className={styles.sign}
              style={{ left: `${left}%`, top: `${top}%` }}
              aria-label={s.eq ? t.signEqual : t.signOpposite}
            >
              <SignGlyph eq={s.eq} />
            </span>
          );
        })}
      </div>

      <div className={styles.message} aria-live="polite">
        {errorText && (
          <span className={styles.messageText} key={errorText}>
            <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden>
              <circle cx="8" cy="8" r="7" fill="currentColor" />
              <path d="M8 4.2v4.6M8 11.3v.2" stroke="var(--cell-bg)" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
            {errorText}
          </span>
        )}
      </div>

      <ControlBar>
        <ControlButton icon={<Undo size={18} />} label={t.undo} onClick={undo} disabled={inputBlocked || !history.length} />
        <ControlButton icon={<Bulb size={18} />} label={t.hint} onClick={giveHint} disabled={inputBlocked} />
        <ControlButton icon={<Reset size={18} />} label={t.clear} onClick={clear} disabled={inputBlocked || !canClear} />
      </ControlBar>

      {hint && <HintBubble onDismiss={() => setHint(null)}>{hint.message}</HintBubble>}
    </div>
  );
}
