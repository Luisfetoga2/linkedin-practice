import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties, PointerEvent as ReactPointerEvent } from 'react';
import type { GameProps } from '../../core/types';
import { ControlBar, ControlButton, HintBubble } from '../../core/components/Controls';
import { Bulb, Eraser, Undo } from '../../core/components/Icons';
import { toast } from '../../core/components/Toast';
import { fitsClue, generatePatches, INK, logicSolve, rectArea, rectContains, rectsOverlap, sameRect, type Clue, type Rect } from './generator';
import { clampGrow, fitProblem, patchAt, resizeRect, resolveNew, resolveResize, type DrawOutcome, type FitProblem, type Patches } from './draw';
import { STR } from './i18n';
import styles from './Game.module.css';


function cellBox(cell: number, n: number): Rect {
  const r = Math.floor(cell / n);
  const c = cell % n;
  return { r0: r, c0: c, r1: r, c1: c };
}

/** Clue colour as CSS (the charcoal clue turns light grey in dark mode). */
const cssColor = (color: string) => (color === INK ? 'var(--pa-ink)' : color);

/** A patch that can never satisfy its clue (LinkedIn: it blinks red and an "Oops!" card explains why). */
interface OopsState {
  clue: number;
  rect: Rect;
  problem: FitProblem;
}

function rectStyle(r: Rect, n: number): CSSProperties {
  const u = 100 / n;
  return {
    left: `${r.c0 * u}%`,
    top: `${r.r0 * u}%`,
    width: `${(r.c1 - r.c0 + 1) * u}%`,
    height: `${(r.r1 - r.r0 + 1) * u}%`,
  };
}

