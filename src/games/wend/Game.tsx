import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from 'react';
import type { GameProps } from '../../core/types';
import { ControlBar, ControlButton, HintBubble } from '../../core/components/Controls';
import { Bulb, Check, Eraser, Undo } from '../../core/components/Icons';
import { toast } from '../../core/components/Toast';
import { generatePuzzle, isValidWord, type FoundWord } from './generator';
import { planHint } from './hints';
import {
  adjacent,
  assignWords,
  beginStroke,
  cellAt,
  isBackStep,
  sameBoard,
  stepStroke,
  strokeLines,
  trackPointer,
  type Grid,
  type Line,
  type Pt,
  type Stroke,
} from './lines';
import styles from './Game.module.css';

const COLOR_CLASSES = [styles.c0, styles.c1, styles.c2, styles.c3, styles.c4];
const colorOf = (w: number) => COLOR_CLASSES[w % COLOR_CLASSES.length];

interface DragState {
  id: number;
  /** Cell the pointer is logically in. */
  cur: number;
  /** Last pointer sample, in board cell units. */
  last: Pt;
  /** The pointer entered another cell during this press. */
  moved: boolean;
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
  const grid: Grid = useMemo(() => ({ size, walls }), [size, walls]);
  const n = size * size;

  const [lines, setLinesState] = useState<Line[]>([]);
  const linesRef = useRef<Line[]>([]);
  const [stroke, setStrokeState] = useState<Stroke | null>(null);
  const strokeRef = useRef<Stroke | null>(null);
  const [history, setHistory] = useState<Line[][]>([]);
  const [revealed, setRevealed] = useState<number[]>(() => words.map(() => 0));
  const [hint, setHint] = useState<HintState | null>(null);
  const [pop, setPop] = useState<{ cells: Map<number, number>; key: number } | null>(null);
  const [won, setWon] = useState(false);
  const [cursor, setCursor] = useState<number | null>(null);
  const dragRef = useRef<DragState | null>(null);
  /** A keyboard-driven stroke is in progress (ends with Enter / Space). */
  const keyStrokeRef = useRef(false);
  /** Head of the line drawn by the last stroke (tap next to it to extend). */
  const selectedRef = useRef<number | null>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const readyRef = useRef(false);
  const completeRef = useRef(false);

  const inactive = paused || won;

  useEffect(() => {
    if (readyRef.current) return;
    readyRef.current = true;
    onReady();
  }, [onReady]);

  const setLines = useCallback((l: Line[]) => {
    linesRef.current = l;
    setLinesState(l);
  }, []);
  const setStroke = useCallback((s: Stroke | null) => {
    strokeRef.current = s;
    setStrokeState(s);
  }, []);

  const spell = (l: Line) => l.map((c) => letters[c]).join('');

  // ---------------------------------------------------------------------------
  // Committing a stroke

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

  const foundWords = (ls: Line[]): FoundWord[] => {
    const a = assignWords(ls, letters, words);
    const out: FoundWord[] = [];
    a.forEach((w, i) => w >= 0 && out.push({ w, path: ls[i] }));
    return out;
  };

  /** Replace the committed line set (one undo step when it actually changed). */
  const commit = (next: Line[]) => {
    const before = linesRef.current;
    if (sameBoard(before, next)) {
      setLines(next);
      return;
    }
    setHistory((h) => [...h, before]);
    setLines(next);
    setHint(null);
    const had = new Set(foundWords(before).map((f) => `${f.w}:${f.path.join(',')}`));
    const now = foundWords(next);
    const fresh = now.filter((f) => !had.has(`${f.w}:${f.path.join(',')}`));
    if (fresh.length) {
      const cells = new Map<number, number>();
      for (const f of fresh) f.path.forEach((c, i) => cells.set(c, i));
      setPop({ cells, key: Date.now() });
    }
    if (now.length === words.length) finish(now);
  };

