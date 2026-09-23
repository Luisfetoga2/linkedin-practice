import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from 'react';
import type { GameProps } from '../../core/types';
import { ControlBar, ControlButton, HintBubble } from '../../core/components/Controls';
import { Bulb, Eraser, Undo } from '../../core/components/Icons';
import { useGameSetting } from '../../lib/settings';
import { colOf, generateNonogram, hintFor, isSolved, rowOf, runsOf, sameRuns, type NonogramHint } from './logic';
import { PICTURES } from './pictures';
import { STR, hintMessage, pictureName } from './i18n';
import styles from './Game.module.css';

const EMPTY = 0;
const FILL = 1;
const CROSS = 2;
type Board = Uint8Array;

interface Drag {
  pointerId: number;
  start: number;
  action: typeof FILL | typeof CROSS;
  erase: boolean;
  axis: 'row' | 'col' | null;
  before: Board;
  moved: boolean;
}

/** Paint the straight segment from `start` toward `cell` onto a copy of `before`. */
function paintSegment(before: Board, n: number, d: Drag, cell: number): Board {
  const sr = Math.floor(d.start / n);
  const sc = d.start % n;
  const r = Math.floor(cell / n);
  const c = cell % n;
  let axis = d.axis;
  if (!axis && cell !== d.start) axis = r === sr ? 'row' : c === sc ? 'col' : Math.abs(r - sr) > Math.abs(c - sc) ? 'col' : 'row';
  const cells: number[] = [];
  if (axis === 'row') for (let x = Math.min(sc, c); x <= Math.max(sc, c); x++) cells.push(sr * n + x);
  else if (axis === 'col') for (let y = Math.min(sr, r); y <= Math.max(sr, r); y++) cells.push(y * n + sc);
  else cells.push(d.start);
  d.axis = axis;
  const out = before.slice();
  for (const i of cells) {
    if (d.erase) {
      if (before[i] === d.action) out[i] = EMPTY;
    } else if (before[i] === EMPTY) out[i] = d.action;
  }
  return out;
}

/** Cross out the leftover squares of every line whose filled runs already match its clue. */
function autoCrossLines(board: Board, n: number, rows: number[][], cols: number[][]): Board {
  let out: Board | null = null;
  const put = (i: number) => {
    if (board[i] !== EMPTY) return;
    out ??= board.slice();
    out[i] = CROSS;
  };
  for (let r = 0; r < n; r++) {
    if (sameRuns(runsOf(rowOf(board, n, r)), rows[r])) for (let c = 0; c < n; c++) put(r * n + c);
  }
  for (let c = 0; c < n; c++) {
    if (sameRuns(runsOf(colOf(board, n, c)), cols[c])) for (let r = 0; r < n; r++) put(r * n + c);
  }
  return out ?? board;
}

