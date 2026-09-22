import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from 'react';
import type { GameProps } from '../../core/types';
import { ControlBar, ControlButton, HintBubble } from '../../core/components/Controls';
import { Bulb, Check, Eraser, Undo } from '../../core/components/Icons';
import { toast } from '../../core/components/Toast';
import { generatePuzzle, isAdjacent, isValidWord, nextHint, type FoundWord } from './generator';
import styles from './Game.module.css';

const COLOR_CLASSES = [styles.c0, styles.c1, styles.c2, styles.c3, styles.c4];
const colorOf = (w: number) => COLOR_CLASSES[w % COLOR_CLASSES.length];

interface DragState {
  id: number;
  moved: boolean;
  /** Pointer went down on the last traced tile (a tap there submits). */
  onLast: boolean;
}

interface HintState {
  text: string;
  /** Tiles to flag as blocking. */
  blocking: number[];
}

export default function Game({ seed, options, paused, onReady, onHint, onComplete }: GameProps) {
  const size = options.size === '6' ? 6 : 5;
  const puzzle = useMemo(() => generatePuzzle(seed, size), [seed, size]);
  const { letters, walls, words } = puzzle;
  const n = size * size;

  const [found, setFound] = useState<FoundWord[]>([]);
  const [history, setHistory] = useState<FoundWord[][]>([]);
  const [trace, setTraceState] = useState<number[]>([]);
  const traceRef = useRef<number[]>([]);
  const [revealed, setRevealed] = useState<number[]>(() => words.map(() => 0));
  const [hint, setHint] = useState<HintState | null>(null);
  const [shakeCells, setShakeCells] = useState<number[]>([]);
  const [shakeKey, setShakeKey] = useState(0);
  const [pop, setPop] = useState<{ w: number; key: number } | null>(null);
  const [won, setWon] = useState(false);
  const [cursor, setCursor] = useState<number | null>(null);
  const dragRef = useRef<DragState | null>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const readyRef = useRef(false);
  const completeRef = useRef(false);
  const shakeTimer = useRef<number | undefined>(undefined);

  const inactive = paused || won;

  useEffect(() => {
    if (readyRef.current) return;
    readyRef.current = true;
    onReady();
  }, [onReady]);

  useEffect(() => () => window.clearTimeout(shakeTimer.current), []);

  const setTrace = useCallback((t: number[]) => {
    traceRef.current = t;
    setTraceState(t);
  }, []);

  // owner[c] = word index occupying cell c, or -1.
  const owner = useMemo(() => {
    const o = new Array<number>(n).fill(-1);
    for (const f of found) for (const c of f.path) o[c] = f.w;
    return o;
  }, [found, n]);
  const foundSet = useMemo(() => new Set(found.map((f) => f.w)), [found]);

  const isFree = (c: number) => c >= 0 && c < n && !walls[c] && owner[c] < 0;

  // ---------------------------------------------------------------------------
  // Submitting a traced word

  const cancelShake = () => {
    window.clearTimeout(shakeTimer.current);
    setShakeCells([]);
  };

  const reject = (t: number[], message: string) => {
    toast(message);
    setShakeCells(t);
    setShakeKey((k) => k + 1);
    window.clearTimeout(shakeTimer.current);
    shakeTimer.current = window.setTimeout(() => {
      setShakeCells([]);
      if (traceRef.current === t) setTrace([]);
    }, 450);
  };

  const submit = () => {
    const t = traceRef.current;
    if (t.length === 0) return;
    if (t.length === 1) {
      setTrace([]);
      return;
    }
    const word = t.map((c) => letters[c]).join('');
    const w = words.findIndex((hw, i) => hw.word === word && !foundSet.has(i));
    if (w >= 0) {
      const next = [...found, { w, path: t }];
      setHistory((h) => [...h, found]);
      setFound(next);
      setTrace([]);
      setHint(null);
      setPop({ w, key: Date.now() });
      if (next.length === words.length) finish(next);
      return;
    }
    if (words.some((hw) => hw.word === word)) reject(t, 'Already found');
    else if (t.length < 3) reject(t, 'Too short');
    else if (isValidWord(word)) reject(t, 'Not one of the hidden words');
    else reject(t, 'Not in word list');
  };

  const finish = (all: FoundWord[]) => {
    setWon(true);
    setCursor(null);
    if (completeRef.current) return;
    completeRef.current = true;
    const ordered = [...all].sort((a, b) => a.w - b.w);
    onComplete({
      won: true,
      share: `🧵 Wend ${words.length} words`,
      summary: (
        <div className={styles.summary}>
          {ordered.map((f) => (
            <span key={f.w} className={`${styles.chip} ${colorOf(f.w)}`}>
              {words[f.w].word}
            </span>
          ))}
        </div>
      ),
    });
  };

  // ---------------------------------------------------------------------------
  // Tracing

  /** Extend / retract the trace toward cell c. Returns true when it changed. */
  const moveTo = (c: number): boolean => {
    const t = traceRef.current;
    if (t.length === 0) return false;
    const last = t[t.length - 1];
    if (c === last) return false;
    const idx = t.indexOf(c);
    if (idx >= 0) {
      setTrace(t.slice(0, idx + 1));
      return true;
    }
    if (!isFree(c)) return false;
    if (isAdjacent(size, last, c)) {
      setTrace([...t, c]);
      return true;
    }
    // Fast drags can skip a tile: fill in straight runs.
    const lr = Math.floor(last / size);
    const lc = last % size;
    const cr = Math.floor(c / size);
    const cc = c % size;
    if (lr !== cr && lc !== cc) return false;
    const step = lr === cr ? Math.sign(cc - lc) : Math.sign(cr - lr) * size;
    const add: number[] = [];
    for (let k = last + step; ; k += step) {
      if (!isFree(k) || t.includes(k)) return false;
      add.push(k);
      if (k === c) break;
    }
    setTrace([...t, ...add]);
    return true;
  };

  /** Tap / pointer-down behaviour on a tile. Returns whether it hit the last tile. */
  const press = (c: number): boolean => {
    cancelShake();
    const t = traceRef.current;
    if (t.length && c === t[t.length - 1]) return true;
    const idx = t.indexOf(c);
    if (idx >= 0) setTrace(t.slice(0, idx + 1));
    else if (t.length && isAdjacent(size, t[t.length - 1], c)) setTrace([...t, c]);
    else setTrace([c]);
    return false;
  };

  const cellFromEvent = (e: ReactPointerEvent, strict: boolean): number | null => {
    const el = gridRef.current;
    if (!el) return null;
    const rect = el.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * size;
    const y = ((e.clientY - rect.top) / rect.height) * size;
    const col = Math.floor(x);
    const row = Math.floor(y);
    if (col < 0 || row < 0 || col >= size || row >= size) return null;
    // While dragging, only register once the pointer is well inside a tile so
    // cutting a corner doesn't pick a diagonal neighbour.
    if (strict && (Math.abs(x - col - 0.5) > 0.38 || Math.abs(y - row - 0.5) > 0.38)) return null;
    return row * size + col;
  };

  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (inactive || (e.pointerType === 'mouse' && e.button !== 0)) return;
    const c = cellFromEvent(e, false);
    if (c == null || !isFree(c)) return;
    e.preventDefault();
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // synthetic / already-released pointer: tracking still works via bubbling
    }
    setCursor(null);
    const onLast = press(c);
    dragRef.current = { id: e.pointerId, moved: false, onLast };
  };

  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const d = dragRef.current;
    if (!d || d.id !== e.pointerId || inactive) return;
    const c = cellFromEvent(e, true);
    if (c == null) return;
    if (moveTo(c)) d.moved = true;
  };

  const onPointerUp = (e: ReactPointerEvent<HTMLDivElement>) => {
    const d = dragRef.current;
    if (!d || d.id !== e.pointerId) return;
    dragRef.current = null;
    if (inactive) return;
    if (d.moved) {
      if (traceRef.current.length >= 2) submit();
    } else if (d.onLast) {
      submit();
    }
  };

  const onPointerCancel = () => {
    dragRef.current = null;
  };

  // ---------------------------------------------------------------------------
  // Controls

  const undo = () => {
    if (!history.length || won) return;
    setFound(history[history.length - 1]);
    setHistory((h) => h.slice(0, -1));
    setTrace([]);
    setHint(null);
    cancelShake();
  };

  const clear = () => {
    if (won) return;
    cancelShake();
    setHint(null);
    if (found.length) {
      setHistory((h) => [...h, found]);
      setFound([]);
    }
    setTrace([]);
  };

  const giveHint = () => {
    if (won) return;
    const r = nextHint(puzzle, found, revealed);
    setTrace([]);
    cancelShake();
    if (r.kind === 'blocking') {
      const f = found[r.found];
      setHint({
        text: `One of your words is blocking the rest — try undoing ${words[f.w].word}.`,
        blocking: f.path,
      });
      onHint();
      return;
    }
    if (r.kind === 'reveal') {
      const hw = words[r.w];
      const next = revealed.slice();
      next[r.w] = r.step + 1;
      setRevealed(next);
      setHint({
        text:
          r.step === 0
            ? `The ${hw.word.length}-letter word starts on tile 1.`
            : r.step + 1 === hw.word.length
              ? `That's the whole ${hw.word.length}-letter word — trace tiles 1 to ${hw.word.length}.`
              : `Here's letter ${r.step + 1} of the ${hw.word.length}-letter word.`,
        blocking: [],
      });
      onHint();
      return;
    }
    setHint({ text: 'Trace the numbered tiles in order to spell the word.', blocking: [] });
  };

  // ---------------------------------------------------------------------------
  // Keyboard: arrows move / extend, letters extend, Enter submits,
  // Backspace retracts, Escape clears.

  const keyRef = useRef<(e: KeyboardEvent) => void>(() => {});
  keyRef.current = (e: KeyboardEvent) => {
    if (inactive || e.metaKey || e.ctrlKey || e.altKey) return;
    const target = e.target as HTMLElement | null;
    if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) return;
    const t = traceRef.current;
    const key = e.key;
    const dirs: Record<string, [number, number]> = {
      ArrowUp: [-1, 0],
      ArrowDown: [1, 0],
      ArrowLeft: [0, -1],
      ArrowRight: [0, 1],
    };
    if (key in dirs) {
      e.preventDefault();
      const [dr, dc] = dirs[key];
      const from = t.length ? t[t.length - 1] : (cursor ?? Math.floor(n / 2));
      const r = Math.floor(from / size) + dr;
      const c = (from % size) + dc;
      if (r < 0 || c < 0 || r >= size || c >= size) return;
      const to = r * size + c;
      if (t.length) {
        if (moveTo(to)) setCursor(traceRef.current[traceRef.current.length - 1]);
      } else setCursor(to);
      return;
    }
    if (key === ' ') {
      if (cursor == null) return;
      e.preventDefault();
      if (isFree(cursor)) press(cursor);
      return;
    }
    if (key === 'Enter') {
      if (!t.length) return;
      e.preventDefault();
      submit();
      return;
    }
    if (key === 'Backspace') {
      if (!t.length) return;
      e.preventDefault();
      cancelShake();
      const next = t.slice(0, -1);
      setTrace(next);
      setCursor(next.length ? next[next.length - 1] : t[0]);
      return;
    }
    if (key === 'Escape') {
      setTrace([]);
      return;
    }
    if (/^[a-zA-Z]$/.test(key)) {
      const L = key.toUpperCase();
      let options: number[];
      if (t.length) {
        const last = t[t.length - 1];
        options = [last - size, last + size, last - 1, last + 1].filter(
          (c) => isAdjacent(size, last, c) && isFree(c) && !t.includes(c) && letters[c] === L,
        );
      } else {
        options = [...Array(n).keys()].filter((c) => isFree(c) && letters[c] === L);
        // Prefer the tile under the keyboard cursor, if any.
        if (cursor != null && options.includes(cursor)) options = [cursor];
      }
      if (!options.length) return;
      e.preventDefault();
      cancelShake();
      const c = options[0];
      setTrace(t.length ? [...t, c] : [c]);
      setCursor(c);
    }
  };
  useEffect(() => {
    const fn = (e: KeyboardEvent) => keyRef.current(e);
    window.addEventListener('keydown', fn);
    return () => window.removeEventListener('keydown', fn);
  }, []);

  // ---------------------------------------------------------------------------
  // Render helpers

  const center = (c: number) => `${(c % size) + 0.5} ${Math.floor(c / size) + 0.5}`;
  const pathD = (p: number[]) => (p.length ? `M ${center(p[0])} ` + (p.length === 1 ? 'l 0 0' : p.slice(1).map((c) => `L ${center(c)}`).join(' ')) : '');

  const traceSet = new Set(trace);
  const shakeSet = new Set(shakeCells);
  const blockingSet = new Set(hint?.blocking ?? []);
  // Revealed hint tiles: cell -> { w, n }
  const revealedAt = new Map<number, { w: number; k: number }>();
  words.forEach((hw, w) => {
    for (let k = 0; k < revealed[w]; k++) revealedAt.set(hw.path[k], { w, k: k + 1 });
  });
  const popIndex = new Map<number, number>();
  if (pop) {
    const f = found.find((x) => x.w === pop.w);
    f?.path.forEach((c, i) => popIndex.set(c, i));
  }

  const cellClass = (c: number, layer: 'tile' | 'letter') => {
    const cls = [layer === 'tile' ? styles.tile : styles.letterCell];
    if (walls[c]) {
      cls.push(styles.wall);
      return cls.join(' ');
    }
    const o = owner[c];
    if (layer === 'tile') {
      if (o >= 0) cls.push(styles.found, colorOf(o));
      else if (traceSet.has(c)) cls.push(styles.traced);
      const rv = revealedAt.get(c);
      if (rv && o < 0) cls.push(styles.revealed, colorOf(rv.w));
      if (blockingSet.has(c)) cls.push(styles.blocking);
      if (cursor === c && trace.length === 0) cls.push(styles.cursor);
    } else if (o >= 0) cls.push(styles.onColor);
    if (shakeSet.has(c)) cls.push(styles.shake);
    if (won) cls.push(styles.wave);
    else if (popIndex.has(c)) cls.push(styles.pop);
    return cls.join(' ');
  };

  const cellStyle = (c: number): CSSProperties | undefined => {
    if (won) return { animationDelay: `${(Math.floor(c / size) + (c % size)) * 70}ms` };
    if (popIndex.has(c)) return { animationDelay: `${popIndex.get(c)! * 45}ms` };
    return undefined;
  };

  const traceWord = trace.map((c) => letters[c]).join('');
  const boardStyle = { '--n': size } as CSSProperties;

  return (
    <div className={styles.wrap}>
      <div className={styles.bubbleRow} aria-live="polite">
        {traceWord ? (
          <div key={shakeKey} className={`${styles.bubble} ${shakeCells.length ? styles.shake : ''}`}>
            {traceWord}
          </div>
        ) : won ? (
          <div className={`${styles.bubble} ${styles.bubbleDone}`}>All words found!</div>
        ) : (
          <div className={styles.bubbleIdle}>Drag across letters to spell a word</div>
        )}
      </div>

      <div className={styles.frame}>
        <div
          ref={gridRef}
          className={`${styles.board} ${size === 6 ? styles.board6 : ''}`}
          style={boardStyle}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerCancel}
          onContextMenu={(e) => e.preventDefault()}
          role="grid"
          aria-label={`Wend ${size} by ${size} letter grid`}
        >
          <div className={styles.layer}>
            {letters.map((_, c) => (
              <div key={`${pop?.key ?? 0}-${c}`} className={styles.cell}>
                <div className={cellClass(c, 'tile')} style={cellStyle(c)} />
              </div>
            ))}
          </div>

          <svg className={styles.lines} viewBox={`0 0 ${size} ${size}`} aria-hidden>
            {found.map((f) => (
              <path key={f.w} d={pathD(f.path)} className={`${styles.line} ${colorOf(f.w)}`} />
            ))}
          </svg>
          <svg key={shakeKey} className={`${styles.lines} ${shakeCells.length ? styles.shake : ''}`} viewBox={`0 0 ${size} ${size}`} aria-hidden>
            {trace.length > 0 && owner[trace[0]] < 0 && <path d={pathD(trace)} className={`${styles.line} ${styles.traceLine}`} />}
          </svg>

          <div className={`${styles.layer} ${styles.letters}`}>
            {letters.map((l, c) => {
              const rv = revealedAt.get(c);
              return (
                <div
                  key={`${pop?.key ?? 0}-${c}`}
                  className={styles.cell}
                  role="gridcell"
                  aria-label={walls[c] ? 'wall' : `${l}${owner[c] >= 0 ? ', used' : ''}`}
                >
                  <div className={cellClass(c, 'letter')} style={cellStyle(c)}>
                    {!walls[c] && <span className={styles.letter}>{l}</span>}
                    {rv && owner[c] < 0 && <span className={`${styles.badge} ${colorOf(rv.w)}`}>{rv.k}</span>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {hint && (
        <HintBubble onDismiss={() => setHint(null)}>
          <span>{hint.text}</span>
        </HintBubble>
      )}

      <div className={styles.slots} aria-label="Hidden words">
        {words.map((hw, w) => {
          const isFound = foundSet.has(w);
          return (
            <div key={w} className={`${styles.slotRow} ${isFound ? styles.slotFound : ''}`} aria-label={isFound ? hw.word : `${hw.word.length} letters`}>
              {[...hw.word].map((ch, i) => (
                <span
                  key={i}
                  className={`${styles.slot} ${isFound ? `${styles.slotFilled} ${colorOf(w)}` : i < revealed[w] ? `${styles.slotHinted} ${colorOf(w)}` : ''}`}
                  style={isFound ? { animationDelay: `${i * 40}ms` } : undefined}
                >
                  {isFound || i < revealed[w] ? ch : ''}
                </span>
              ))}
              <span className={styles.slotCheck} aria-hidden>
                {isFound && <Check size={16} />}
              </span>
            </div>
          );
        })}
      </div>

      <ControlBar>
        <ControlButton icon={<Undo size={18} />} label="Undo" onClick={undo} disabled={inactive || history.length === 0} />
        <ControlButton icon={<Bulb size={18} />} label="Hint" onClick={giveHint} disabled={inactive} />
        <ControlButton icon={<Eraser size={18} />} label="Clear" onClick={clear} disabled={inactive || (found.length === 0 && trace.length === 0)} />
      </ControlBar>
    </div>
  );
}
