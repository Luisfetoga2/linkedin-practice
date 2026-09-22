import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent, type PointerEvent } from 'react';
import { ControlBar, ControlButton, HintBubble } from '../../core/components/Controls';
import { Bulb, Eraser, Undo } from '../../core/components/Icons';
import type { GameProps } from '../../core/types';
import { useGameSetting } from '../../lib/settings';
import { cellsBetween, emptyBoard, isEmptyBoard, isWin, nextValue, paint, queensOf, setCell, type BoardState } from './board';
import styles from './Game.module.css';
import { generate } from './generator';
import { CROSS, EMPTY, QUEEN, getHint, type Hint } from './hints';
import { Crown, Cross } from './icons';
import { REGION_NAMES, findClashes } from './puzzle';
import { Solver } from './solver';

interface Drag {
  id: number;
  start: number;
  last: number;
  startVal: number;
  moved: boolean;
  /** 'add' paints ✕ on empty cells, 'erase' removes ✕s, null = started on a queen (tap only). */
  mode: 'add' | 'erase' | null;
  before: BoardState;
}

const WAVE_STEP_MS = 45;

/** Must match `.frame` border width in Game.module.css. */
const FRAME_BORDER_PX = 3;

export default function Game({ seed, options, paused, onReady, onHint, onComplete }: GameProps) {
  const size = Math.min(10, Math.max(6, Number(options.size) || 8));
  const puzzle = useMemo(() => generate(seed, size), [seed, size]);
  const n = puzzle.size;
  const solver = useMemo(() => new Solver(puzzle.size, puzzle.regions), [puzzle]);
  const [autoX] = useGameSetting<boolean>('queens', 'autoX', false);
  const [showClashes] = useGameSetting<boolean>('queens', 'showClashes', true);

  const [board, setBoardState] = useState<BoardState>(() => emptyBoard(n));
  const boardRef = useRef(board);
  const setBoard = (b: BoardState) => {
    boardRef.current = b;
    setBoardState(b);
  };
  const [history, setHistory] = useState<BoardState[]>([]);
  const [hint, setHint] = useState<Hint | null>(null);
  const [won, setWon] = useState(false);
  const [cursor, setCursor] = useState(0);
  const [showCursor, setShowCursor] = useState(false);
  const gridRef = useRef<HTMLDivElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  // Board side in CSS px, snapped so each cell is a whole number of device pixels (keeps lines crisp).
  const [boardPx, setBoardPx] = useState<number | null>(null);
  // Sub-pixel nudge so the grid's top-left corner also lands on a device pixel.
  const [nudge, setNudge] = useState<[number, number]>([0, 0]);
  useLayoutEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    let raf = 0;
    const snapOrigin = () => {
      const grid = gridRef.current;
      if (!grid) return;
      const dpr = window.devicePixelRatio || 1;
      const r = grid.getBoundingClientRect();
      setNudge(([nx, ny]) => {
        const x = r.left - nx;
        const y = r.top - ny;
        return [(Math.round(x * dpr) - x * dpr) / dpr, (Math.round(y * dpr) - y * dpr) / dpr];
      });
    };
    const measure = () => {
      const dpr = window.devicePixelRatio || 1;
      const avail = el.clientWidth - 2 * FRAME_BORDER_PX;
      const cellDevice = Math.floor((avail * dpr) / n);
      setBoardPx(cellDevice > 0 ? (cellDevice * n) / dpr : null);
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(snapOrigin);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => {
      ro.disconnect();
      cancelAnimationFrame(raf);
    };
  }, [n]);
  const drag = useRef<Drag | null>(null);
  const readyRef = useRef(false);
  const doneRef = useRef(false);

  const locked = paused || won;

  useEffect(() => {
    if (readyRef.current) return;
    readyRef.current = true;
    onReady();
  }, [onReady]);

  useEffect(() => {
    if (doneRef.current || !isWin(puzzle, board)) return;
    doneRef.current = true;
    setWon(true);
    setHint(null);
    drag.current = null;
    onComplete({ won: true, share: `👑 ${n}×${n}` });
  }, [board, puzzle, n, onComplete]);

  const commit = (before: BoardState, after: BoardState) => {
    if (before === after) return;
    setHistory((h) => [...h, before]);
    setBoard(after);
    setHint(null);
  };

  const cellFromPoint = (x: number, y: number): number => {
    const el = gridRef.current;
    if (!el) return -1;
    const rect = el.getBoundingClientRect();
    const c = Math.floor(((x - rect.left) / rect.width) * n);
    const r = Math.floor(((y - rect.top) / rect.height) * n);
    if (r < 0 || r >= n || c < 0 || c >= n) return -1;
    return r * n + c;
  };

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (locked || drag.current) return;
    if (e.pointerType === 'mouse' && e.button === 2) {
      // Right-click toggles a queen directly.
      const i = cellFromPoint(e.clientX, e.clientY);
      if (i < 0) return;
      e.preventDefault();
      setShowCursor(false);
      setCursor(i);
      act(i, boardRef.current.cells[i] === QUEEN ? EMPTY : QUEEN);
      return;
    }
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    const i = cellFromPoint(e.clientX, e.clientY);
    if (i < 0) return;
    e.preventDefault();
    gridRef.current?.focus({ preventScroll: true });
    try {
      gridRef.current?.setPointerCapture(e.pointerId);
    } catch {
      // Pointer no longer active (e.g. released already); dragging still works via move events.
    }
    setShowCursor(false);
    setCursor(i);
    const before = boardRef.current;
    const v = before.cells[i];
    let mode: Drag['mode'] = null;
    if (v === EMPTY) {
      mode = 'add';
      setBoard(setCell(puzzle, before, i, CROSS, autoX));
    } else if (v === CROSS) {
      mode = 'erase';
    }
    drag.current = { id: e.pointerId, start: i, last: i, startVal: v, moved: false, mode, before };
  };

  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    const i = cellFromPoint(e.clientX, e.clientY);
    if (i < 0 || i === d.last) return;
    let b = boardRef.current;
    if (!d.moved) {
      d.moved = true;
      if (d.mode === 'erase') b = paint(puzzle, b, d.start, 'erase');
    }
    if (d.mode) for (const c of cellsBetween(n, d.last, i)) b = paint(puzzle, b, c, d.mode);
    d.last = i;
    if (b !== boardRef.current) setBoard(b);
  };

  const endDrag = (e: PointerEvent<HTMLDivElement>, cancelled: boolean) => {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    drag.current = null;
    let b = boardRef.current;
    if (!d.moved && !cancelled) {
      if (d.startVal === CROSS) b = setCell(puzzle, b, d.start, QUEEN, autoX);
      else if (d.startVal === QUEEN) b = setCell(puzzle, b, d.start, EMPTY, autoX);
    }
    commit(d.before, b);
  };

  const act = (i: number, value: number) => {
    const before = boardRef.current;
    commit(before, setCell(puzzle, before, i, value, autoX));
  };

  const undo = () => {
    if (locked || !history.length) return;
    setBoard(history[history.length - 1]);
    setHistory(history.slice(0, -1));
    setHint(null);
  };

  const clear = () => {
    if (locked) return;
    const before = boardRef.current;
    if (isEmptyBoard(before)) return;
    commit(before, emptyBoard(n));
  };

  const showHint = () => {
    if (locked) return;
    const h = getHint(puzzle, solver, boardRef.current.cells);
    if (!h) return;
    setHint(h);
    onHint();
  };

  const applyHint = () => {
    if (!hint || locked) return;
    const before = boardRef.current;
    let b = before;
    for (const t of hint.targets) {
      b = setCell(puzzle, b, t, hint.action === 'cross' ? CROSS : hint.action === 'queen' ? QUEEN : EMPTY, autoX);
    }
    if (b === before) setHint(null);
    else commit(before, b);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (locked) return;
    const r = Math.floor(cursor / n);
    const c = cursor % n;
    let next = -1;
    switch (e.key) {
      case 'ArrowUp':
        next = Math.max(0, r - 1) * n + c;
        break;
      case 'ArrowDown':
        next = Math.min(n - 1, r + 1) * n + c;
        break;
      case 'ArrowLeft':
        next = r * n + Math.max(0, c - 1);
        break;
      case 'ArrowRight':
        next = r * n + Math.min(n - 1, c + 1);
        break;
      case ' ':
      case 'Enter':
        e.preventDefault();
        setShowCursor(true);
        act(cursor, nextValue(boardRef.current.cells[cursor]));
        return;
      case 'Backspace':
      case 'Delete':
        e.preventDefault();
        setShowCursor(true);
        act(cursor, EMPTY);
        return;
      case 'z':
      case 'Z':
        if (e.metaKey || e.ctrlKey) {
          e.preventDefault();
          undo();
        }
        return;
      default:
        return;
    }
    e.preventDefault();
    setShowCursor(true);
    setCursor(next);
  };

  // ---------- derived view data ----------
  const lines = useMemo(() => {
    let thin = '';
    let thick = '';
    for (let r = 0; r < n; r++) {
      for (let c = 0; c < n; c++) {
        const g = puzzle.regions[r * n + c];
        if (c < n - 1) {
          const seg = `M${c + 1} ${r}V${r + 1}`;
          if (puzzle.regions[r * n + c + 1] !== g) thick += seg;
          else thin += seg;
        }
        if (r < n - 1) {
          const seg = `M${c} ${r + 1}H${c + 1}`;
          if (puzzle.regions[(r + 1) * n + c] !== g) thick += seg;
          else thin += seg;
        }
      }
    }
    return { thin, thick };
  }, [puzzle, n]);

  const clashes = useMemo(() => findClashes(n, puzzle.regions, queensOf(board)), [board, n, puzzle]);
  const hintTargets = useMemo(() => new Set(hint?.targets ?? []), [hint]);
  const hintFocus = useMemo(() => new Set([...(hint?.focus ?? []), ...(hint?.targets ?? [])]), [hint]);
  const mistake = hint?.kind === 'wrong-queen' || hint?.kind === 'wrong-cross';
  const applyLabel = !hint ? '' : hint.action === 'cross' ? 'Place ✕' : hint.action === 'queen' ? 'Place queen' : 'Remove it';

  return (
    <div className={styles.wrap} ref={wrapRef}>
      <div
        className={`${styles.frame}${won ? ` ${styles.won}` : ''}`}
        style={nudge[0] || nudge[1] ? { position: 'relative', left: nudge[0], top: nudge[1] } : undefined}
      >
        <div
          ref={gridRef}
          className={styles.grid}
          style={{
            gridTemplateColumns: `repeat(${n}, minmax(0, 1fr))`,
            gridTemplateRows: `repeat(${n}, minmax(0, 1fr))`,
            ...(boardPx ? { width: boardPx, height: boardPx } : null),
          }}
          role="grid"
          aria-label={`Queens ${n} by ${n} board`}
          tabIndex={0}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={(e) => endDrag(e, false)}
          onPointerCancel={(e) => endDrag(e, true)}
          onLostPointerCapture={(e) => endDrag(e, true)}
          onContextMenu={(e) => e.preventDefault()}
          onKeyDown={onKeyDown}
          onBlur={() => setShowCursor(false)}
        >
          {board.cells.map((v, i) => {
            const r = Math.floor(i / n);
            const c = i % n;
            const g = puzzle.regions[i];
            const clashQueen = showClashes && v === QUEEN && clashes.queens.has(i);
            const striped = showClashes && clashes.cells.has(i);
            const isTarget = hintTargets.has(i);
            const dim = hint !== null && !hintFocus.has(i);
            const ghost = isTarget && hint && !mistake ? hint.action : null;
            return (
              <div
                key={i}
                role="gridcell"
                aria-label={`Row ${r + 1}, column ${c + 1}, ${REGION_NAMES[g]}${v === QUEEN ? ', queen' : v === CROSS ? ', crossed out' : ''}`}
                className={`${styles.cell} ${styles[`r${g}`]}`}
                style={{ '--d': `${(r + c) * WAVE_STEP_MS}ms` } as CSSProperties}
              >
                {striped && <span className={styles.stripe} />}
                {v === CROSS && <Cross className={styles.x} />}
                {v === QUEEN && <Crown className={`${styles.queen}${clashQueen ? ` ${styles.clash}` : ''}`} />}
                {ghost === 'queen' && v !== QUEEN && <Crown className={styles.ghostQueen} />}
                {ghost === 'cross' && v === EMPTY && <Cross className={styles.ghostX} />}
                {dim && <span className={styles.dim} />}
                {isTarget && <span className={`${styles.ring}${mistake ? ` ${styles.ringBad}` : ''}`} />}
                {showCursor && cursor === i && <span className={styles.cursor} />}
              </div>
            );
          })}
          <svg className={styles.lines} viewBox={`0 0 ${n} ${n}`} preserveAspectRatio="none" aria-hidden>
            <path d={lines.thin} className={styles.thin} />
            <path d={lines.thick} className={styles.thick} />
          </svg>
        </div>
      </div>

      <ControlBar>
        <ControlButton icon={<Undo size={18} />} label="Undo" onClick={undo} disabled={locked || history.length === 0} />
        <ControlButton icon={<Bulb size={18} />} label="Hint" onClick={showHint} disabled={locked} />
        <ControlButton icon={<Eraser size={18} />} label="Clear" onClick={clear} disabled={locked || isEmptyBoard(board)} />
      </ControlBar>

      {hint && !won && (
        <HintBubble onDismiss={() => setHint(null)}>
          <span>{hint.message}</span>{' '}
          <button type="button" className={styles.apply} onClick={applyHint}>
            {applyLabel}
          </button>
        </HintBubble>
      )}
    </div>
  );
}
