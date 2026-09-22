import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import type { GameProps } from '../../core/types';
import { ControlBar, ControlButton, HintBubble } from '../../core/components/Controls';
import { Bulb, Eraser, Undo } from '../../core/components/Icons';
import { toast } from '../../core/components/Toast';
import { DOWN, LEFT, RIGHT, UP, buildAdjacency, generateZip, step, type ZipPuzzle } from './generator';
import styles from './Game.module.css';

const U = 100; // SVG units per cell
const HINT_STEP_MS = 90;

function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function mix(a: string, b: string, t: number): string {
  const x = hexToRgb(a);
  const y = hexToRgb(b);
  const c = x.map((v, i) => Math.round(v + (y[i] - v) * t));
  return `rgb(${c[0]}, ${c[1]}, ${c[2]})`;
}

/** Generates small boards synchronously and 8×8 in a worker. */
function usePuzzle(size: number, seed: number): ZipPuzzle | null {
  const [puzzle, setPuzzle] = useState<ZipPuzzle | null>(() => (size < 8 ? generateZip(size, seed) : null));
  useEffect(() => {
    if (puzzle) return;
    let worker: Worker | null = null;
    let done = false;
    const finish = (p: ZipPuzzle) => {
      if (done) return;
      done = true;
      setPuzzle(p);
    };
    try {
      worker = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' });
      worker.onmessage = (e: MessageEvent<ZipPuzzle>) => finish(e.data);
      worker.onerror = () => finish(generateZip(size, seed));
      worker.postMessage({ size, seed });
    } catch {
      finish(generateZip(size, seed));
    }
    return () => {
      done = true;
      worker?.terminate();
    };
  }, [puzzle, size, seed]);
  return puzzle;
}

export default function Game(props: GameProps) {
  const size = Math.min(8, Math.max(5, parseInt(props.options.size, 10) || 7));
  const puzzle = usePuzzle(size, props.seed);
  if (!puzzle) {
    return (
      <div className={styles.wrap}>
        <div className={`${styles.board} ${styles.loading}`}>Generating…</div>
      </div>
    );
  }
  return <ZipBoard puzzle={puzzle} {...props} />;
}

interface Hint {
  text: string;
}

