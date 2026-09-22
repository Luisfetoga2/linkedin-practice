import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import type { GameProps } from '../../core/types';
import { ControlButton } from '../../core/components/Controls';
import { Backspace, Bulb } from '../../core/components/Icons';
import { toast } from '../../core/components/Toast';
import { useGameSetting } from '../../lib/settings';
import {
  MAX_GUESSES,
  MAX_HINTS,
  WORD_LEN,
  hardModeError,
  isValidGuess,
  keyboardMarks,
  nextHintPosition,
  pickAnswer,
  scoreGuess,
  shareGrid,
  type Mark,
} from './logic';
import styles from './Game.module.css';

const FLIP_STAGGER = 250;
const FLIP_MS = 500;
const REVEAL_MS = FLIP_STAGGER * (WORD_LEN - 1) + FLIP_MS;
const PRAISE = ['Genius', 'Magnificent', 'Impressive', 'Splendid', 'Great', 'Phew'];
const KEY_ROWS = ['qwertyuiop', 'asdfghjkl', 'zxcvbnm'];
const ORD = ['1st', '2nd', '3rd', '4th', '5th'];
const MARK_LABEL: Record<Mark, string> = { correct: 'correct', present: 'in the word', absent: 'not in the word' };

interface Row {
  word: string;
  marks: Mark[];
}

type Status = 'playing' | 'won' | 'lost';

