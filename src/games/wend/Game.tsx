import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from 'react';
import type { GameProps } from '../../core/types';
import { ControlBar, ControlButton, HintBubble } from '../../core/components/Controls';
import { Bulb, Check, Eraser, Undo } from '../../core/components/Icons';
import { toast } from '../../core/components/Toast';
import { CORE } from '../../i18n/core';
import {
  generatePuzzle,
  keyToTileLetter,
  lexiconIfLoaded,
  loadLexicon,
  type FoundWord,
  type Lexicon,
  type WordLang,
} from './generator';
import { STR } from './i18n';
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
import { EMPTY_LINE, lineFor, sameLine, stepLine, type LineState } from '../zip/lineAnim';
import { lineChevronsD, linePathD, nearHead, shouldSnap, staticChevronsD, staticPathD, strokeTarget } from './lineDraw';
import styles from './Game.module.css';

const prefersReducedMotion = () =>
  typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

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

export default function Game(props: GameProps) {
  const wordLang: WordLang = props.options.words === 'es' ? 'es' : 'en';
  const [lexicon, setLexicon] = useState<Lexicon | null>(() => lexiconIfLoaded(wordLang));
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    if (lexicon) return;
    let alive = true;
    loadLexicon(wordLang).then(
      (l) => alive && setLexicon(l),
      () => alive && setFailed(true),
    );
    return () => {
      alive = false;
    };
  }, [lexicon, wordLang]);
  if (!lexicon) return <div className="lp-loading">{failed ? STR[props.lang].loadError : CORE[props.lang].loading}</div>;
  return <Board {...props} lexicon={lexicon} />;
}