export default function Game({ seed, lang, options, paused, onReady, onHint, onComplete }: GameProps) {
  const t = STR[lang];
  const n = [5, 10, 15].includes(Number(options.size)) ? Number(options.size) : 10;
  const puzzle = useMemo(() => generateNonogram(n, seed, PICTURES[n]), [n, seed]);
  const picName = useMemo(() => pictureName(puzzle, lang), [puzzle, lang]);
  const [autoCross] = useGameSetting<boolean>('nonogram', 'autoCross', false);
  const [showMistakes] = useGameSetting<boolean>('nonogram', 'showMistakes', false);

  const [board, setBoardState] = useState<Board>(() => new Uint8Array(n * n));
  const boardRef = useRef(board);
  const setBoard = (b: Board) => {
    boardRef.current = b;
    setBoardState(b);
  };
  const [history, setHistory] = useState<Board[]>([]);
  const [mode, setMode] = useState<typeof FILL | typeof CROSS>(FILL);
  const [hint, setHint] = useState<NonogramHint | null>(null);
  const [won, setWon] = useState(false);
  const [focus, setFocus] = useState<number | null>(null);
  const drag = useRef<Drag | null>(null);
  const cellsRef = useRef<HTMLDivElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const cb = useRef({ onReady, onHint, onComplete });
  cb.current = { onReady, onHint, onComplete };
  const locked = paused || won;

  useEffect(() => {
    cb.current.onReady();
  }, []);

  // ---------- Layout: whole-pixel cells sized to fit clues + grid in the available width ----------
  const maxRowClues = Math.max(1, ...puzzle.rows.map((r) => r.length));
  const maxColClues = Math.max(1, ...puzzle.cols.map((c) => c.length));
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
  const layout = useMemo(() => {
    let cell = Math.floor(width / (n + maxRowClues * 0.55));
    let font = 0;
    let clueW = 0;
    for (let i = 0; i < 3; i++) {
      font = Math.max(9, Math.min(15, Math.round(cell * 0.5)));
      clueW = Math.ceil(maxRowClues * (font * 0.72 + 4) + 8);
      cell = Math.max(14, Math.min(44, Math.floor((width - clueW - 4) / n)));
    }
    const clueH = Math.ceil(maxColClues * (font * 1.2) + 8);
    return { cell, font, clueW, clueH };
  }, [width, n, maxRowClues, maxColClues]);

  // ---------- Derived ----------
  const rowDone = useMemo(() => puzzle.rows.map((clue, r) => sameRuns(runsOf(rowOf(board, n, r)), clue)), [board, puzzle, n]);
  const colDone = useMemo(() => puzzle.cols.map((clue, c) => sameRuns(runsOf(colOf(board, n, c)), clue)), [board, puzzle, n]);

  useEffect(() => {
    if (won || !isSolved(puzzle, board)) return;
    setWon(true);
    setHint(null);
    drag.current = null;
    cb.current.onComplete({
      won: true,
      share: `🖼️ Nonogram ${n}×${n}`,
      summary: picName ? (
        <>
          {t.itWas.pre}
          {picName.article} <strong>{picName.noun}</strong>
          {t.itWas.post}
        </>
      ) : undefined,
    });
  }, [board, puzzle, n, won, picName, t]);

  const commit = (before: Board, after: Board) => {
    const final = autoCross ? autoCrossLines(after, n, puzzle.rows, puzzle.cols) : after;
    if (final.every((v, i) => v === before[i])) {
      setBoard(before);
      return;
    }
    setHistory((h) => [...h, before]);
    setBoard(final);
  };

  // ---------- Pointer ----------
  const cellAt = (x: number, y: number, clamp: boolean): number => {
    const el = cellsRef.current;
    if (!el) return -1;
    const b = el.getBoundingClientRect();
    let c = Math.floor(((x - b.left) / b.width) * n);
    let r = Math.floor(((y - b.top) / b.height) * n);
    if (!clamp && (c < 0 || r < 0 || c >= n || r >= n)) return -1;
    c = Math.max(0, Math.min(n - 1, c));
    r = Math.max(0, Math.min(n - 1, r));
    return r * n + c;
  };

  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (locked || drag.current) return;
    if (e.pointerType === 'mouse' && e.button !== 0 && e.button !== 2) return;
    const cell = cellAt(e.clientX, e.clientY, false);
    if (cell < 0) return;
    e.preventDefault();
    setHint(null);
    setFocus(cell);
    const action = e.button === 2 ? CROSS : mode;
    const before = boardRef.current;
    const d: Drag = { pointerId: e.pointerId, start: cell, action, erase: before[cell] === action, axis: null, before, moved: false };
    drag.current = d;
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // ignore
    }
    setBoard(paintSegment(before, n, d, cell));
  };

  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d || d.pointerId !== e.pointerId) return;
    const cell = cellAt(e.clientX, e.clientY, true);
    if (cell !== d.start) d.moved = true;
    setFocus(cell);
    setBoard(paintSegment(d.before, n, d, cell));
  };

  const endDrag = (e: ReactPointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d || d.pointerId !== e.pointerId) return;
    drag.current = null;
    commit(d.before, boardRef.current);
  };

  // ---------- Controls ----------
  const undo = () => {
    if (locked || !history.length) return;
    setBoard(history[history.length - 1]);
    setHistory((h) => h.slice(0, -1));
    setHint(null);
  };

  const clear = () => {
    if (locked || boardRef.current.every((v) => v === EMPTY)) return;
    commit(boardRef.current, new Uint8Array(n * n));
    setHint(null);
  };

  const giveHint = () => {
    if (locked) return;
    const h = hintFor(puzzle, boardRef.current);
    if (!h) return;
    cb.current.onHint();
    setHint(h);
    setFocus(h.cell);
    if (h.kind !== 'mistake') {
      const before = boardRef.current;
      const next = before.slice();
      next[h.cell] = h.value === 1 ? FILL : CROSS;
      commit(before, next);
    }
  };

  // Keyboard: arrows move, Space/Enter fill, X cross, Cmd/Ctrl+Z undo.
  const live = useRef({ undo, focus, locked, mode });
  live.current = { undo, focus, locked, mode };
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const s = live.current;
      if (s.locked || document.querySelector('.lp-modal-backdrop')) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA')) return;
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        s.undo();
        return;
      }
      const moves: Record<string, [number, number]> = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] };
      const cur = s.focus ?? 0;
      if (moves[e.key]) {
        e.preventDefault();
        const r = Math.max(0, Math.min(n - 1, Math.floor(cur / n) + moves[e.key][0]));
        const c = Math.max(0, Math.min(n - 1, (cur % n) + moves[e.key][1]));
        setFocus(r * n + c);
        return;
      }
      const action = e.key === ' ' || e.key === 'Enter' || e.key.toLowerCase() === 'f' ? FILL : e.key.toLowerCase() === 'x' ? CROSS : null;
      if (action === null || s.focus === null) return;
      e.preventDefault();
      const before = boardRef.current;
      const next = before.slice();
      next[cur] = before[cur] === action ? EMPTY : action;
      setHint(null);
      commit(before, next);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [n]);

  // ---------- Render ----------
  const { cell, font, clueW, clueH } = layout;
  const gridPx = cell * n;
  const focusRow = focus === null ? -1 : Math.floor(focus / n);
  const focusCol = focus === null ? -1 : focus % n;
  const hintLine = hint?.line;
  const lines = useMemo(() => {
    const out: { pos: number; thick: boolean }[] = [];
    for (let i = 1; i < n; i++) out.push({ pos: i, thick: i % 5 === 0 });
    return out;
  }, [n]);

  return (
    <div className={styles.wrap} ref={wrapRef}>
      <div
        className={`${styles.board}${won ? ` ${styles.won}` : ''}`}
        style={
          {
            gridTemplateColumns: `${clueW}px ${gridPx}px`,
            gridTemplateRows: `${clueH}px ${gridPx}px`,
            '--cell': `${cell}px`,
            '--clue-font': `${font}px`,
          } as CSSProperties
        }
      >
        <div className={styles.corner} />
        <div className={styles.colClues} style={{ gridTemplateColumns: `repeat(${n}, ${cell}px)` }}>
          {puzzle.cols.map((clue, c) => (
            <div
              key={c}
              className={[
                styles.colClue,
                colDone[c] ? styles.done : '',
                c === focusCol ? styles.active : '',
                hintLine?.kind === 'col' && hintLine.index === c ? styles.hinted : '',
              ].join(' ')}
            >
              {(clue.length ? clue : [0]).map((v, k) => (
                <span key={k}>{v}</span>
              ))}
            </div>
          ))}
        </div>
        <div className={styles.rowClues} style={{ gridTemplateRows: `repeat(${n}, ${cell}px)` }}>
          {puzzle.rows.map((clue, r) => (
            <div
              key={r}
              className={[
                styles.rowClue,
                rowDone[r] ? styles.done : '',
                r === focusRow ? styles.active : '',
                hintLine?.kind === 'row' && hintLine.index === r ? styles.hinted : '',
              ].join(' ')}
            >
              {(clue.length ? clue : [0]).map((v, k) => (
                <span key={k}>{v}</span>
              ))}
            </div>
          ))}
        </div>
        <div
          ref={cellsRef}
          className={styles.cells}
          style={{ gridTemplateColumns: `repeat(${n}, ${cell}px)`, gridTemplateRows: `repeat(${n}, ${cell}px)` }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
          onContextMenu={(e) => e.preventDefault()}
          onPointerLeave={() => !drag.current && setFocus(null)}
          role="grid"
          aria-label={t.gridLabel(n)}
        >
          {Array.from(board, (v, i) => {
            const r = Math.floor(i / n);
            const c = i % n;
            const wrong = showMistakes && v === FILL && !puzzle.solution[i];
            const cls = [
              styles.cell,
              v === FILL ? styles.filled : '',
              v === CROSS ? styles.crossed : '',
              wrong ? styles.wrong : '',
              r === focusRow || c === focusCol ? styles.cross : '',
              hint?.cell === i ? (hint.kind === 'mistake' ? styles.hintBad : styles.hintCell) : '',
            ].join(' ');
            return (
              <div
                key={i}
                role="gridcell"
                aria-label={t.cellLabel(r + 1, c + 1, v === FILL ? 'filled' : v === CROSS ? 'crossed' : 'empty')}
                className={cls}
                style={{ '--d': `${(r + c) * 22}ms` } as CSSProperties}
              >
                {v === CROSS && (
                  <svg viewBox="0 0 10 10" className={styles.x} aria-hidden>
                    <path d="M2.5 2.5l5 5M7.5 2.5l-5 5" />
                  </svg>
                )}
              </div>
            );
          })}
          <svg className={styles.lines} width={gridPx} height={gridPx} aria-hidden>
            {lines.map(({ pos, thick }) => (
              <g key={pos} className={thick ? styles.thick : styles.thin}>
                <line x1={pos * cell} y1={0} x2={pos * cell} y2={gridPx} />
                <line x1={0} y1={pos * cell} x2={gridPx} y2={pos * cell} />
              </g>
            ))}
          </svg>
        </div>
      </div>

      {won && picName && (
        <p className={styles.reveal}>
          {t.itIs.pre}
          {picName.article} <strong>{picName.noun}</strong>
          {t.itIs.post}
        </p>
      )}
      {hint && !won && <HintBubble onDismiss={() => setHint(null)}>{hintMessage(t, hint)}</HintBubble>}

      <ControlBar>
        <div className={styles.modes} role="radiogroup" aria-label={t.tapMode}>
          <button type="button" role="radio" aria-checked={mode === FILL} className={mode === FILL ? styles.modeOn : ''} onClick={() => setMode(FILL)} disabled={locked}>
            <span className={styles.modeFill} /> {t.fill}
          </button>
          <button type="button" role="radio" aria-checked={mode === CROSS} className={mode === CROSS ? styles.modeOn : ''} onClick={() => setMode(CROSS)} disabled={locked}>
            <span className={styles.modeCross}>✕</span> {t.cross}
          </button>
        </div>
      </ControlBar>
      <ControlBar>
        <ControlButton icon={<Undo size={18} />} label={t.undo} onClick={undo} disabled={locked || history.length === 0} />
        <ControlButton icon={<Bulb size={18} />} label={t.hint} onClick={giveHint} disabled={locked} />
        <ControlButton icon={<Eraser size={18} />} label={t.clear} onClick={clear} disabled={locked || board.every((v) => v === EMPTY)} />
      </ControlBar>
    </div>
  );
}
