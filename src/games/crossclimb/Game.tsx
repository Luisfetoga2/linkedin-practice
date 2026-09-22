import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import type { GameProps } from '../../core/types';
import { ControlBar, ControlButton } from '../../core/components/Controls';
import { Bulb, Check } from '../../core/components/Icons';
import { useGameSetting } from '../../lib/settings';
import type { WordLength } from './data';
import { generateLadder, isLadder, MIDDLE, oneApart, RUNGS } from './generator';
import { Keyboard } from './Keyboard';
import styles from './Game.module.css';

type Phase = 'clues' | 'order' | 'final' | 'done';

/** Vertical gap between rungs in px (mirrored by --cc-gap in the CSS module). */
const GAP = 8;
const MIDS = [1, 2, 3, 4, 5];

interface DragState {
  w: number;
  from: number;
  dy: number;
  pitch: number;
  startY: number;
  pointerId: number;
  moved: boolean;
}

function cx(...parts: (string | false | null | undefined)[]): string {
  return parts.filter(Boolean).join(' ');
}

function moveItem<T>(list: readonly T[], from: number, to: number): T[] {
  const out = list.slice();
  const [item] = out.splice(from, 1);
  out.splice(to, 0, item);
  return out;
}

function dragTarget(d: DragState): number {
  return Math.max(0, Math.min(MIDDLE - 1, Math.round(d.from + d.dy / d.pitch)));
}