function ZipBoard({ puzzle, paused, onReady, onHint, onComplete }: GameProps & { puzzle: ZipPuzzle }) {
  const { size, numbers, count, walls, solution, palette } = puzzle;
  const total = size * size;
  const adj = useMemo(() => buildAdjacency(size, walls), [size, walls]);
  const startCell = useMemo(() => numbers.indexOf(1), [numbers]);

  const [path, setPathState] = useState<number[]>([]);
  const pathRef = useRef<number[]>([]);
  const [history, setHistory] = useState<number[][]>([]);
  const [hint, setHint] = useState<Hint | null>(null);
  const [animating, setAnimating] = useState(false);
  const [won, setWon] = useState(false);
  const boardRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{ pointerId: number; before: number[] } | null>(null);
  const readyRef = useRef(false);
  const completeRef = useRef(false);
  const timers = useRef<number[]>([]);

  useEffect(() => {
    if (!readyRef.current) {
      readyRef.current = true;
      onReady();
    }
  }, [onReady]);

  useEffect(() => () => timers.current.forEach((t) => window.clearTimeout(t)), []);

  const setPath = useCallback((p: number[]) => {
    pathRef.current = p;
    setPathState(p);
  }, []);

  const locked = paused || won || animating;

  const nextNumber = (p: readonly number[]) => {
    let k = 0;
    for (const c of p) if (numbers[c]) k++;
    return k + 1;
  };

  /** Whether `v` can be appended to path `p`. */
  const canExtend = (p: readonly number[], v: number): boolean => {
    if (v < 0) return false;
    if (p.length === 0) return v === startCell;
    const head = p[p.length - 1];
    if (numbers[head] === count) return false;
    if (!adj[head].includes(v) || p.includes(v)) return false;
    const n = numbers[v];
    return !n || n === nextNumber(p);
  };

  /** One step onto cell v: retract if it is the previous cell, extend if legal. Returns new path or null. */
  const stepTo = (p: number[], v: number): number[] | null => {
    if (p.length >= 2 && p[p.length - 2] === v) return p.slice(0, -1);
    if (canExtend(p, v)) return [...p, v];
    return null;
  };

  /** Walks from the head toward `target` one cell at a time, stopping at the first illegal step. */
  const walkToward = (p: number[], target: number): number[] => {
    let cur = p;
    const tr = Math.floor(target / size);
    const tc = target % size;
    for (let guard = 0; guard < total * 2; guard++) {
      const head = cur[cur.length - 1];
      if (head === target) break;
      const hr = Math.floor(head / size);
      const hc = head % size;
      const dr = tr - hr;
      const dc = tc - hc;
      const vert = dr !== 0 ? head + Math.sign(dr) * size : -1;
      const horiz = dc !== 0 ? head + Math.sign(dc) : -1;
      const order = Math.abs(dr) >= Math.abs(dc) ? [vert, horiz] : [horiz, vert];
      let moved: number[] | null = null;
      for (const v of order) {
        if (v < 0) continue;
        moved = stepTo(cur, v);
        if (moved) break;
      }
      if (!moved) break;
      cur = moved;
    }
    return cur;
  };

  const cellFromPoint = (x: number, y: number): number => {
    const el = boardRef.current;
    if (!el) return -1;
    const r = el.getBoundingClientRect();
    const cw = r.width / size;
    const fx = (x - r.left) / cw;
    const fy = (y - r.top) / cw;
    if (fx < -0.4 || fy < -0.4 || fx > size + 0.4 || fy > size + 0.4) return -1;
    const c = Math.min(size - 1, Math.max(0, Math.floor(fx)));
    const rr = Math.min(size - 1, Math.max(0, Math.floor(fy)));
    return rr * size + c;
  };

  const commit = (before: number[], after: number[]) => {
    if (before.length === after.length && before.every((c, i) => c === after[i])) return;
    setHistory((h) => [...h, before]);
  };

  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (locked || drag.current) return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    const cell = cellFromPoint(e.clientX, e.clientY);
    if (cell < 0) return;
    const p = pathRef.current;
    let next: number[] | null = null;
    const at = p.indexOf(cell);
    if (at >= 0) next = p.slice(0, at + 1);
    else if (cell === startCell) next = [cell];
    else if (canExtend(p, cell)) next = [...p, cell];
    if (!next) return;
    e.preventDefault();
    setHint(null);
    drag.current = { pointerId: e.pointerId, before: p };
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // ignore (synthetic events)
    }
    setPath(next);
  };

  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d || d.pointerId !== e.pointerId || locked) return;
    const cell = cellFromPoint(e.clientX, e.clientY);
    const p = pathRef.current;
    if (cell < 0 || p.length === 0 || cell === p[p.length - 1]) return;
    const next = walkToward(p, cell);
    if (next !== p) setPath(next);
  };

  const endDrag = (e: ReactPointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d || d.pointerId !== e.pointerId) return;
    drag.current = null;
    commit(d.before, pathRef.current);
  };

  // Keyboard: arrows extend/retract, Backspace retracts.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (locked || e.metaKey || e.ctrlKey || e.altKey) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
      const dirs: Record<string, number> = { ArrowUp: UP, ArrowDown: DOWN, ArrowLeft: LEFT, ArrowRight: RIGHT };
      const p = pathRef.current;
      let next: number[] | null = null;
      if (e.key in dirs) {
        e.preventDefault();
        if (p.length === 0) next = [startCell];
        else next = stepTo(p, step(size, p[p.length - 1], dirs[e.key]));
      } else if (e.key === 'Backspace') {
        e.preventDefault();
        if (p.length) next = p.slice(0, -1);
      }
      if (next) {
        setHint(null);
        commit(p, next);
        setPath(next);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  // Win detection + "finish on the last number" nudge.
  useEffect(() => {
    if (path.length === total && !completeRef.current) {
      completeRef.current = true;
      setWon(true);
      setHint(null);
      onComplete({ won: true, share: `〰️ Zip ${size}×${size}` });
    } else if (path.length > 0 && path.length < total && numbers[path[path.length - 1]] === count && !animating) {
      toast('Fill every cell before reaching the last number');
    }
  }, [path, total, size, numbers, count, animating, onComplete]);

  const undo = () => {
    if (locked || !history.length) return;
    setHint(null);
    setPath(history[history.length - 1]);
    setHistory((h) => h.slice(0, -1));
  };

  const clear = () => {
    if (locked || !pathRef.current.length) return;
    setHint(null);
    commit(pathRef.current, []);
    setPath([]);
  };

  const giveHint = () => {
    if (locked) return;
    const p = pathRef.current;
    let k = 0;
    while (k < p.length && p[k] === solution[k]) k++;
    const trimmed = k < p.length;
    // Like LinkedIn: reveal only the next correct move (from 1 when the path is empty).
    const end = Math.min(total - 1, Math.max(k, 1));
    const base = solution.slice(0, k);
    commit(p, solution.slice(0, end + 1));
    setPath(base);
    onHint();
    setHint({
      text: trimmed
        ? 'Your path took a wrong turn, so it was trimmed back to the last correct cell. Here’s the next move.'
        : 'Here’s the next move.',
    });
    setAnimating(true);
    for (let i = k; i <= end; i++) {
      const t = window.setTimeout(
        () => {
          setPath(solution.slice(0, i + 1));
          if (i === end) setAnimating(false);
        },
        (i - k + 1) * HINT_STEP_MS,
      );
      timers.current.push(t);
    }
  };

  // ---------- Rendering ----------
  const colorAt = (i: number) => mix(palette[0], palette[1], total > 1 ? i / (total - 1) : 0);
  const center = (cell: number) => [(cell % size) * U + U / 2, Math.floor(cell / size) * U + U / 2];

  const wallLines = useMemo(() => {
    const out: { x1: number; y1: number; x2: number; y2: number; key: string }[] = [];
    for (let cell = 0; cell < total; cell++) {
      const r = Math.floor(cell / size);
      const c = cell % size;
      if (walls[cell] & RIGHT && c < size - 1) out.push({ x1: (c + 1) * U, y1: r * U, x2: (c + 1) * U, y2: (r + 1) * U, key: `r${cell}` });
      if (walls[cell] & DOWN && r < size - 1) out.push({ x1: c * U, y1: (r + 1) * U, x2: (c + 1) * U, y2: (r + 1) * U, key: `d${cell}` });
    }
    return out;
  }, [walls, size, total]);

  const gridLines = useMemo(() => {
    const out: string[] = [];
    for (let i = 1; i < size; i++) {
      out.push(`M${i * U} 0V${size * U}`);
      out.push(`M0 ${i * U}H${size * U}`);
    }
    return out.join('');
  }, [size]);

  const head = path.length ? path[path.length - 1] : -1;
  const vb = size * U;

  return (
    <div className={styles.wrap}>
      <div
        ref={boardRef}
        className={`${styles.board}${won ? ` ${styles.won}` : ''}`}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onLostPointerCapture={endDrag}
        role="application"
        aria-label={`Zip board, ${size} by ${size}. Path covers ${path.length} of ${total} cells.`}
      >
        <svg className={styles.svg} viewBox={`0 0 ${vb} ${vb}`} aria-hidden>
          <g className={styles.tints}>
            {path.map((cell, i) => {
              const [x, y] = center(cell);
              return (
                <rect
                  key={cell}
                  x={x - U / 2}
                  y={y - U / 2}
                  width={U}
                  height={U}
                  fill={colorAt(i)}
                  className={styles.tint}
                  style={won ? { animationDelay: `${i * 18}ms` } : undefined}
                />
              );
            })}
          </g>
          <path d={gridLines} className={styles.grid} />
          <g className={styles.path}>
            {path.slice(1).map((cell, i) => {
              const [x1, y1] = center(path[i]);
              const [x2, y2] = center(cell);
              return (
                <line
                  key={`${path[i]}-${cell}`}
                  x1={x1}
                  y1={y1}
                  x2={x2}
                  y2={y2}
                  stroke={colorAt(i + 0.5)}
                  className={styles.seg}
                  style={won ? { animationDelay: `${i * 18}ms` } : undefined}
                />
              );
            })}
            {path.length === 1 && <circle cx={center(path[0])[0]} cy={center(path[0])[1]} r={U * 0.22} fill={colorAt(0)} />}
          </g>
          {wallLines.map((w) => (
            <line key={w.key} x1={w.x1} y1={w.y1} x2={w.x2} y2={w.y2} className={styles.wall} />
          ))}
          {numbers.map((n, cell) => {
            if (!n) return null;
            const [x, y] = center(cell);
            return (
              <g key={cell} className={styles.dot}>
                <circle cx={x} cy={y} r={U * 0.3} className={styles.dotBg} />
                <text x={x} y={y} className={styles.dotText} dominantBaseline="central" textAnchor="middle">
                  {n}
                </text>
              </g>
            );
          })}
          {head >= 0 && !won && numbers[head] === 0 && (
            <circle cx={center(head)[0]} cy={center(head)[1]} r={U * 0.12} className={styles.head} />
          )}
        </svg>
      </div>
      {hint && <HintBubble onDismiss={() => setHint(null)}>{hint.text}</HintBubble>}
      <ControlBar>
        <ControlButton icon={<Undo size={18} />} label="Undo" onClick={undo} disabled={locked || history.length === 0} />
        <ControlButton icon={<Bulb size={18} />} label="Hint" onClick={giveHint} disabled={locked} />
        <ControlButton icon={<Eraser size={18} />} label="Clear" onClick={clear} disabled={locked || path.length === 0} />
      </ControlBar>
    </div>
  );
}