  /** End the current stroke. `tapCell` = a press that never left its tile. */
  const endStroke = (tapCell?: number) => {
    const s = strokeRef.current;
    keyStrokeRef.current = false;
    if (!s) return;
    const before = linesRef.current;
    let final = s;
    // Tap next to the head of the line you just drew (on a free tile) extends it.
    const head = selectedRef.current;
    if (tapCell != null && head != null && head !== tapCell && adjacent(size, head, tapCell) && !before.some((l) => l.includes(tapCell))) {
      const li = before.findIndex((l) => l[l.length - 1] === head);
      if (li >= 0 && assignWords(before, letters, words)[li] < 0) {
        const t = beginStroke(grid, before, head);
        if (t) final = stepStroke(grid, t, tapCell);
      }
    }
    setStroke(null);
    const next = strokeLines(final);
    selectedRef.current = final.active[final.active.length - 1];
    const changed = !sameBoard(before, next);
    commit(next);
    // Gentle feedback when a finished stroke spells a real word that isn't hidden.
    if (changed && final.active.length >= 3) {
      const idx = next.length - 1;
      if (assignWords(next, letters, words)[idx] < 0) {
        const word = spell(final.active);
        if (words.some((hw) => hw.word === word)) toast('Already found');
        else if (isValidWord(word)) toast('Not one of the hidden words');
      }
    }
  };

  // Pausing mid-stroke keeps what was drawn.
  useEffect(() => {
    if (inactive && strokeRef.current) {
      dragRef.current = null;
      endStroke();
    }
  }, [inactive]);

  // ---------------------------------------------------------------------------
  // Pointer tracking (board geometry, not per-tile hit targets)