function Board({ seed, lang, options, paused, onReady, onHint, onComplete, lexicon }: GameProps & { lexicon: Lexicon }) {
  const t = STR[lang];
  const size = options.size === '6' ? 6 : 5;
  const puzzle = useMemo(() => generatePuzzle(seed, size, lexicon), [seed, size, lexicon]);
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

  // ---------------------------------------------------------------------------
  // Animated line. The "focus" line (the stroke being drawn, then the line it left behind) is drawn
  // imperatively: its displayed state chases a target (committed cells + a live tip toward the
  // pointer) in a requestAnimationFrame loop that only touches two SVG paths. Other lines are static.

  /** The line the last stroke left behind (still drawn by the animated overlay). */
  const [focusLine, setFocusState] = useState<Line | null>(null);
  const focusRef = useRef<Line | null>(null);
  /** Latest pointer sample during a drag, in board cell units. */
  const pointerRef = useRef<Pt | null>(null);
  /** The live tip re-arms once the pointer nears the head's centre, so entering a tile snaps to it. */
  const tipArmedRef = useRef(false);
  const displayRef = useRef<LineState>(EMPTY_LINE);
  const targetRef = useRef<LineState>(EMPTY_LINE);
  const rafRef = useRef(0);
  const lastTsRef = useRef(-1);
  const focusPathRef = useRef<SVGPathElement>(null);
  const focusChevRef = useRef<SVGPathElement>(null);

  const draw = (line: LineState) => {
    const path = focusPathRef.current;
    const chev = focusChevRef.current;
    if (!path || !chev) return;
    const d = linePathD(line, size);
    const cd = lineChevronsD(line, size);
    if (path.getAttribute('d') !== d) path.setAttribute('d', d);
    if (chev.getAttribute('d') !== cd) chev.setAttribute('d', cd);
  };
  const drawRef = useRef(draw);
  drawRef.current = draw;

  const tickRef = useRef<(ts: number) => void>(() => {});
  tickRef.current = (ts: number) => {
    const dt = lastTsRef.current < 0 ? 16 : ts - lastTsRef.current;
    lastTsRef.current = ts;
    const next = stepLine(displayRef.current, targetRef.current, dt);
    displayRef.current = next;
    drawRef.current(next);
    if (sameLine(next, targetRef.current)) rafRef.current = 0;
    else rafRef.current = requestAnimationFrame((t) => tickRef.current(t));
  };
  useEffect(() => () => cancelAnimationFrame(rafRef.current), []);

  /** Jump the displayed line (no animation). */
  const showNow = (line: LineState) => {
    cancelAnimationFrame(rafRef.current);
    rafRef.current = 0;
    displayRef.current = line;
    targetRef.current = line;
    drawRef.current(line);
  };

  /** Recompute where the focus line should be and start animating toward it. */
  const retarget = (snap = false) => {
    const s = strokeRef.current;
    const focus = s ? s.active : focusRef.current;
    let t = focus ? lineFor(focus) : EMPTY_LINE;
    const p = pointerRef.current;
    if (s && dragRef.current && p && !inactive && !s.merge && s.active.length) {
      if (nearHead(size, s.active[s.active.length - 1], p)) tipArmedRef.current = true;
      if (tipArmedRef.current) t = strokeTarget(grid, s, p);
    }
    if (snap || prefersReducedMotion()) {
      showNow(t);
      return;
    }
    targetRef.current = t;
    if (rafRef.current) return;
    if (sameLine(displayRef.current, t)) {
      drawRef.current(displayRef.current);
      return;
    }
    lastTsRef.current = -1;
    rafRef.current = requestAnimationFrame((ts) => tickRef.current(ts));
  };

  const setFocus = (l: Line | null) => {
    focusRef.current = l;
    setFocusState(l);
  };

  const setStroke = (s: Stroke | null) => {
    const prev = strokeRef.current;
    if (dragRef.current && s && prev && s.active.at(-1) !== prev.active.at(-1)) tipArmedRef.current = false;
    strokeRef.current = s;
    setStrokeState(s);
    retarget(shouldSnap(prev, s));
  };

  /**
   * Start a stroke at tile c. The animated line starts from what's on screen there (the full line
   * being continued, which then retracts to c), unless it is already the animated one.
   */
  const startStroke = (s: Stroke, c: number) => {
    const prevLine = linesRef.current.find((l) => l.includes(c)) ?? null;
    if (!prevLine || prevLine !== focusRef.current) showNow(lineFor(prevLine ?? s.active));
    tipArmedRef.current = true;
    setStroke(s);
  };

  /** Drop the animated overlay (undo / clear / hints / cancel redraw the board instantly). */
  const dropFocus = () => {
    setFocus(null);
    showNow(EMPTY_LINE);
  };

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
      share: t.share(words.length),
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

  /** Tiles of lines that already spell a found word: new strokes can't touch them. */
  const lockedCells = (ls: Line[]): Set<number> => new Set(foundWords(ls).flatMap((f) => f.path));

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
        const t = beginStroke(grid, before, head, lockedCells(before));
        if (t) final = stepStroke(grid, t, tapCell);
      }
    }
    pointerRef.current = null;
    setFocus(final.active);
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
        if (words.some((hw) => hw.word === word)) toast(t.alreadyFound);
        else if (lexicon.isValidWord(word)) toast(t.notHidden);
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
    const s = beginStroke(grid, linesRef.current, c, lockedCells(linesRef.current));
    if (!s) return;
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // synthetic / already-released pointer: tracking still works via bubbling
    }
    setCursor(null);
    setHint((h) => (h?.blocking.length ? null : h));
    dragRef.current = { id: e.pointerId, cur: c, last: p, moved: false };
    pointerRef.current = p;
    startStroke(s, c);
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
        canEnter: (c) => !walls[c] && !s!.locked.has(c),
        isBack: (c) => isBackStep(s!, c),
        enter: (c) => {
          d.moved = true;
          s = stepStroke(grid, s!, c);
        },
      });
      d.last = p;
      pointerRef.current = p;
    }
    if (s !== strokeRef.current) setStroke(s);
    else retarget();
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
    dropFocus();
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
    dropFocus();
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
        text: t.blocking(words[r.found.w].word),
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
      dropFocus();
      commit(r.lines);
      selectedRef.current = r.lines[r.lines.length - 1].at(-1) ?? null;
      onHint();
      if (foundWords(r.lines).length === words.length) return;
      const main = r.step + 1 === len ? t.wholeWord(len) : r.step === 0 ? t.startsOn(len) : t.letterOf(r.step + 1, len);
      const note = r.flipped ? t.flipped : r.cleared ? t.cleared : '';
      setHint({ text: main + note, blocking: [] });
      return;
    }
    setHint({ text: t.traceNumbered, blocking: [] });
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
      const st = beginStroke(grid, linesRef.current, c, lockedCells(linesRef.current));
      if (!st) return;
      keyStrokeRef.current = true;
      setHint((h) => (h?.blocking.length ? null : h));
      startStroke(st, c);
      setCursor(headOf(st));
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
      dropFocus();
      return;
    }
    const L = keyToTileLetter(key);
    if (L) {
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

  // The focus line (stroke being drawn, or the line it left) is drawn by the animated overlay.
  const focus = stroke ? stroke.active : focusLine;
  const focusIdx = focus ? shown.indexOf(focus) : -1;

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
  const drawOrder = shown.map((_, i) => i).filter((i) => i !== focusIdx).sort((a, b) => {
    const rank = (i: number) => (i === activeIdx ? 2 : assign[i] >= 0 ? 1 : 0);
    return rank(a) - rank(b);
  });

  useLayoutEffect(() => {
    drawRef.current(displayRef.current);
  });

  const traceWord = stroke ? spell(stroke.active) : '';
  const boardStyle = { '--n': size } as CSSProperties;
  const hasLines = lines.length > 0;

  return (
    <div className={`${styles.wrap}${lang === 'es' ? ` ${styles.longLabels}` : ''}`}>
      <div className={styles.bubbleRow} aria-live="polite">
        {traceWord ? (
          <div className={`${styles.bubble} ${assign[activeIdx] >= 0 ? `${styles.bubbleFound} ${colorOf(assign[activeIdx])}` : ''}`}>{traceWord}</div>
        ) : won ? (
          <div className={`${styles.bubble} ${styles.bubbleDone}`}>{t.allFound}</div>
        ) : (
          <div className={styles.bubbleIdle}>{t.idle}</div>
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
          aria-label={t.gridLabel(size)}
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
                <path d={staticPathD(shown[i], size)} className={lineClass(i)} />
                {shown[i].length > 1 && <path d={staticChevronsD(shown[i], size)} className={chevronClass(i)} />}
              </g>
            ))}
            <g style={focusIdx < 0 ? { display: 'none' } : undefined}>
              <path ref={focusPathRef} className={focusIdx >= 0 ? lineClass(focusIdx) : styles.line} />
              <path ref={focusChevRef} className={focusIdx >= 0 ? chevronClass(focusIdx) : styles.chevron} />
            </g>
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
                  aria-label={walls[c] ? t.wall : `${l}${w >= 0 ? t.cellFound : lineOf[c] >= 0 ? t.cellDrawn : ''}`}
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

      <div className={styles.slots} aria-label={t.hiddenWords}>
        {words.map((hw, w) => {
          const isFound = foundSet.has(w);
          return (
            <div key={w} className={`${styles.slotRow} ${isFound ? styles.slotFound : ''}`} aria-label={isFound ? hw.word : t.letters(hw.word.length)}>
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
        <ControlButton icon={<Undo size={18} />} label={t.undo} onClick={undo} disabled={inactive || history.length === 0} />
        <ControlButton icon={<Bulb size={18} />} label={t.hint} onClick={giveHint} disabled={inactive} />
        <ControlButton icon={<Eraser size={18} />} label={t.clear} onClick={clear} disabled={inactive || !hasLines} />
      </ControlBar>
    </div>
  );
}