export default function Game({ seed, paused, onReady, onHint, onComplete }: GameProps) {
  const answer = useMemo(() => pickAnswer(seed), [seed]);
  const [hardMode] = useGameSetting('wordle', 'hardMode', false);
  const [highContrast] = useGameSetting('wordle', 'highContrast', false);

  const [rows, setRows] = useState<Row[]>([]);
  const [current, setCurrent] = useState('');
  const [revealing, setRevealing] = useState<number | null>(null);
  const [revealedCount, setRevealedCount] = useState(0);
  const [shaking, setShaking] = useState(false);
  const [status, setStatus] = useState<Status>('playing');
  const [bounce, setBounce] = useState(false);
  const [hints, setHints] = useState<number[]>([]);

  const timers = useRef<number[]>([]);
  const readyFired = useRef(false);
  useEffect(() => {
    if (!readyFired.current) {
      readyFired.current = true;
      onReady();
    }
  }, [onReady]);
  useEffect(() => () => timers.current.forEach((t) => window.clearTimeout(t)), []);

  const later = (fn: () => void, ms: number) => {
    timers.current.push(window.setTimeout(fn, ms));
  };

  const locked = paused || status !== 'playing' || revealing !== null;

  const reject = useCallback((msg: string) => {
    toast(msg);
    setShaking(true);
  }, []);

  const submit = useCallback(() => {
    if (current.length < WORD_LEN) return reject('Not enough letters');
    if (!isValidGuess(current)) return reject('Not in word list');
    if (hardMode) {
      const err = hardModeError(current, rows);
      if (err) return reject(err);
    }
    const row: Row = { word: current, marks: scoreGuess(current, answer) };
    const next = [...rows, row];
    const idx = rows.length;
    const won = current === answer;
    setRows(next);
    setCurrent('');
    setRevealing(idx);
    later(() => {
      setRevealing(null);
      setRevealedCount(next.length);
      const share = shareGrid(
        next.map((r) => r.marks),
        highContrast,
      );
      const WORD = answer.toUpperCase();
      if (won) {
        setStatus('won');
        setBounce(true);
        toast(PRAISE[idx] ?? 'Phew', 1600);
        onComplete({
          won: true,
          guesses: next.length,
          share,
          summary: (
            <>
              The word was <strong>{WORD}</strong>
            </>
          ),
        });
      } else if (next.length >= MAX_GUESSES) {
        setStatus('lost');
        toast(WORD, 3000);
        onComplete({ won: false, guesses: MAX_GUESSES, share, summary: `The word was ${WORD}` });
      }
    }, REVEAL_MS);
  }, [answer, current, hardMode, highContrast, onComplete, reject, rows]);

  const press = useCallback(
    (key: string) => {
      if (locked) return;
      if (key === 'enter') submit();
      else if (key === 'back') setCurrent((c) => c.slice(0, -1));
      else if (/^[a-z]$/.test(key)) setCurrent((c) => (c.length < WORD_LEN ? c + key : c));
    },
    [locked, submit],
  );

  // Physical keyboard.
  const pressRef = useRef(press);
  useEffect(() => {
    pressRef.current = press;
  }, [press]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const t = e.target instanceof Element ? e.target : null;
      if (t?.closest('input, textarea, select, [contenteditable="true"]')) return;
      // A shell modal (help, settings, results) is open on top of the board.
      if (document.querySelector('[role="dialog"]')) return;
      let key: string | null = null;
      if (e.key === 'Enter') key = 'enter';
      else if (e.key === 'Backspace') key = 'back';
      else if (/^[a-zA-Z]$/.test(e.key)) key = e.key.toLowerCase();
      if (!key) return;
      // Stop a focused button (e.g. Hint) from also activating on Enter.
      e.preventDefault();
      pressRef.current(key);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const hintPos = status === 'playing' ? nextHintPosition(seed, answer, rows, hints) : null;
  const canHint = !locked && hints.length < MAX_HINTS && hintPos !== null;
  const takeHint = () => {
    if (!canHint || hintPos === null) return;
    setHints((h) => [...h, hintPos]);
    onHint();
  };

  const kb = useMemo(() => keyboardMarks(rows.slice(0, revealedCount)), [rows, revealedCount]);
  const activeRow = status === 'playing' ? rows.length : -1;

  const rootClass = `${styles.root}${highContrast ? ` ${styles.hc}` : ''}`;

  return (
    <div className={rootClass}>
      <div className={styles.grid} role="grid" aria-label="Wordle board">
        {Array.from({ length: MAX_GUESSES }, (_, r) => {
          const done = rows[r];
          const isActive = r === activeRow;
          const letters = done ? done.word : isActive ? current : '';
          const rowClass = [styles.row, isActive && shaking ? styles.shake : ''].filter(Boolean).join(' ');
          return (
            <div
              key={r}
              className={rowClass}
              role="row"
              aria-label={`Row ${r + 1}`}
              onAnimationEnd={(e) => {
                if (e.target === e.currentTarget) setShaking(false);
              }}
            >
              {Array.from({ length: WORD_LEN }, (_, c) => {
                const ch = letters[c] ?? '';
                const mark = done?.marks[c];
                const ghost = isActive && !ch && hints.includes(c) ? answer[c] : '';
                const cls = [
                  styles.tile,
                  ch ? styles.filled : '',
                  mark ? styles.revealed : '',
                  mark && revealing === r ? styles.flip : '',
                  bounce && status === 'won' && r === rows.length - 1 ? styles.bounce : '',
                  ghost ? styles.ghost : '',
                ]
                  .filter(Boolean)
                  .join(' ');
                const label = ch ? `${ch.toUpperCase()}${mark && revealing !== r ? `, ${MARK_LABEL[mark]}` : ''}` : ghost ? `hint ${ghost.toUpperCase()}` : 'empty';
                return (
                  <div key={c} role="gridcell" aria-label={label} className={cls} data-mark={mark} style={{ '--i': c } as CSSProperties}>
                    {ch || ghost}
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>

      <div className={styles.hintRow}>
        <ControlButton icon={<Bulb size={18} />} label="Hint" onClick={takeHint} disabled={!canHint} badge={`${MAX_HINTS - hints.length}`} />
        {hints.map((p) => (
          <span key={p} className={styles.hintPill} aria-label={`Position ${p + 1} is ${answer[p].toUpperCase()}`}>
            <span className={styles.hintTile}>{answer[p]}</span>
            {ORD[p]} letter
          </span>
        ))}
      </div>

      <div className={styles.keyboard} aria-label="Keyboard">
        {KEY_ROWS.map((keys, ri) => (
          <div key={ri} className={styles.keyRow}>
            {ri === 1 && <span className={styles.half} />}
            {ri === 2 && <KeyButton k="enter" label="Enter" wide onPress={press} />}
            {[...keys].map((k) => (
              <KeyButton key={k} k={k} label={k} mark={kb[k]} onPress={press} />
            ))}
            {ri === 2 && <KeyButton k="back" label={<Backspace size={20} />} aria="Backspace" wide onPress={press} />}
            {ri === 1 && <span className={styles.half} />}
          </div>
        ))}
      </div>
    </div>
  );
}

function KeyButton({
  k,
  label,
  aria,
  mark,
  wide,
  onPress,
}: {
  k: string;
  label: ReactNode;
  aria?: string;
  mark?: Mark;
  wide?: boolean;
  onPress(k: string): void;
}) {
  return (
    <button
      type="button"
      className={`${styles.key}${wide ? ` ${styles.wide}` : ''}`}
      data-mark={mark}
      aria-label={aria ?? (typeof label === 'string' ? `${label}${mark ? `, ${MARK_LABEL[mark]}` : ''}` : undefined)}
      onMouseDown={(e) => e.preventDefault()}
      onClick={() => onPress(k)}
    >
      {label}
    </button>
  );
}
