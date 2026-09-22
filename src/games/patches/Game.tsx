import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties, PointerEvent as ReactPointerEvent } from 'react';
import type { GameProps } from '../../core/types';
import { ControlBar, ControlButton, HintBubble } from '../../core/components/Controls';
import { Bulb, Eraser, Undo } from '../../core/components/Icons';
import { toast } from '../../core/components/Toast';
import { fitsClue, generatePatches, logicSolve, rectContains, rectsOverlap, sameRect, type Clue, type Rect, type Reason } from './generator';
import styles from './Game.module.css';

type Patches = (Rect | null)[];

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
  const drag = useRef<{ pointerId: number; start: number; cur: number } | null>(null);
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

  const cluesIn = (r: Rect) => clues.map((k, i) => (rectContains(r, k.r, k.c) ? i : -1)).filter((i) => i >= 0);

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

  const updatePreview = (a: number, b: number) => {
    const rect = normRect(a, b, n);
    const inside = cluesIn(rect);
    setPreview({ rect, clue: inside.length === 1 ? inside[0] : -1, bad: inside.length > 1 });
  };

  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (locked || drag.current) return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    const cell = cellFromPoint(e.clientX, e.clientY, false);
    if (cell < 0) return;
    e.preventDefault();
    setHint(null);
    setFlash(null);
    drag.current = { pointerId: e.pointerId, start: cell, cur: cell };
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // ignore
    }
    updatePreview(cell, cell);
  };

  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d || d.pointerId !== e.pointerId) return;
    const cell = cellFromPoint(e.clientX, e.clientY, true);
    if (cell === d.cur) return;
    d.cur = cell;
    updatePreview(d.start, cell);
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
    if (locked) return;
    const rect = normRect(d.start, d.cur, n);
    const inside = cluesIn(rect);
    if (d.start === d.cur) {
      // Tap: remove the patch under the finger, or place a 1×1 patch where the clue allows it.
      const r = Math.floor(d.start / n);
      const c = d.start % n;
      const at = patchesRef.current.findIndex((p) => p && rectContains(p, r, c));
      if (at >= 0) {
        const next = patchesRef.current.slice();
        next[at] = null;
        commit(next);
      } else if (inside.length === 1 && fitsClue(rect, clues[inside[0]])) {
        place(rect, inside[0]);
      }
      return;
    }
    if (inside.length !== 1) {
      setShake(rect);
      later(() => setShake(null), 450);
      toast(inside.length === 0 ? 'A patch needs exactly one clue' : 'A patch can only hold one clue');
      return;
    }
    place(rect, inside[0]);
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
        role="application"
        aria-label={`Patches board, ${n} by ${n}. ${patches.filter(Boolean).length} of ${clues.length} patches placed.`}
      >
        <div className={styles.grid}>{cells}</div>
        <div className={styles.layer}>
          {patches.map((p, i) => {
            if (!p) return null;
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
        {clue.size != null && <span>{clue.size}</span>}
      </div>
    </div>
  );
}