export default function Game({ seed, options, paused, onReady, onHint, onComplete }: GameProps) {
  const length: WordLength = options.length === '5' ? 5 : 4;
  const N = length;
  const ladder = useMemo(() => generateLadder(seed, length), [seed, length]);
  const { words, clues } = ladder;
  const [showLinks] = useGameSetting<boolean>('crossclimb', 'links', false);

  const [order, setOrder] = useState<number[]>(ladder.order);
  const [entries, setEntries] = useState<string[][]>(() => words.map(() => Array<string>(N).fill('')));
  const [given, setGiven] = useState<boolean[][]>(() => words.map(() => Array<boolean>(N).fill(false)));
  const [sel, setSel] = useState<{ w: number; c: number }>({ w: ladder.order[0], c: 0 });
  const [note, setNote] = useState<ReactNode>(null);
  const [flagged, setFlagged] = useState<number | null>(null);
  const [drag, setDrag] = useState<DragState | null>(null);
  const dragRef = useRef<DragState | null>(null);
  const rowEls = useRef(new Map<string, HTMLElement>());
  const readyRef = useRef(false);
  const doneRef = useRef(false);

  // ---- derived state -------------------------------------------------------
  const isSolved = (w: number, ent = entries) => ent[w].join('') === words[w];
  const solved = words.map((_, i) => isSolved(i));
  const midsSolved = MIDS.every((i) => solved[i]);
  const orderOk = isLadder(order.map((i) => words[i]));
  const forward = order[0] === 1;
  const topW = forward ? 0 : RUNGS - 1;
  const botW = forward ? RUNGS - 1 : 0;
  const phase: Phase = !midsSolved ? 'clues' : !orderOk ? 'order' : !(solved[0] && solved[RUNGS - 1]) ? 'final' : 'done';
  const unlocked = phase === 'final' || phase === 'done';

  const editable = (w: number, ent = entries): boolean => {
    if (phase === 'clues') return w >= 1 && w <= MIDDLE && !isSolved(w, ent);
    if (phase === 'final') return (w === 0 || w === RUNGS - 1) && !isSolved(w, ent);
    return false;
  };
  const selectableSeq = (): number[] => {
    if (phase === 'clues' || phase === 'order') return order;
    if (phase === 'final') return [topW, botW];
    return [];
  };

  useEffect(() => {
    if (readyRef.current) return;
    readyRef.current = true;
    onReady();
  }, [onReady]);

  // ---- helpers ---------------------------------------------------------------
  const nextOpenCol = (w: number, from: number): number => {
    for (let c = from; c < N; c++) if (!given[w][c]) return c;
    return -1;
  };
  const firstEmptyCol = (w: number, ent = entries): number => {
    for (let c = 0; c < N; c++) if (!ent[w][c] && !given[w][c]) return c;
    const open = nextOpenCol(w, 0);
    return open < 0 ? 0 : open;
  };

  const animateRow = (key: string, kind: 'shake' | 'pop') => {
    const el = rowEls.current.get(key)?.querySelector(`.${styles.cells}`) as HTMLElement | null;
    if (!el?.animate) return;
    if (kind === 'shake') {
      el.animate(
        [
          { transform: 'translateX(0)' },
          { transform: 'translateX(-7px)' },
          { transform: 'translateX(6px)' },
          { transform: 'translateX(-4px)' },
          { transform: 'translateX(3px)' },
          { transform: 'translateX(0)' },
        ],
        { duration: 380, easing: 'ease-out' },
      );
    } else {
      el.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.045)' }, { transform: 'scale(1)' }], { duration: 320, easing: 'ease-out' });
    }
  };

  /** Move the cursor to the next unsolved row (display order), wrapping around. */
  const advanceFrom = (w: number, ent: string[][], seq: number[]) => {
    const idx = seq.indexOf(w);
    for (let k = 1; k <= seq.length; k++) {
      const cand = seq[(idx + k + seq.length) % seq.length];
      if (!isSolved(cand, ent)) {
        setSel({ w: cand, c: firstEmptyCol(cand, ent) });
        return;
      }
    }
  };

  const rowKey = (w: number) => (unlocked && w === topW ? 'T' : unlocked && w === botW ? 'B' : String(w));

  const afterFill = (w: number, row: string[], ent: string[][], col: number) => {
    if (row.every(Boolean)) {
      if (row.join('') === words[w]) {
        animateRow(rowKey(w), 'pop');
        advanceFrom(w, ent, selectableSeq());
        return;
      }
      animateRow(rowKey(w), 'shake');
    }
    setSel({ w, c: col });
  };

  // ---- input actions -----------------------------------------------------------
  const typeLetter = (ch: string) => {
    const w = sel.w;
    if (!editable(w)) return;
    let c = sel.c;
    if (given[w][c]) c = nextOpenCol(w, c);
    if (c < 0) return;
    const row = entries[w].slice();
    row[c] = ch;
    const ent = entries.map((r, i) => (i === w ? row : r));
    setEntries(ent);
    setNote(null);
    const nc = nextOpenCol(w, c + 1);
    afterFill(w, row, ent, nc < 0 ? c : nc);
  };

  const backspace = () => {
    const w = sel.w;
    if (!editable(w)) return;
    const row = entries[w].slice();
    let c = sel.c;
    if (row[c] && !given[w][c]) row[c] = '';
    else {
      let p = c - 1;
      while (p >= 0 && given[w][p]) p--;
      if (p < 0) return;
      row[p] = '';
      c = p;
    }
    setEntries(entries.map((r, i) => (i === w ? row : r)));
    setSel({ w, c });
    setNote(null);
  };

  const stepRow = (delta: number) => {
    const seq = selectableSeq();
    if (!seq.length) return;
    const idx = seq.indexOf(sel.w);
    const next = seq[(Math.max(idx, 0) + delta + seq.length) % seq.length];
    setSel({ w: next, c: editable(next) ? firstEmptyCol(next) : 0 });
    setNote(null);
  };

  const commitMove = (from: number, to: number) => {
    if (from === to) return;
    setOrder(moveItem(order, from, to));
    setFlagged(null);
    setNote(null);
  };

  const moveSelected = (delta: number) => {
    if (!(phase === 'clues' || phase === 'order')) return;
    const from = order.indexOf(sel.w);
    if (from < 0) return;
    const to = from + delta;
    if (to < 0 || to >= MIDDLE) return;
    commitMove(from, to);
  };

  const selectCell = (w: number, c: number) => {
    if (paused) return;
    const seq = selectableSeq();
    if (!seq.includes(w)) return;
    setSel({ w, c });
    setNote(null);
  };

  const hint = () => {
    if (paused) return;
    if (phase === 'clues' || phase === 'final') {
      const seq = selectableSeq();
      const w = editable(sel.w) ? sel.w : seq.find((i) => !solved[i]);
      if (w === undefined) return;
      const cur = entries[w];
      let c = cur.findIndex((ch, i) => ch !== '' && ch !== words[w][i]);
      const fixingMistake = c >= 0;
      if (c < 0) c = cur.findIndex((ch, i) => ch !== words[w][i]);
      if (c < 0) return;
      const row = cur.slice();
      row[c] = words[w][c];
      const ent = entries.map((r, i) => (i === w ? row : r));
      setEntries(ent);
      setGiven(given.map((r, i) => (i === w ? r.map((v, j) => v || j === c) : r)));
      onHint();
      setNote(fixingMistake ? `Fixed a wrong letter (box ${c + 1})` : null);
      if (row.join('') === words[w]) {
        animateRow(rowKey(w), 'pop');
        advanceFrom(w, ent, seq);
      } else {
        let nc = -1;
        for (let i = 0; i < N; i++) if (!row[i] && i !== c) { nc = i; break; }
        setSel({ w, c: nc < 0 ? c : nc });
      }
      return;
    }
    if (phase === 'order') {
      const ws = order.map((i) => words[i]);
      const link = (k: number) => oneApart(ws[k], ws[k + 1]);
      const lonely = order.filter((_, k) => !(k > 0 && link(k - 1)) && !(k < MIDDLE - 1 && link(k)));
      const fwd = MIDS;
      const rev = [...MIDS].reverse();
      const score = (t: number[]) => order.reduce((n, v, i) => n + (v === t[i] ? 1 : 0), 0);
      const target = score(fwd) >= score(rev) ? fwd : rev;
      const misplaced = order.filter((v, i) => v !== target[i]);
      const pick = lonely.find((v) => misplaced.includes(v)) ?? lonely[0] ?? misplaced[0];
      if (pick === undefined) return;
      setFlagged(pick);
      setSel({ w: pick, c: 0 });
      setNote("This row doesn't belong here. Try moving it.");
      onHint();
    }
  };

  // ---- keyboard ---------------------------------------------------------------
  const onKey = (key: string, shift = false) => {
    if (paused || phase === 'done') return;
    if (/^[A-Z]$/.test(key)) typeLetter(key);
    else if (key === 'Backspace') backspace();
    else if (key === 'Enter') advanceFrom(sel.w, entries, selectableSeq());
    else if (key === 'ArrowLeft') setSel({ w: sel.w, c: Math.max(0, sel.c - 1) });
    else if (key === 'ArrowRight') setSel({ w: sel.w, c: Math.min(N - 1, sel.c + 1) });
    else if (key === 'ArrowUp') {
      if (shift) moveSelected(-1);
      else stepRow(-1);
    } else if (key === 'ArrowDown') {
      if (shift) moveSelected(1);
      else stepRow(1);
    }
  };
  const keyHandler = useRef(onKey);
  keyHandler.current = onKey;
  useEffect(() => {
    const fn = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const t = e.target as HTMLElement | null;
      if (t?.closest?.('input, textarea, select, .lp-modal')) return;
      if ((e.key === 'Enter' || e.key === ' ') && t?.closest?.('button, a')) return;
      const key = e.key.length === 1 ? e.key.toUpperCase() : e.key;
      if (/^[A-Z]$/.test(key) || ['Backspace', 'Enter', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(key)) {
        e.preventDefault();
        keyHandler.current(key, e.shiftKey);
      }
    };
    window.addEventListener('keydown', fn);
    return () => window.removeEventListener('keydown', fn);
  }, []);

  // ---- phase transitions --------------------------------------------------------
  const prevPhase = useRef<Phase>(phase);
  useEffect(() => {
    const from = prevPhase.current;
    if (from === phase) return;
    prevPhase.current = phase;
    setFlagged(null);
    if (phase === 'order') setNote(null);
    if (phase === 'final') {
      setNote(null);
      setSel({ w: topW, c: firstEmptyCol(topW) });
    }
    if (phase === 'done' && !doneRef.current) {
      doneRef.current = true;
      const seqWords = [topW, ...order, botW].map((i) => words[i]);
      celebrate();
      onComplete({
        won: true,
        share: `🪜 Crossclimb ${length} letters`,
        summary: (
          <div className={styles.summary}>
            <span className={styles.summaryLabel}>The ladder</span>
            <div className={styles.summaryWords}>
              {seqWords.map((w, i) => (
                <span key={i}>{w}</span>
              ))}
            </div>
          </div>
        ),
      });
    }
  }, [phase]);

  const celebrate = () => {
    const keys = ['T', ...order.map(String), 'B'];
    keys.forEach((k, r) => {
      const cells = rowEls.current.get(k)?.querySelectorAll(`.${styles.cell}`);
      cells?.forEach((cell, c) => {
        (cell as HTMLElement).animate?.(
          [
            { transform: 'rotateX(0deg)' },
            { transform: 'rotateX(90deg)', offset: 0.5 },
            { transform: 'rotateX(0deg)' },
          ],
          { duration: 520, delay: r * 90 + c * 40, easing: 'ease-in-out' },
        );
      });
    });
  };

  // ---- dragging -----------------------------------------------------------------
  const canDrag = !paused && (phase === 'clues' || phase === 'order');

  const onDragDown = (e: React.PointerEvent, w: number) => {
    if (!canDrag) return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    const el = rowEls.current.get(String(w));
    const pitch = (el?.offsetHeight ?? 48) + GAP;
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
    const d: DragState = { w, from: order.indexOf(w), dy: 0, pitch, startY: e.clientY, pointerId: e.pointerId, moved: false };
    dragRef.current = d;
    setDrag(d);
  };
  const onDragMove = (e: React.PointerEvent) => {
    const d = dragRef.current;
    if (!d || e.pointerId !== d.pointerId) return;
    const min = -d.from * d.pitch - d.pitch * 0.35;
    const max = (MIDDLE - 1 - d.from) * d.pitch + d.pitch * 0.35;
    const dy = Math.max(min, Math.min(max, e.clientY - d.startY));
    const nd = { ...d, dy, moved: d.moved || Math.abs(dy) > 4 };
    dragRef.current = nd;
    setDrag(nd);
  };
  const onDragEnd = (e: React.PointerEvent, commit: boolean) => {
    const d = dragRef.current;
    if (!d || e.pointerId !== d.pointerId) return;
    dragRef.current = null;
    setDrag(null);
    if (!d.moved) {
      if (commit) selectCell(d.w, sel.w === d.w ? sel.c : editable(d.w) ? firstEmptyCol(d.w) : 0);
      return;
    }
    if (commit) {
      commitMove(d.from, dragTarget(d));
      setSel((s) => (s.w === d.w ? s : { w: d.w, c: editable(d.w) ? firstEmptyCol(d.w) : 0 }));
    }
  };
  const dragHandlers = (w: number) => ({
    onPointerDown: (e: React.PointerEvent) => onDragDown(e, w),
    onPointerMove: onDragMove,
    onPointerUp: (e: React.PointerEvent) => onDragEnd(e, true),
    onPointerCancel: (e: React.PointerEvent) => onDragEnd(e, false),
  });

  const preview = drag && drag.moved ? moveItem(order, drag.from, dragTarget(drag)) : order;

  // ---- rendering ----------------------------------------------------------------
  const renderCells = (w: number | null, active: boolean) =>
    Array.from({ length: N }, (_, c) => {
      const ch = w === null ? '' : entries[w][c];
      const isActive = active && w !== null && sel.c === c && editable(w);
      return (
        <div
          key={c}
          className={cx(styles.cell, isActive && styles.cellActive, w !== null && given[w][c] && styles.cellGiven, ch && styles.cellFilled)}
          onClick={(e) => {
            if (w === null) return;
            e.stopPropagation();
            selectCell(w, c);
          }}
          aria-label={ch ? `Letter ${c + 1}: ${ch}` : `Letter ${c + 1}: empty`}
        >
          {ch}
        </div>
      );
    });

  const lockIcon = (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
      <rect x="5" y="11" width="14" height="10" rx="2" />
      <path d="M8 11V8a4 4 0 018 0v3" />
    </svg>
  );
  const gripIcon = (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden>
      <path d="M5 8h14M5 12h14M5 16h14" />
    </svg>
  );

  const renderEnd = (slot: 'T' | 'B') => {
    const w = unlocked ? (slot === 'T' ? topW : botW) : null;
    const isSel = w !== null && sel.w === w && phase === 'final';
    const done = w !== null && solved[w];
    return (
      <div
        key={slot}
        ref={(el) => {
          if (el) rowEls.current.set(slot, el);
          else rowEls.current.delete(slot);
        }}
        className={cx(styles.row, styles.endRow, !unlocked && styles.rowLocked, unlocked && styles.rowUnlock, isSel && styles.rowSel, done && styles.rowSolved)}
        onClick={() => w !== null && selectCell(w, sel.w === w ? sel.c : firstEmptyCol(w))}
        aria-label={unlocked ? `${slot === 'T' ? 'Top' : 'Bottom'} rung${done ? ', solved' : ''}` : `${slot === 'T' ? 'Top' : 'Bottom'} rung, locked`}
      >
        <span className={styles.side}>{done && <Check size={18} />}</span>
        <div className={styles.cells}>{renderCells(w, isSel)}</div>
        <span className={cx(styles.side, styles.lock)}>{!unlocked && lockIcon}</span>
      </div>
    );
  };

  const selectedClue = (() => {
    if (phase === 'order')
      return (
        <>
          <strong className={styles.clueStrong}>Great! Now drag the rows into the right order</strong>
          {!note && <span className={styles.clueSub}>Neighbors must differ by exactly one letter</span>}
        </>
      );
    if (phase === 'done') return <strong className={styles.clueStrong}>You climbed the whole ladder!</strong>;
    if (phase === 'final') {
      const label = sel.w === topW ? 'Top rung' : 'Bottom rung';
      return (
        <>
          <span className={styles.clueLabel}>{label} unlocked</span>
          <span className={styles.clueText}>{clues[sel.w]}</span>
        </>
      );
    }
    return <span className={styles.clueText}>{clues[sel.w]}</span>;
  })();

  const showArrows = phase === 'clues' || phase === 'final';
  const ladderStyle = { '--cc-n': N } as CSSProperties;

  return (
    <div className={cx(styles.wrap, phase === 'done' && styles.won)} style={ladderStyle}>
      <div className={styles.clueCard} aria-live="polite">
        {showArrows && (
          <button type="button" className={styles.arrow} onClick={() => stepRow(-1)} aria-label="Previous clue" disabled={paused}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M15 5l-7 7 7 7" />
            </svg>
          </button>
        )}
        <div className={styles.clueBody}>
          {selectedClue}
          {note && (
            <span className={styles.note}>
              <Bulb size={14} /> {note}
            </span>
          )}
        </div>
        {showArrows && (
          <button type="button" className={styles.arrow} onClick={() => stepRow(1)} aria-label="Next clue" disabled={paused}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M9 5l7 7-7 7" />
            </svg>
          </button>
        )}
      </div>

      <div className={styles.ladder} role="group" aria-label="Word ladder">
        {renderEnd('T')}
        <div className={styles.middle}>
          {MIDS.map((w) => {
            const slot = preview.indexOf(w);
            const isDragging = drag?.w === w && drag.moved;
            const isSel = sel.w === w && (phase === 'clues' || phase === 'order');
            const done = solved[w];
            const style: CSSProperties = isDragging
              ? { transform: `translateY(${drag!.from * drag!.pitch + drag!.dy}px)` }
              : ({ '--slot': slot } as CSSProperties);
            return (
              <div
                key={w}
                ref={(el) => {
                  if (el) rowEls.current.set(String(w), el);
                  else rowEls.current.delete(String(w));
                }}
                className={cx(
                  styles.row,
                  styles.midRow,
                  isSel && styles.rowSel,
                  done && styles.rowSolved,
                  flagged === w && styles.rowFlagged,
                  isDragging && styles.rowDragging,
                  phase === 'order' && styles.rowGrab,
                  unlocked && styles.rowFixed,
                )}
                style={style}
                onClick={() => selectCell(w, sel.w === w ? sel.c : editable(w) ? firstEmptyCol(w) : 0)}
                {...(phase === 'order' ? dragHandlers(w) : {})}
                aria-label={`Rung ${slot + 2}${done ? ', solved' : ''}`}
              >
                <span className={styles.side}>{done && <Check size={18} />}</span>
                <div className={styles.cells}>{renderCells(w, isSel)}</div>
                <span className={styles.side}>
                  {!unlocked && (
                    <button
                      type="button"
                      className={styles.handle}
                      aria-label="Drag to reorder"
                      tabIndex={-1}
                      onClick={(e) => e.stopPropagation()}
                      {...(phase === 'clues' ? dragHandlers(w) : {})}
                    >
                      {gripIcon}
                    </button>
                  )}
                </span>
              </div>
            );
          })}
          {showLinks &&
            !drag &&
            (phase === 'clues' || phase === 'order') &&
            order.slice(0, -1).map((w, k) => {
              const nxt = order[k + 1];
              if (!solved[w] || !solved[nxt] || !oneApart(words[w], words[nxt])) return null;
              return <span key={`${w}-${nxt}`} className={styles.link} style={{ '--slot': k } as CSSProperties} aria-hidden />;
            })}
        </div>
        {renderEnd('B')}
      </div>

      <ControlBar>
        {phase === 'order' && (
          <>
            <ControlButton label="Up" icon={<span aria-hidden>↑</span>} onClick={() => moveSelected(-1)} disabled={paused || order.indexOf(sel.w) <= 0} />
            <ControlButton label="Down" icon={<span aria-hidden>↓</span>} onClick={() => moveSelected(1)} disabled={paused || order.indexOf(sel.w) >= MIDDLE - 1} />
          </>
        )}
        <ControlButton label="Hint" icon={<Bulb size={18} />} onClick={hint} disabled={paused || phase === 'done'} />
      </ControlBar>

      <Keyboard disabled={paused || !(phase === 'clues' || phase === 'final')} onKey={(k) => onKey(k)} />
    </div>
  );
}