export default function Game({ seed, lang, options, paused, onReady, onHint, onComplete }: GameProps) {
  const t = STR[lang];
  const n = Math.min(8, Math.max(5, parseInt(options.size, 10) || 6));
  const puzzle = useMemo(() => generatePatches(n, seed), [n, seed]);
  const { clues, solution } = puzzle;

  const [patches, setPatchesState] = useState<Patches>(() => clues.map(() => null));
  const patchesRef = useRef<Patches>(patches);
  const [history, setHistory] = useState<Patches[]>([]);
  const [preview, setPreview] = useState<{ rect: Rect; clue: number; bad: boolean } | null>(null);
  const [shake, setShake] = useState<Rect | null>(null);
  const [hint, setHint] = useState<{ text: string } | null>(null);
  const [flash, setFlash] = useState<number | null>(null);
  const [fresh, setFresh] = useState<number | null>(null);
  const [won, setWon] = useState(false);
  const [oops, setOopsState] = useState<OopsState | null>(null);
  const oopsRef = useRef<OopsState | null>(null);
  const setOops = (o: OopsState | null) => {
    oopsRef.current = o;
    setOopsState(o);
  };
  const boardRef = useRef<HTMLDivElement>(null);
  /** `resize` = the drag started on patch `clue` (LinkedIn resize); otherwise a new rectangle. */
  const drag = useRef<{
    pointerId: number;
    start: number;
    cur: number;
    box: Rect;
    moved: boolean;
    resize: { clue: number; base: Rect } | null;
  } | null>(null);
  const [resizing, setResizing] = useState<number | null>(null);
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

  const later = (fn: () => void, ms: number) => timers.current.push(window.setTimeout(fn, ms));

  const setPatches = useCallback((p: Patches) => {
    patchesRef.current = p;
    setPatchesState(p);
  }, []);

  const commit = (next: Patches) => {
    const prev = patchesRef.current; // read now: the updater below may run after setPatches
    setHistory((h) => [...h, prev]);
    setPatches(next);
  };

  const locked = paused || won;


  const cellFromPoint = (x: number, y: number, clamp: boolean): number => {
    const el = boardRef.current;
    if (!el) return -1;
    const b = el.getBoundingClientRect();
    const fx = ((x - b.left) / b.width) * n;
    const fy = ((y - b.top) / b.height) * n;
    if (!clamp && (fx < 0 || fy < 0 || fx >= n || fy >= n)) return -1;
    const c = Math.min(n - 1, Math.max(0, Math.floor(fx)));
    const r = Math.min(n - 1, Math.max(0, Math.floor(fy)));
    return r * n + c;
  };

  // Escape cancels a drag; Cmd/Ctrl+Z undoes.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (document.querySelector('.lp-modal-backdrop')) return;
      if (e.key === 'Escape' && oopsRef.current) {
        dismissOopsRef.current();
        return;
      }
      if (e.key === 'Escape' && drag.current) {
        cancelDrag();
        return;
      }
      if ((e.metaKey || e.ctrlKey) && !e.shiftKey && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        undoRef.current();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const outcomeOf = (d: NonNullable<typeof drag.current>): DrawOutcome =>
    d.resize
      ? resolveResize(clues, d.resize.base, d.resize.clue, d.cur, n, patchesRef.current)
      : resolveNew(clues, d.box);

  /** Shows what releasing would produce: a new box is a grey dashed outline; a resized patch keeps its colour. */
  const updatePreview = (d: NonNullable<typeof drag.current>) => {
    const out = outcomeOf(d);
    if (d.resize) {
      if (out.kind === 'place') setPreview({ rect: out.rect, clue: out.clue, bad: false });
      else setPreview({ rect: resizeRect(d.resize.base, d.resize.clue, d.cur, n, patchesRef.current, clues), clue: d.resize.clue, bad: true });
    } else setPreview({ rect: d.box, clue: -1, bad: out.kind === 'multi' });
  };

  /** Closes the "Oops!" card and deletes the bad patch (a resized patch disappears: one undo step). */
  const dismissOops = () => {
    const o = oopsRef.current;
    if (!o) return;
    setOops(null);
    if (patchesRef.current[o.clue]) {
      const next = patchesRef.current.slice();
      next[o.clue] = null;
      commit(next);
    }
  };
  const dismissOopsRef = useRef(dismissOops);
  dismissOopsRef.current = dismissOops;

  const cancelDrag = () => {
    drag.current = null;
    setPreview(null);
    setResizing(null);
  };

  const removeAt = (cell: number) => {
    const r = Math.floor(cell / n);
    const c = cell % n;
    const at = patchesRef.current.findIndex((p) => p && rectContains(p, r, c));
    if (at < 0) return;
    const next = patchesRef.current.slice();
    next[at] = null;
    commit(next);
  };

  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (locked) return;
    if (oopsRef.current) {
      // Any tap on the board first clears the error (and does nothing else).
      e.preventDefault();
      if (!drag.current) dismissOops();
      return;
    }
    if (e.pointerType === 'mouse' && e.button === 2) {
      // Right-click: cancel the drag in progress, or remove the patch under the cursor.
      e.preventDefault();
      if (drag.current) cancelDrag();
      else {
        const cell = cellFromPoint(e.clientX, e.clientY, false);
        if (cell >= 0) removeAt(cell);
      }
      return;
    }
    if (drag.current) return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    const cell = cellFromPoint(e.clientX, e.clientY, false);
    if (cell < 0) return;
    e.preventDefault();
    setHint(null);
    setFlash(null);
    const box = cellBox(cell, n);
    const on = patchAt(patchesRef.current, cell, n);
    const d = {
      pointerId: e.pointerId,
      start: cell,
      cur: cell,
      box,
      moved: false,
      resize: on >= 0 ? { clue: on, base: patchesRef.current[on]! } : null,
    };
    drag.current = d;
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // ignore
    }
    // Resizes show nothing until the pointer leaves the start cell (a plain tap removes the patch).
    if (!d.resize) updatePreview(d);
  };

  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d || d.pointerId !== e.pointerId) return;
    const cell = cellFromPoint(e.clientX, e.clientY, true);
    if (cell === d.cur) return;
    d.cur = cell;
    d.moved = true;
    // Every cell you drag through joins the box, but it never grows over a drawn patch or takes in
    // a second clue (LinkedIn).
    if (!d.resize) d.box = clampGrow(d.box, cell, n, patchesRef.current, -1, clues);
    if (d.resize) setResizing(d.resize.clue);
    updatePreview(d);
  };

  const place = (rect: Rect, clue: number) => {
    const next = patchesRef.current.map((p) => (p && rectsOverlap(p, rect) ? null : p));
    next[clue] = rect;
    commit(next);
    setFresh(clue);
  };

  const onPointerUp = (e: ReactPointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d || d.pointerId !== e.pointerId) return;
    drag.current = null;
    setPreview(null);
    setResizing(null);
    if (locked) return;
    if (!d.moved) {
      // Tap: remove the patch under the finger (there are no 1-cell patches).
      removeAt(d.start);
      return;
    }
    // Releasing off the board still draws: the drag is clamped to the edge cells, as in LinkedIn.
    if (!d.resize && rectArea(d.box) < 2) return; // blocked right away by a patch: nothing drawn
    const out = outcomeOf(d);
    if (out.kind !== 'place') {
      const rect = d.resize ? resizeRect(d.resize.base, d.resize.clue, d.cur, n, patchesRef.current, clues) : d.box;
      setShake(rect);
      later(() => setShake(null), 450);
      toast(out.kind === 'none' ? t.needsOneClue : t.onlyOneClue);
      return;
    }
    if (d.resize && sameRect(out.rect, d.resize.base)) return; // dragged back inside: no change
    const problem = fitProblem(out.rect, clues[out.clue], n);
    if (problem) {
      setOops({ clue: out.clue, rect: out.rect, problem });
      return;
    }
    place(out.rect, out.clue);
  };

  const onPointerCancel = (e: ReactPointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d || d.pointerId !== e.pointerId) return;
    drag.current = null;
    setPreview(null);
    setResizing(null);
  };

  // Win check.
  useEffect(() => {
    if (completeRef.current) return;
    let area = 0;
    for (let i = 0; i < clues.length; i++) {
      const p = patches[i];
      if (!p || !fitsClue(p, clues[i])) return;
      area += (p.r1 - p.r0 + 1) * (p.c1 - p.c0 + 1);
    }
    if (area !== n * n) return;
    completeRef.current = true;
    setWon(true);
    setHint(null);
    onComplete({ won: true, share: `🟥🟦🟨 Patches ${n}×${n}` });
  }, [patches, clues, n, onComplete]);

  const undo = () => {
    if (locked) return;
    if (oopsRef.current) {
      // The bad patch was never committed: undoing it restores the board as it was before the drag.
      setOops(null);
      return;
    }
    if (!history.length) return;
    setHint(null);
    setFlash(null);
    setPatches(history[history.length - 1]);
    setHistory((h) => h.slice(0, -1));
  };
  const undoRef = useRef(undo);
  undoRef.current = undo;

  const clear = () => {
    if (locked) return;
    setOops(null);
    if (patchesRef.current.every((p) => !p)) return;
    setHint(null);
    setFlash(null);
    commit(clues.map(() => null));
  };

  const giveHint = () => {
    if (locked) return;
    dismissOops();
    const cur = patchesRef.current;
    onHint();
    // Any patch that isn't in the solution goes, all in one hint (undo brings them back).
    const wrong = cur.filter((p, i) => p && !sameRect(p, solution[i])).length;
    if (wrong > 0) {
      commit(cur.map((p, i) => (p && !sameRect(p, solution[i]) ? null : p)));
      setHint({ text: t.wrongPatches(wrong) });
      return;
    }
    const res = logicSolve(n, clues, cur);
    let pick = res.steps[0];
    if (!pick) {
      const i = cur.findIndex((p) => !p);
      if (i < 0) return;
      pick = { clue: i, rect: solution[i], reason: 'only', round: 0 };
    }
    place(solution[pick.clue], pick.clue);
    setFlash(pick.clue);
    later(() => setFlash((f) => (f === pick.clue ? null : f)), 1600);
    setHint({ text: t.reason[pick.reason] });
  };

  /** Patch colour; the charcoal clue gets a lighter tint so its patch doesn't read as a dark block. */
  const tint = (color: string): CSSProperties =>
    ({ ['--pc' as string]: cssColor(color), ...(color === INK ? { ['--patch-mix' as string]: 'var(--pa-ink-mix)' } : {}) }) as CSSProperties;

  const cells = [];
  for (let i = 0; i < n * n; i++) {
    const cls = [styles.cell, i % n < n - 1 ? styles.vLine : '', i < n * (n - 1) ? styles.hLine : ''].join(' ');
    cells.push(<div key={i} className={cls} />);
  }

  return (
    <div className={styles.wrap}>
      <div className={styles.boardWrap}>
      <div
        ref={boardRef}
        className={`${styles.board}${won ? ` ${styles.won}` : ''}`}
        style={{ ['--n' as string]: n } as CSSProperties}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerCancel}
        onContextMenu={(e) => e.preventDefault()}
        role="application"
        aria-label={t.boardLabel(n, patches.filter(Boolean).length, clues.length)}
      >
        <div className={styles.grid}>{cells}</div>
        <div className={styles.layer}>
          {patches.map((p, i) => {
            if (!p || i === resizing || i === oops?.clue) return null;
            const cls = [
              styles.patch,
              flash === i ? styles.flash : '',
              fresh === i ? styles.fresh : '',
            ].join(' ');
            return (
              <div
                key={`${i}-${p.r0}-${p.c0}-${p.r1}-${p.c1}`}
                className={cls}
                style={{ ...rectStyle(p, n), ...tint(clues[i].color), animationDelay: won ? `${i * 60}ms` : undefined }}
              >
                <div className={styles.patchInner} />
                <CellCount rect={p} clue={clues[i]} />
              </div>
            );
          })}
          {oops && (
            <div key={`oops-${oops.rect.r0}-${oops.rect.c0}-${oops.rect.r1}-${oops.rect.c1}`} className={`${styles.patch} ${styles.oopsPatch}`} style={{ ...rectStyle(oops.rect, n), ...tint(clues[oops.clue].color) }}>
              <div className={styles.patchInner} />
              <CellCount rect={oops.rect} clue={clues[oops.clue]} />
            </div>
          )}
          {preview && (
            <div
              className={`${styles.preview}${preview.bad ? ` ${styles.previewBad}` : ''}`}
              style={{ ...rectStyle(preview.rect, n), ...(preview.clue >= 0 ? tint(clues[preview.clue].color) : {}) }}
            >
              {/* Like LinkedIn, the size shows from the first cell you drag over, clue or not. */}
              <CellCount
                rect={preview.rect}
                clue={preview.clue >= 0 ? clues[preview.clue] : clues.find((k) => rectContains(preview.rect, k.r, k.c))}
              />
            </div>
          )}
          {shake && <div className={`${styles.preview} ${styles.previewBad} ${styles.shake}`} style={rectStyle(shake, n)} />}
          {clues.map((k, i) => (
            <ClueBadge
              key={i}
              clue={k}
              n={n}
              filled={!!patches[i] || oops?.clue === i}
              label={t.clueLabel(k.size ?? null, k.shape)}
            />
          ))}
        </div>
      </div>
      {oops && (
        <OopsCard
          oops={oops}
          clue={clues[oops.clue]}
          n={n}
          text={t.oops[oops.problem](clues[oops.clue].size ?? 0)}
          closeLabel={t.dismissOops}
          onDismiss={dismissOops}
        />
      )}
      </div>
      {hint && <HintBubble onDismiss={() => setHint(null)}>{hint.text}</HintBubble>}
      <ControlBar>
        <ControlButton icon={<Undo size={18} />} label={t.undo} onClick={undo} disabled={locked || (history.length === 0 && !oops)} />
        <ControlButton icon={<Bulb size={18} />} label={t.hint} onClick={giveHint} disabled={locked} />
        <ControlButton icon={<Eraser size={18} />} label={t.clear} onClick={clear} disabled={locked || (patches.every((p) => !p) && !oops)} />
      </ControlBar>
    </div>
  );
}

