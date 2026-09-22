import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties, PointerEvent as ReactPointerEvent } from 'react';
import type { GameProps } from '../../core/types';
import { ControlBar, ControlButton, HintBubble } from '../../core/components/Controls';
import { Bulb, Eraser, Undo } from '../../core/components/Icons';
import { toast } from '../../core/components/Toast';
import { fitsClue, generatePatches, logicSolve, rectContains, rectsOverlap, sameRect, type Clue, type Rect, type Reason } from './generator';
import { patchAt, resolveNew, resolveResize, type DrawOutcome, type Patches } from './draw';
import styles from './Game.module.css';


const REASON_TEXT: Record<Reason, string> = {
  only: 'This clue only fits in one place.',
  claimed: 'The patches around it already claim the other cells it could use, so this clue only fits in one place.',
  reach: 'Some cells here can only be reached by this clue, which leaves just one patch that works.',
};

function normRect(a: number, b: number, n: number): Rect {
  const ar = Math.floor(a / n);
  const ac = a % n;
  const br = Math.floor(b / n);
  const bc = b % n;
  return { r0: Math.min(ar, br), c0: Math.min(ac, bc), r1: Math.max(ar, br), c1: Math.max(ac, bc) };
}

/** Grow a rectangle so it also covers `cell` (LinkedIn: every cell you drag through joins the patch). */
function extendRect(r: Rect, cell: number, n: number): Rect {
  const cr = Math.floor(cell / n);
  const cc = cell % n;
  return { r0: Math.min(r.r0, cr), c0: Math.min(r.c0, cc), r1: Math.max(r.r1, cr), c1: Math.max(r.c1, cc) };
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

export default function Game({ seed, options, paused, onReady, onHint, onComplete }: GameProps) {
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
    setHistory((h) => [...h, patchesRef.current]);
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

  /** More than half a cell outside the board. */
  const releasedOffBoard = (x: number, y: number): boolean => {
    const el = boardRef.current;
    if (!el) return false;
    const b = el.getBoundingClientRect();
    const m = b.width / n / 2;
    return x < b.left - m || x > b.right + m || y < b.top - m || y > b.bottom + m;
  };

  // Escape cancels a drag; Cmd/Ctrl+Z undoes.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (document.querySelector('.lp-modal-backdrop')) return;
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
    d.resize ? resolveResize(clues, d.resize.base, d.resize.clue, d.cur, n) : resolveNew(clues, d.box);

  /** Shows what releasing would produce; a resized patch shows its new size in its own color. */
  const updatePreview = (d: NonNullable<typeof drag.current>) => {
    const out = outcomeOf(d);
    if (out.kind === 'place') setPreview({ rect: out.rect, clue: out.clue, bad: false });
    else if (d.resize) setPreview({ rect: extendTo(d.resize.base, d.cur), clue: d.resize.clue, bad: true });
    else setPreview({ rect: d.box, clue: -1, bad: out.kind === 'multi' });
  };

  const extendTo = (base: Rect, cell: number): Rect => extendRect(base, cell, n);

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
    const box = normRect(cell, cell, n);
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
    d.box = extendRect(d.box, cell, n);
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
    if (releasedOffBoard(e.clientX, e.clientY)) return; // drag off the board to cancel
    const out = outcomeOf(d);
    if (out.kind !== 'place') {
      const rect = d.resize ? extendTo(d.resize.base, d.cur) : d.box;
      setShake(rect);
      later(() => setShake(null), 450);
      toast(out.kind === 'none' ? 'A patch needs exactly one clue' : 'A patch can only hold one clue');
      return;
    }
    if (d.resize && sameRect(out.rect, d.resize.base)) return; // dragged back inside: no change
    place(out.rect, out.clue);
  };

  const onPointerCancel = (e: ReactPointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d || d.pointerId !== e.pointerId) return;
    drag.current = null;
    setPreview(null);
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
    if (locked || !history.length) return;
    setHint(null);
    setFlash(null);
    setPatches(history[history.length - 1]);
    setHistory((h) => h.slice(0, -1));
  };
  const undoRef = useRef(undo);
  undoRef.current = undo;

  const clear = () => {
    if (locked || patchesRef.current.every((p) => !p)) return;
    setHint(null);
    setFlash(null);
    commit(clues.map(() => null));
  };

  const giveHint = () => {
    if (locked) return;
    const cur = patchesRef.current;
    onHint();
    const wrong = cur.findIndex((p, i) => p && !sameRect(p, solution[i]));
    if (wrong >= 0) {
      setFlash(wrong);
      later(() => setFlash((f) => (f === wrong ? null : f)), 2400);
      setHint({ text: 'This patch isn’t right. Try removing it and drawing it again.' });
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
    setHint({ text: REASON_TEXT[pick.reason] });
  };

  const tint = (color: string): CSSProperties => ({ ['--pc' as string]: color }) as CSSProperties;

  const cells = [];
  for (let i = 0; i < n * n; i++) cells.push(<div key={i} className={styles.cell} />);

  return (
    <div className={styles.wrap}>
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
        aria-label={`Patches board, ${n} by ${n}. ${patches.filter(Boolean).length} of ${clues.length} patches placed.`}
      >
        <div className={styles.grid}>{cells}</div>
        <div className={styles.layer}>
          {patches.map((p, i) => {
            if (!p || i === resizing) return null;
            const ok = fitsClue(p, clues[i]);
            const cls = [
              styles.patch,
              ok ? '' : styles.invalid,
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
              </div>
            );
          })}
          {preview && (
            <div
              className={`${styles.preview}${preview.bad ? ` ${styles.previewBad}` : ''}`}
              style={{ ...rectStyle(preview.rect, n), ...(preview.clue >= 0 ? tint(clues[preview.clue].color) : {}) }}
            />
          )}
          {shake && <div className={`${styles.preview} ${styles.previewBad} ${styles.shake}`} style={rectStyle(shake, n)} />}
          {clues.map((k, i) => (
            <ClueBadge key={i} clue={k} n={n} />
          ))}
        </div>
      </div>
      {hint && <HintBubble onDismiss={() => setHint(null)}>{hint.text}</HintBubble>}
      <ControlBar>
        <ControlButton icon={<Undo size={18} />} label="Undo" onClick={undo} disabled={locked || history.length === 0} />
        <ControlButton icon={<Bulb size={18} />} label="Hint" onClick={giveHint} disabled={locked} />
        <ControlButton icon={<Eraser size={18} />} label="Clear" onClick={clear} disabled={locked || patches.every((p) => !p)} />
      </ControlBar>
    </div>
  );
}

function ClueBadge({ clue, n }: { clue: Clue; n: number }) {
  const shapeCls = clue.shape === 'wide' ? styles.bWide : clue.shape === 'tall' ? styles.bTall : styles.bSquare;
  const label =
    `${clue.size != null ? `${clue.size} cells` : 'any size'}, ` + (clue.shape === 'any' ? 'any shape' : `${clue.shape} shape`);
  return (
    <div className={styles.clueCell} style={rectStyle({ r0: clue.r, c0: clue.c, r1: clue.r, c1: clue.c }, n)} aria-label={`Clue: ${label}`}>
      <div className={`${styles.badge} ${shapeCls}${clue.shape === 'any' ? ` ${styles.bAny}` : ''}`} style={{ ['--pc' as string]: clue.color } as CSSProperties}>
        {clue.size != null ? (
          <span>{clue.size}</span>
        ) : clue.shape === 'any' ? (
          <svg className={styles.anyIcon} viewBox="0 0 24 24" aria-hidden>
            <rect x="2.5" y="3" width="7.5" height="18" rx="1.8" />
            <rect x="12.5" y="8" width="9" height="8" rx="1.8" />
          </svg>
        ) : null}
      </div>
    </div>
  );
}
