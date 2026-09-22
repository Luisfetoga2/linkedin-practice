import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import type { GameProps } from '../../core/types';
import { ControlBar, ControlButton, HintBubble } from '../../core/components/Controls';
import { Bulb, Eraser, Undo } from '../../core/components/Icons';
import { toast } from '../../core/components/Toast';
import { DOWN, LEFT, RIGHT, UP, buildAdjacency, generateZip, step, type ZipPuzzle } from './generator';
import { EMPTY_LINE, lineFor, lineGeometry, sameLine, stepLine, tipTarget, type LineState } from './lineAnim';
import styles from './Game.module.css';

const U = 100; // SVG units per cell
const SVG_NS = 'http://www.w3.org/2000/svg';
const TIP_ARM_RADIUS = 0.3; // cell units from the head centre

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

const prefersReducedMotion = () =>
  typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

function ZipBoard({ puzzle, paused, onReady, onHint, onComplete }: GameProps & { puzzle: ZipPuzzle }) {
  const { size, numbers, count, walls, solution, palette } = puzzle;
  const total = size * size;
  const adj = useMemo(() => buildAdjacency(size, walls), [size, walls]);
  const startCell = useMemo(() => numbers.indexOf(1), [numbers]);
  const gradId = useId().replace(/:/g, '');

  const [path, setPathState] = useState<number[]>([]);
  const pathRef = useRef<number[]>([]);
  const [history, setHistory] = useState<number[][]>([]);
  const [hint, setHint] = useState<Hint | null>(null);
  const [won, setWon] = useState(false);
  const boardRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{ pointerId: number; before: number[] } | null>(null);
  const pointer = useRef<{ fx: number; fy: number } | null>(null);
  /** The live tip re-arms once the pointer nears the head's centre, so entering a cell snaps to it. */
  const tipArmed = useRef(false);
  const readyRef = useRef(false);
  const completeRef = useRef(false);

  // Animated line: `display` chases `target` in a requestAnimationFrame loop that only touches the SVG
  // elements below (no React re-render per frame).
  const displayRef = useRef<LineState>(EMPTY_LINE);
  const targetRef = useRef<LineState>(EMPTY_LINE);
  const rafRef = useRef(0);
  const lastTsRef = useRef(-1);
  const tintsRef = useRef<SVGGElement>(null);
  const defsRef = useRef<SVGDefsElement>(null);
  const segsRef = useRef<SVGGElement>(null);
  const startDotRef = useRef<SVGCircleElement>(null);
  const headRef = useRef<SVGCircleElement>(null);
  const drawRef = useRef<(line: LineState) => void>(() => {});

  useEffect(() => {
    if (!readyRef.current) {
      readyRef.current = true;
      onReady();
    }
  }, [onReady]);

  useEffect(() => () => cancelAnimationFrame(rafRef.current), []);

  const locked = paused || won;

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

  const tick = (ts: number) => {
    const dt = lastTsRef.current < 0 ? 16 : ts - lastTsRef.current;
    lastTsRef.current = ts;
    const next = stepLine(displayRef.current, targetRef.current, dt);
    displayRef.current = next;
    drawRef.current(next);
    if (sameLine(next, targetRef.current)) rafRef.current = 0;
    else rafRef.current = requestAnimationFrame(tick);
  };

  /** Recomputes where the line should be (committed path + live drag tip) and starts animating. */
  const retarget = () => {
    const p = pathRef.current;
    let t = lineFor(p);
    const pt = pointer.current;
    if (drag.current && pt && !locked && p.length) {
      const head = p[p.length - 1];
      const off = Math.max(Math.abs(pt.fx - ((head % size) + 0.5)), Math.abs(pt.fy - (Math.floor(head / size) + 0.5)));
      if (off < TIP_ARM_RADIUS) tipArmed.current = true;
    }
    if (drag.current && pt && !locked && tipArmed.current) {
      t = tipTarget(
        p,
        size,
        pt.fx,
        pt.fy,
        (cell, dx, dy) => step(size, cell, dx > 0 ? RIGHT : dx < 0 ? LEFT : dy > 0 ? DOWN : UP),
        (v) => canExtend(p, v),
      ).line;
    }
    if (sameLine(t, targetRef.current)) return;
    targetRef.current = t;
    if (prefersReducedMotion()) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = 0;
      displayRef.current = t;
      drawRef.current(t);
      return;
    }
    if (!rafRef.current) {
      lastTsRef.current = -1;
      rafRef.current = requestAnimationFrame(tick);
    }
  };

  const setPath = (p: number[]) => {
    if (drag.current && p[p.length - 1] !== pathRef.current[pathRef.current.length - 1]) tipArmed.current = false;
    pathRef.current = p;
    setPathState(p);
    retarget();
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

  /** Pointer position in cell units (0..size across the board). */
  const toCellUnits = (x: number, y: number): { fx: number; fy: number } | null => {
    const el = boardRef.current;
    if (!el) return null;
    const r = el.getBoundingClientRect();
    const cw = r.width / size;
    return { fx: (x - r.left) / cw, fy: (y - r.top) / cw };
  };

  const cellFromPoint = (x: number, y: number): number => {
    const f = toCellUnits(x, y);
    if (!f) return -1;
    const { fx, fy } = f;
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
    pointer.current = toCellUnits(e.clientX, e.clientY);
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // ignore (synthetic events)
    }
    setPath(next);
    tipArmed.current = true;
    retarget();
  };

  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d || d.pointerId !== e.pointerId || locked) return;
    pointer.current = toCellUnits(e.clientX, e.clientY);
    const cell = cellFromPoint(e.clientX, e.clientY);
    const p = pathRef.current;
    if (cell >= 0 && p.length > 0 && cell !== p[p.length - 1]) {
      const next = walkToward(p, cell);
      if (next !== p) {
        setPath(next);
        return;
      }
    }
    retarget();
  };

  const endDrag = (e: ReactPointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d || d.pointerId !== e.pointerId) return;
    drag.current = null;
    pointer.current = null;
    commit(d.before, pathRef.current);
    retarget();
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
    } else if (path.length > 0 && path.length < total && numbers[path[path.length - 1]] === count) {
      toast('Fill every cell before reaching the last number');
    }
  }, [path, total, size, numbers, count, onComplete]);

  // Once solved, drop any live drag tip so the line settles on the finished path.
  useEffect(() => {
    if (won) retarget();
  }, [won]);

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
    // Like LinkedIn: reveal only the next correct move (from 1 when the path is empty). The line
    // animates back to the last correct cell (if needed) and then grows one cell.
    const end = Math.min(total - 1, Math.max(k, 1));
    const next = solution.slice(0, end + 1);
    commit(p, next);
    setPath(next);
    onHint();
    setHint({
      text: trimmed
        ? 'Your path took a wrong turn, so it was trimmed back to the last correct cell. Here’s the next move.'
        : 'Here’s the next move.',
    });
  };

  // ---------- Rendering ----------
  const colorAt = (i: number) => mix(palette[0], palette[1], total > 1 ? Math.min(1, i / (total - 1)) : 0);
  const center = (cell: number) => [(cell % size) * U + U / 2, Math.floor(cell / size) * U + U / 2];

  // Imperative per-frame drawing of tints + line segments (element pools, attributes only when changed).
  drawRef.current = (line: LineState) => {
    const tintsG = tintsRef.current;
    const defs = defsRef.current;
    const segsG = segsRef.current;
    const startDot = startDotRef.current;
    const headDot = headRef.current;
    if (!tintsG || !defs || !segsG || !startDot || !headDot) return;
    const geo = lineGeometry(line, size, U);
    const set = (el: Element, attr: string, v: string | number) => {
      const s = String(v);
      if (el.getAttribute(attr) !== s) el.setAttribute(attr, s);
    };
    const show = (el: SVGElement, on: boolean) => {
      const v = on ? '' : 'none';
      if (el.style.display !== v) el.style.display = v;
    };

    // Cell tints, appearing as the line crosses into each cell.
    const rects = tintsG.children;
    for (let i = 0; i < geo.reached; i++) {
      let rect = rects[i] as SVGRectElement | undefined;
      if (!rect) {
        rect = document.createElementNS(SVG_NS, 'rect');
        rect.setAttribute('class', styles.tint);
        rect.setAttribute('width', String(U));
        rect.setAttribute('height', String(U));
        rect.style.animationDelay = `${i * 18}ms`;
        tintsG.appendChild(rect);
      }
      const [x, y] = center(line.cells[i]);
      set(rect, 'x', x - U / 2);
      set(rect, 'y', y - U / 2);
      set(rect, 'fill', colorAt(i));
      show(rect, true);
    }
    for (let i = geo.reached; i < rects.length; i++) show(rects[i] as SVGRectElement, false);

    // Segments, each stroked with its own gradient so the colour runs continuously along the path.
    const lines = segsG.children;
    const grads = defs.children;
    geo.segments.forEach((sg, i) => {
      let ln = lines[i] as SVGLineElement | undefined;
      let gr = grads[i] as SVGLinearGradientElement | undefined;
      if (!gr) {
        gr = document.createElementNS(SVG_NS, 'linearGradient');
        gr.setAttribute('id', `${gradId}-${i}`);
        gr.setAttribute('gradientUnits', 'userSpaceOnUse');
        for (const off of ['0', '1']) {
          const stop = document.createElementNS(SVG_NS, 'stop');
          stop.setAttribute('offset', off);
          gr.appendChild(stop);
        }
        defs.appendChild(gr);
      }
      if (!ln) {
        ln = document.createElementNS(SVG_NS, 'line');
        ln.setAttribute('class', styles.seg);
        ln.setAttribute('stroke', `url(#${gradId}-${i})`);
        ln.style.animationDelay = `${i * 18}ms`;
        segsG.appendChild(ln);
      }
      for (const [k, v] of [
        ['x1', sg.x1],
        ['y1', sg.y1],
        ['x2', sg.x2],
        ['y2', sg.y2],
      ] as const) {
        set(ln, k, v);
        set(gr, k, v);
      }
      set(gr.children[0], 'stop-color', colorAt(sg.index));
      set(gr.children[1], 'stop-color', colorAt(sg.index + sg.frac));
      show(ln, true);
    });
    for (let i = geo.segments.length; i < lines.length; i++) show(lines[i] as SVGLineElement, false);

    // Start blob (visible for a single-cell path) and the white end marker.
    if (geo.start && geo.segments.length === 0) {
      set(startDot, 'cx', geo.start[0]);
      set(startDot, 'cy', geo.start[1]);
      set(startDot, 'fill', colorAt(0));
      show(startDot, true);
    } else show(startDot, false);
    let headVisible = !!geo.head && !won;
    if (geo.head) {
      const [hx, hy] = geo.head;
      const cell = Math.min(size - 1, Math.floor(hy / U)) * size + Math.min(size - 1, Math.floor(hx / U));
      const [cx, cy] = center(cell);
      if (numbers[cell] && Math.hypot(hx - cx, hy - cy) < U * 0.32) headVisible = false;
      set(headDot, 'cx', hx);
      set(headDot, 'cy', hy);
    }
    show(headDot, headVisible);
  };

  // Redraw after React renders (e.g. win state changes the head marker).
  useLayoutEffect(() => {
    drawRef.current(displayRef.current);
  });

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
          <defs ref={defsRef} />
          <g ref={tintsRef} className={styles.tints} />
          <path d={gridLines} className={styles.grid} />
          <g className={styles.path}>
            <g ref={segsRef} />
            <circle ref={startDotRef} r={U * 0.22} style={{ display: 'none' }} />
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
          <circle ref={headRef} r={U * 0.12} className={styles.head} style={{ display: 'none' }} />
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
