import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import type { GameProps } from '../../core/types';
import { ControlBar, ControlButton, HintBubble } from '../../core/components/Controls';
import { Bulb, Eraser, Pencil, Undo } from '../../core/components/Icons';
import { useGameSetting } from '../../lib/settings';
import { CELLS, HOUSES, N, PEERS, cellHouses, colOf, findConflicts, generateSudoku, nextPlacement, rowOf, type Difficulty } from './logic';
import styles from './Game.module.css';

interface Snapshot {
  values: number[];
  notes: number[];
}

interface HintState {
  cell: number;
  /** Cells of the house(s) that explain the step. */
  area: number[];
  /** Pattern cells (pairs, pointing cells). */
  pattern: number[];
  message: string;
  mistake?: boolean;
}

const bit = (d: number) => 1 << (d - 1);
const DIGITS = [1, 2, 3, 4, 5, 6];

export default function Game({ seed, options, paused, onReady, onHint, onComplete }: GameProps) {
  const difficulty = (options.difficulty ?? 'medium') as Difficulty;
  const puzzle = useMemo(() => generateSudoku(seed, difficulty), [seed, difficulty]);
  const locked = useMemo(() => puzzle.givens.map((v) => v !== 0), [puzzle]);

  const [showErrors] = useGameSetting('sudoku', 'showErrors', true);
  const [autoNotes] = useGameSetting('sudoku', 'autoNotes', true);

  const [state, setStateRaw] = useState<Snapshot>(() => ({ values: puzzle.givens.slice(), notes: new Array(CELLS).fill(0) }));
  const [history, setHistory] = useState<Snapshot[]>([]);
  const [selected, setSelectedRaw] = useState<number | null>(null);
  const [notesMode, setNotesModeRaw] = useState(false);
  const [hint, setHint] = useState<HintState | null>(null);
  const [lastPlaced, setLastPlaced] = useState<number | null>(null);
  const [won, setWon] = useState(false);

  // Mirrors updated synchronously so rapid key presses between renders never read stale state.
  const live = useRef({ state, history, selected, notesMode });
  const setState = (s: Snapshot) => {
    live.current.state = s;
    setStateRaw(s);
  };
  const setSelected = (i: number | null) => {
    live.current.selected = i;
    setSelectedRaw(i);
  };
  const setNotesMode = (m: boolean) => {
    live.current.notesMode = m;
    setNotesModeRaw(m);
  };
  const pushHistory = (s: Snapshot | null) => {
    const h = s ? [...live.current.history, s] : live.current.history.slice(0, -1);
    live.current.history = h;
    setHistory(h);
  };

  const cb = useRef({ onReady, onHint, onComplete });
  cb.current = { onReady, onHint, onComplete };
  const readyCalled = useRef(false);
  const completeCalled = useRef(false);

  useEffect(() => {
    if (readyCalled.current) return;
    readyCalled.current = true;
    cb.current.onReady();
  }, []);

  const { values, notes } = state;
  const inputBlocked = paused || won;

  const commit = (next: Snapshot, keepHint = false) => {
    pushHistory(live.current.state);
    setState(next);
    if (!keepHint) setHint(null);
  };

  const place = (cell: number, d: number, keepHint = false) => {
    const cur = live.current.state;
    const nextValues = cur.values.slice();
    const nextNotes = cur.notes.slice();
    nextValues[cell] = d;
    nextNotes[cell] = 0;
    if (autoNotes) for (const p of PEERS[cell]) nextNotes[p] &= ~bit(d);
    commit({ values: nextValues, notes: nextNotes }, keepHint);
    setLastPlaced(cell);
  };

  const input = (d: number) => {
    const sel = live.current.selected;
    if (inputBlocked || sel === null || locked[sel]) return;
    const cur = live.current.state;
    if (live.current.notesMode) {
      if (cur.values[sel]) return;
      const nextNotes = cur.notes.slice();
      nextNotes[sel] ^= bit(d);
      commit({ values: cur.values, notes: nextNotes });
      return;
    }
    if (cur.values[sel] === d) return;
    place(sel, d);
  };

  const erase = () => {
    const sel = live.current.selected;
    if (inputBlocked || sel === null || locked[sel]) return;
    const cur = live.current.state;
    if (!cur.values[sel] && !cur.notes[sel]) return;
    const nextValues = cur.values.slice();
    const nextNotes = cur.notes.slice();
    nextValues[sel] = 0;
    nextNotes[sel] = 0;
    commit({ values: nextValues, notes: nextNotes });
  };

  const undo = () => {
    const h = live.current.history;
    if (inputBlocked || !h.length) return;
    setState(h[h.length - 1]);
    pushHistory(null);
    setHint(null);
    setLastPlaced(null);
  };

  const toggleNotes = () => setNotesMode(!live.current.notesMode);

  const houseCells = (h: number) => HOUSES[h].cells;

  const giveHint = () => {
    if (inputBlocked) return;
    cb.current.onHint();
    const values = live.current.state.values;
    const selected = live.current.selected;
    const isWrong = (i: number) => !!values[i] && !locked[i] && values[i] !== puzzle.solution[i];
    const wrong = selected !== null && isWrong(selected) ? selected : values.findIndex((_, i) => isWrong(i));
    if (wrong >= 0) {
      setSelected(wrong);
      setHint({ cell: wrong, area: [], pattern: [], message: "This number isn't right.", mistake: true });
      return;
    }
    const next = nextPlacement(values);
    if (next) {
      const { placement, via } = next;
      const area = new Set<number>();
      if (placement.house !== null) houseCells(placement.house).forEach((c) => area.add(c));
      else cellHouses(placement.cell).forEach((h) => houseCells(h).forEach((c) => area.add(c)));
      if (via) houseCells(via.house).forEach((c) => area.add(c));
      setSelected(placement.cell);
      setHint({
        cell: placement.cell,
        area: [...area],
        pattern: via?.pattern ?? [],
        message: via ? `${via.message} Then: ${placement.message}` : placement.message,
      });
      place(placement.cell, placement.digit, true);
      return;
    }
    // Fallback: reveal the selected (or first) empty cell.
    const target = selected !== null && !values[selected] ? selected : values.findIndex((v) => !v);
    if (target < 0) return;
    setSelected(target);
    setHint({ cell: target, area: [], pattern: [], message: `This cell is ${puzzle.solution[target]}.` });
    place(target, puzzle.solution[target], true);
  };

  // Win detection.
  useEffect(() => {
    if (completeCalled.current) return;
    if (values.every((v, i) => v === puzzle.solution[i])) {
      completeCalled.current = true;
      setWon(true);
      setSelected(null);
      setHint(null);
      cb.current.onComplete({ won: true, share: '🟩 Mini Sudoku' });
    }
  }, [values, puzzle]);

  // Keyboard.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (inputBlocked) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
      if (document.querySelector('.lp-modal-backdrop')) return;
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        undo();
        return;
      }
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key >= '1' && e.key <= '6') {
        e.preventDefault();
        input(Number(e.key));
        return;
      }
      if (e.key === 'Backspace' || e.key === 'Delete' || e.key === '0') {
        e.preventDefault();
        erase();
        return;
      }
      if (e.key === 'n' || e.key === 'N') {
        toggleNotes();
        return;
      }
      const moves: Record<string, [number, number]> = {
        ArrowUp: [-1, 0],
        ArrowDown: [1, 0],
        ArrowLeft: [0, -1],
        ArrowRight: [0, 1],
      };
      const mv = moves[e.key];
      if (!mv) return;
      e.preventDefault();
      const sel = live.current.selected;
      if (sel === null) {
        setSelected(0);
        return;
      }
      const r = (rowOf(sel) + mv[0] + N) % N;
      const c = (colOf(sel) + mv[1] + N) % N;
      setSelected(r * N + c);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const conflicts = useMemo(() => (showErrors ? findConflicts(values) : new Set<number>()), [showErrors, values]);
  const hintArea = useMemo(() => new Set(hint?.area ?? []), [hint]);
  const hintPattern = useMemo(() => new Set(hint?.pattern ?? []), [hint]);
  const digitCounts = useMemo(() => {
    const counts = new Array(N + 1).fill(0);
    values.forEach((v) => v && counts[v]++);
    return counts;
  }, [values]);

  const selectCell = (i: number) => {
    if (inputBlocked) return;
    setSelected(i);
    if (hint && hint.cell !== i) setHint(null);
  };

  return (
    <div className={styles.wrap}>
      <div className={`${styles.board}${won ? ` ${styles.won}` : ''}`} role="grid" aria-label="Mini Sudoku board">
        {values.map((v, i) => {
          const r = rowOf(i);
          const c = colOf(i);
          const cls = [styles.cell];
          if (c === 2) cls.push(styles.boxRight);
          if (c === N - 1) cls.push(styles.lastCol);
          if (r === 1 || r === 3) cls.push(styles.boxBottom);
          if (r === N - 1) cls.push(styles.lastRow);
          if (locked[i]) cls.push(styles.given);
          else if (v) cls.push(styles.player);
          if (i === selected) cls.push(styles.selected);
          else if (conflicts.has(i)) cls.push(styles.conflict);
          else if (hintPattern.has(i)) cls.push(styles.hintPattern);
          else if (hintArea.has(i)) cls.push(styles.hintArea);
          if (conflicts.has(i)) cls.push(styles.conflictText);
          if (hint?.mistake && hint.cell === i) cls.push(styles.mistake);
          const label = `Row ${r + 1}, column ${c + 1}: ${v || 'empty'}${locked[i] ? ', given' : ''}`;
          return (
            <button
              key={i}
              type="button"
              tabIndex={-1}
              className={cls.join(' ')}
              style={{ '--d': `${(r + c) * 40}ms` } as CSSProperties}
              aria-label={label}
              aria-selected={i === selected}
              onPointerDown={(e) => {
                // Select on press (not release) so a digit typed right after the tap lands here.
                if (e.pointerType === 'mouse' && e.button !== 0) return;
                selectCell(i);
              }}
            >
              {v ? (
                <span key={`${v}-${i === lastPlaced}`} className={`${styles.digit}${!locked[i] && i === lastPlaced ? ` ${styles.pop}` : ''}`}>
                  {v}
                </span>
              ) : notes[i] ? (
                <span className={styles.notes} aria-hidden>
                  {DIGITS.map((d) => (
                    <span key={d}>{notes[i] & bit(d) ? d : ''}</span>
                  ))}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>

      <div className={styles.pad} role="group" aria-label="Number pad">
        {DIGITS.map((d) => (
          <button
            key={d}
            type="button"
            className={`${styles.key}${digitCounts[d] >= N ? ` ${styles.keyDone}` : ''}${notesMode ? ` ${styles.keyNotes}` : ''}`}
            onClick={() => input(d)}
            disabled={inputBlocked}
            aria-label={notesMode ? `Note ${d}` : `${d}`}
          >
            {d}
          </button>
        ))}
      </div>

      <ControlBar>
        <ControlButton icon={<Undo size={18} />} label="Undo" onClick={undo} disabled={inputBlocked || !history.length} />
        <ControlButton icon={<Eraser size={18} />} label="Erase" onClick={erase} disabled={inputBlocked} />
        <ControlButton
          icon={<Pencil size={18} />}
          label="Notes"
          onClick={toggleNotes}
          disabled={inputBlocked}
          active={notesMode}
        />
        <ControlButton icon={<Bulb size={18} />} label="Hint" onClick={giveHint} disabled={inputBlocked} />
      </ControlBar>

      {hint && <HintBubble onDismiss={() => setHint(null)}>{hint.message}</HintBubble>}
    </div>
  );
}