/**
 * LinkedIn shows each patch's cell count in a small box at its center. When the center lands on
 * the clue's own cell, nudge it half a cell along the patch's longer side so it doesn't cover the clue.
 */
function CellCount({ rect, clue }: { rect: Rect; clue?: Clue }) {
  const w = rect.c1 - rect.c0 + 1;
  const h = rect.r1 - rect.r0 + 1;
  let x = 50;
  let y = 50;
  const midC = rect.c0 + (w - 1) / 2;
  const midR = rect.r0 + (h - 1) / 2;
  if (clue && midC === clue.c && midR === clue.r) {
    if (w >= h) x += (50 / w) * (clue.c < rect.c1 ? 1 : -1);
    else y += (50 / h) * (clue.r < rect.r1 ? 1 : -1);
  }
  return (
    <span className={styles.count} style={{ left: `${x}%`, top: `${y}%` }} aria-hidden>
      {w * h}
    </span>
  );
}

/**
 * LinkedIn's "Oops!" card. Clicking anywhere on it (or its ✕) closes it and deletes the bad patch.
 * It sits just below the clue (above it near the bottom edge), aligned with the patch's left side.
 */
function OopsCard({
  oops,
  clue,
  n,
  text,
  closeLabel,
  onDismiss,
}: {
  oops: OopsState;
  clue: Clue;
  n: number;
  text: string;
  closeLabel: string;
  onDismiss(): void;
}) {
  const u = 100 / n;
  const width = 68;
  const left = Math.min(100 - width - 2, Math.max(2, oops.rect.c0 * u + 1.5));
  const below = clue.r < n - 2;
  const pos: CSSProperties = below ? { top: `${(clue.r + 0.9) * u}%` } : { bottom: `${(n - clue.r - 0.1) * u}%` };
  return (
    <div
      className={styles.oops}
      style={{ ...pos, left: `${left}%`, width: `${width}%` }}
      role="alert"
      onClick={onDismiss}
    >
      <p>{text}</p>
      <button type="button" className={styles.oopsClose} aria-label={closeLabel}>
        <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden>
          <path d="M6 6l12 12M18 6L6 18" />
        </svg>
      </button>
    </div>
  );
}