  const toBoard = (e: { clientX: number; clientY: number }): Pt | null => {
    const el = gridRef.current;
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { x: ((e.clientX - r.left) / r.width) * size, y: ((e.clientY - r.top) / r.height) * size };
  };

  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (inactive || (e.pointerType === 'mouse' && e.button !== 0)) return;
    const p = toBoard(e);
    if (!p || p.x < 0 || p.y < 0 || p.x >= size || p.y >= size) return;
    const c = cellAt(size, p);
    if (walls[c]) return;
    e.preventDefault();
    if (strokeRef.current) endStroke();
    const s = beginStroke(grid, linesRef.current, c);
    if (!s) return;
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // synthetic / already-released pointer: tracking still works via bubbling
    }
    setCursor(null);
    setHint((h) => (h?.blocking.length ? null : h));
    setStroke(s);
    dragRef.current = { id: e.pointerId, cur: c, last: p, moved: false };
  };

  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const d = dragRef.current;
    if (!d || d.id !== e.pointerId || inactive) return;
    let s = strokeRef.current;
    if (!s) return;
    const native = e.nativeEvent;
    const samples = typeof native.getCoalescedEvents === 'function' ? native.getCoalescedEvents() : [];
    const events = samples.length ? samples : [native];
    for (const ev of events) {
      const p = toBoard(ev);
      if (!p) continue;
      d.cur = trackPointer(size, d.cur, d.last, p, {
        canEnter: (c) => !walls[c],
        isBack: (c) => isBackStep(s!, c),
        enter: (c) => {
          d.moved = true;
          s = stepStroke(grid, s!, c);
        },
      });
      d.last = p;
    }
    if (s !== strokeRef.current) setStroke(s);
  };

  const onPointerUp = (e: ReactPointerEvent<HTMLDivElement>) => {
    const d = dragRef.current;
    if (!d || d.id !== e.pointerId) return;
    dragRef.current = null;
    endStroke(d.moved ? undefined : d.cur);
  };

  const onPointerCancel = () => {
    if (!dragRef.current) return;
    dragRef.current = null;
    endStroke();
  };

  // ---------------------------------------------------------------------------
  // Controls

  const undo = () => {
    if (!history.length || won) return;
    dragRef.current = null;
    keyStrokeRef.current = false;
    setStroke(null);
    setLines(history[history.length - 1]);
    setHistory((h) => h.slice(0, -1));
    selectedRef.current = null;
    setHint(null);
  };

  const clear = () => {
    if (won) return;
    dragRef.current = null;
    keyStrokeRef.current = false;
    setStroke(null);
    setHint(null);
    selectedRef.current = null;
    if (linesRef.current.length) commit([]);
  };

  const giveHint = () => {
    if (won) return;
    if (strokeRef.current) endStroke();
    const r = planHint(puzzle, linesRef.current, revealed);
    if (r.kind === 'blocking') {
      setHint({
        text: `${words[r.found.w].word} is a hidden word, but not there — it's blocking the rest. Draw through it to break it up.`,
        blocking: r.found.path,
      });
      onHint();
      return;
    }
    if (r.kind === 'reveal') {
      const hw = words[r.w];
      const len = hw.word.length;
      setRevealed(r.revealed);
      // Lay the revealed tiles down as a line (one undo step when the board changed).
      commit(r.lines);
      selectedRef.current = r.lines[r.lines.length - 1].at(-1) ?? null;
      onHint();
      if (foundWords(r.lines).length === words.length) return;
      const main =
        r.step + 1 === len
          ? `That's the whole ${len}-letter word.`
          : r.step === 0
            ? `The ${len}-letter word starts on tile 1.`
            : `Here's letter ${r.step + 1} of the ${len}-letter word.`;
      const note = r.flipped ? ' Your line ran backwards, so it was flipped.' : r.cleared ? ' Wrong tiles were taken out of your lines.' : '';
      setHint({ text: main + note, blocking: [] });
      return;
    }
    setHint({ text: 'Trace the numbered tiles in order to spell the word.', blocking: [] });
  };

  // ---------------------------------------------------------------------------
  // Keyboard: arrows move the cursor; Space/Enter starts a stroke at the cursor,
  // arrows or letters then extend it, Backspace retracts, Enter/Space ends it and
  // Escape cancels it. Typing a letter with no stroke starts one on that letter.

  const keyRef = useRef<(e: KeyboardEvent) => void>(() => {});
  keyRef.current = (e: KeyboardEvent) => {
    if (inactive || e.metaKey || e.ctrlKey || e.altKey) return;
    const target = e.target as HTMLElement | null;
    if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) return;
    // Space / Enter on a focused button belong to that button.
    if ((e.key === ' ' || e.key === 'Enter') && target?.tagName === 'BUTTON') return;
    const s = keyStrokeRef.current ? strokeRef.current : null;
    const key = e.key;
    const dirs: Record<string, [number, number]> = {
      ArrowUp: [-1, 0],
      ArrowDown: [1, 0],
      ArrowLeft: [0, -1],
      ArrowRight: [0, 1],
    };
    const headOf = (st: Stroke) => st.active[st.active.length - 1];
    const apply = (st: Stroke) => {
      setStroke(st);
      setCursor(headOf(st));
    };
    const start = (c: number) => {
      const st = beginStroke(grid, linesRef.current, c);
      if (!st) return;
      keyStrokeRef.current = true;
      setHint((h) => (h?.blocking.length ? null : h));
      apply(st);
    };
    if (key in dirs) {
      e.preventDefault();
      const [dr, dc] = dirs[key];
      const from = s ? headOf(s) : (cursor ?? Math.floor(n / 2));
      const r = Math.floor(from / size) + dr;
      const c = (from % size) + dc;
      if (r < 0 || c < 0 || r >= size || c >= size) return;
      const to = r * size + c;
      if (s) apply(stepStroke(grid, s, to));
      else setCursor(to);
      return;
    }
    if (key === ' ' || key === 'Enter') {
      e.preventDefault();
      if (s) endStroke();
      else if (cursor != null && !walls[cursor]) start(cursor);
      return;
    }
    if (key === 'Backspace') {
      if (!s) return;
      e.preventDefault();
      if (s.merge) apply(s.merge.before);
      else if (s.active.length > 1) apply({ ...s, active: s.active.slice(0, -1) });
      return;
    }
    if (key === 'Escape') {
      if (!s) return;
      keyStrokeRef.current = false;
      setStroke(null);
      return;
    }
    if (/^[a-zA-Z]$/.test(key)) {
      const L = key.toUpperCase();
      if (s) {
        const head = headOf(s);
        const opts = [head - size, head + size, head - 1, head + 1].filter(
          (c) => c >= 0 && c < n && adjacent(size, head, c) && !walls[c] && !s.active.includes(c) && letters[c] === L,
        );
        // Prefer free tiles over ones that would merge into / cut another line.
        opts.sort((a, b) => Number(s.others.some((l) => l.includes(a))) - Number(s.others.some((l) => l.includes(b))));
        if (!opts.length) return;
        e.preventDefault();
        apply(stepStroke(grid, s, opts[0]));
        return;
      }
      const taken = new Set(foundWords(linesRef.current).flatMap((f) => f.path));
      let options = [...Array(n).keys()].filter((c) => !walls[c] && letters[c] === L);
      if (cursor != null && options.includes(cursor)) options = [cursor];
      else options.sort((a, b) => Number(taken.has(a)) - Number(taken.has(b)));
      if (!options.length) return;
      e.preventDefault();
      start(options[0]);
    }
  };
  useEffect(() => {
    const fn = (e: KeyboardEvent) => keyRef.current(e);
    window.addEventListener('keydown', fn);
    return () => window.removeEventListener('keydown', fn);
  }, []);

  // ---------------------------------------------------------------------------
  // Render

  const shown = stroke ? strokeLines(stroke) : lines;
  const activeIdx = stroke ? shown.length - 1 : -1;
  const assign = assignWords(shown, letters, words);
  const foundSet = new Set(assign.filter((w) => w >= 0));
  // lineOf[c] = index into `shown`, or -1.
  const lineOf = new Array<number>(n).fill(-1);
  shown.forEach((l, i) => l.forEach((c) => (lineOf[c] = i)));

  const center = (c: number) => `${(c % size) + 0.5} ${Math.floor(c / size) + 0.5}`;
  const pathD = (p: number[]) => `M ${center(p[0])} ` + (p.length === 1 ? 'l 0 0' : p.slice(1).map((c) => `L ${center(c)}`).join(' '));
  /** One small ">" per segment, at its midpoint, pointing in reading direction. */
  const chevronsD = (p: number[]) => {
    const H = 0.06; // half depth along the segment
    const W = 0.12; // half width across it (~24% of a tile overall)
    const f = (v: number) => +v.toFixed(3);
    let d = '';
    for (let i = 1; i < p.length; i++) {
      const [a, b] = [p[i - 1], p[i]];
      const ax = (a % size) + 0.5;
      const ay = Math.floor(a / size) + 0.5;
      const dx = (b % size) - (a % size);
      const dy = Math.floor(b / size) - Math.floor(a / size);
      const mx = ax + dx / 2;
      const my = ay + dy / 2;
      // Back corners, tip, back corners: perpendicular is (-dy, dx).
      d += `M ${f(mx - dx * H - dy * W)} ${f(my - dy * H + dx * W)} L ${f(mx + dx * H)} ${f(my + dy * H)} L ${f(mx - dx * H + dy * W)} ${f(my - dy * H - dx * W)} `;
    }
    return d.trim();
  };

  const blockingSet = new Set(hint?.blocking ?? []);
  // Revealed hint tiles: cell -> { w, k }
  const revealedAt = new Map<number, { w: number; k: number }>();
  words.forEach((hw, w) => {
    for (let k = 0; k < revealed[w]; k++) revealedAt.set(hw.path[k], { w, k: k + 1 });
  });
  const wordAt = (c: number) => (lineOf[c] >= 0 ? assign[lineOf[c]] : -1);

  const cellClass = (c: number, layer: 'tile' | 'letter') => {
    const cls = [layer === 'tile' ? styles.tile : styles.letterCell];
    if (walls[c]) {
      cls.push(styles.wall);
      return cls.join(' ');
    }
    const li = lineOf[c];
    const w = wordAt(c);
    if (layer === 'tile') {
      if (w >= 0) cls.push(styles.found, colorOf(w));
      else if (li >= 0) cls.push(li === activeIdx ? styles.traced : styles.pending);
      const rv = revealedAt.get(c);
      if (rv && w < 0) cls.push(styles.revealed, colorOf(rv.w));
      if (blockingSet.has(c)) cls.push(styles.blocking);
      if (cursor === c && !stroke) cls.push(styles.cursor);
    } else if (w >= 0) cls.push(styles.onColor);
    if (won) cls.push(styles.wave);
    else if (pop?.cells.has(c)) cls.push(styles.pop);
    return cls.join(' ');
  };

  const cellStyle = (c: number): CSSProperties | undefined => {
    if (won) return { animationDelay: `${(Math.floor(c / size) + (c % size)) * 70}ms` };
    const k = pop?.cells.get(c);
    if (k != null) return { animationDelay: `${k * 45}ms` };
    return undefined;
  };

  const lineClass = (i: number) => {
    const w = assign[i];
    if (w >= 0) return `${styles.line} ${colorOf(w)}`;
    return `${styles.line} ${i === activeIdx ? styles.traceLine : styles.pendingLine}`;
  };
  const chevronClass = (i: number) => {
    const w = assign[i];
    if (w >= 0) return `${styles.chevron} ${colorOf(w)}`;
    return `${styles.chevron} ${i === activeIdx ? styles.traceChevron : ''}`;
  };
  // Neutral lines underneath, found words above, the stroke on top.
  const drawOrder = shown.map((_, i) => i).sort((a, b) => {
    const rank = (i: number) => (i === activeIdx ? 2 : assign[i] >= 0 ? 1 : 0);
    return rank(a) - rank(b);
  });

  const traceWord = stroke ? spell(stroke.active) : '';
  const boardStyle = { '--n': size } as CSSProperties;
  const hasLines = lines.length > 0;

  return (
    <div className={styles.wrap}>
      <div className={styles.bubbleRow} aria-live="polite">
        {traceWord ? (
          <div className={`${styles.bubble} ${assign[activeIdx] >= 0 ? `${styles.bubbleFound} ${colorOf(assign[activeIdx])}` : ''}`}>{traceWord}</div>
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
          onLostPointerCapture={onPointerCancel}
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
            {drawOrder.map((i) => (
              <g key={`${i}-${shown[i][0]}`}>
                <path d={pathD(shown[i])} className={lineClass(i)} />
                {shown[i].length > 1 && <path d={chevronsD(shown[i])} className={chevronClass(i)} />}
              </g>
            ))}
          </svg>

          <div className={`${styles.layer} ${styles.letters}`}>
            {letters.map((l, c) => {
              const rv = revealedAt.get(c);
              const w = wordAt(c);
              return (
                <div
                  key={`${pop?.key ?? 0}-${c}`}
                  className={styles.cell}
                  role="gridcell"
                  aria-label={walls[c] ? 'wall' : `${l}${w >= 0 ? ', found' : lineOf[c] >= 0 ? ', drawn' : ''}`}
                >
                  <div className={cellClass(c, 'letter')} style={cellStyle(c)}>
                    {!walls[c] && <span className={styles.letter}>{l}</span>}
                    {rv && w < 0 && <span className={`${styles.badge} ${colorOf(rv.w)}`}>{rv.k}</span>}
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
        <ControlButton icon={<Eraser size={18} />} label="Clear" onClick={clear} disabled={inactive || !hasLines} />
      </ControlBar>
    </div>
  );
}