/** "Any shape" icon, as in LinkedIn: a wide and a tall rounded rectangle crossing (100×100 box). */
const ARM = 17; // how far the crossing bar is inset from the edges
const BAR_RADIUS = 8;

function ClueBadge({ clue, n, filled, label }: { clue: Clue; n: number; filled: boolean; label: string }) {
  const shapeCls = { wide: styles.bWide, tall: styles.bTall, square: styles.bSquare, any: styles.bAny }[clue.shape];
  const cls = [styles.badge, shapeCls, filled ? styles.bFilled : '', clue.size != null && clue.size >= 10 ? styles.twoDigits : ''].join(' ');
  return (
    <div className={styles.clueCell} style={rectStyle({ r0: clue.r, c0: clue.c, r1: clue.r, c1: clue.c }, n)} aria-label={label}>
      <div className={cls} style={{ ['--pc' as string]: cssColor(clue.color) } as CSSProperties}>
        {clue.shape === 'any' && (
          <svg className={styles.plus} viewBox="0 0 100 100" aria-hidden>
            <rect x="0" y={ARM} width="100" height={100 - 2 * ARM} rx={BAR_RADIUS} />
            <rect x={ARM} y="0" width={100 - 2 * ARM} height="100" rx={BAR_RADIUS} />
          </svg>
        )}
        {clue.size != null && <span>{clue.size}</span>}
      </div>
    </div>
  );
}
