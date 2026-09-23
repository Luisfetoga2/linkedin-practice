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
  displayAnswer,
  englishWords,
  hardModeError,
  isValidGuess,
  keyToLetter,
  keyboardMarks,
  loadWordList,
  nextHintPosition,
  pickAnswer,
  scoreGuess,
  shareGrid,
  type Mark,
  type WordLang,
  type WordList,
} from './logic';
import { STR, type WordleStrings } from './i18n';
import styles from './Game.module.css';

const FLIP_STAGGER = 250;
const FLIP_MS = 500;
const REVEAL_MS = FLIP_STAGGER * (WORD_LEN - 1) + FLIP_MS;
/** On-screen keyboards per word list. Spanish adds Ñ after L, so its middle row needs no spacers. */
const KEY_ROWS: Record<WordLang, string[]> = {
  en: ['qwertyuiop', 'asdfghjkl', 'zxcvbnm'],
  es: ['qwertyuiop', 'asdfghjklñ', 'zxcvbnm'],
};

interface Row {
  word: string;
  marks: Mark[];
}

type Status = 'playing' | 'won' | 'lost';

/** Loads the word list picked by the `words` option (not the UI language), then shows the board. */
export default function Game(props: GameProps) {
  const wordLang: WordLang = props.options.words === 'es' ? 'es' : 'en';
  const t = STR[props.lang];
  const [list, setList] = useState<WordList | null>(() => (wordLang === 'en' ? englishWords() : null));
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (list) return;
    let alive = true;
    loadWordList(wordLang).then(
      (l) => alive && setList(l),
      () => alive && setFailed(true),
    );
    return () => {
      alive = false;
    };
  }, [wordLang, list, attempt]);

  if (!list) {
    return (
      <div className="lp-loading" role="status">
        {failed ? (
          <p>
            {t.loadFailed}{' '}
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => {
                setFailed(false);
                setAttempt((a) => a + 1);
              }}
            >
              {t.retry}
            </button>
          </p>
        ) : (
          t.loadingWords
        )}
      </div>
    );
  }
  return <Board {...props} list={list} t={t} />;
}

function Board({ seed, paused, onReady, onHint, onComplete, list, t }: GameProps & { list: WordList; t: WordleStrings }) {
  const answer = useMemo(() => pickAnswer(seed, list), [seed, list]);
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
    if (current.length < WORD_LEN) return reject(t.notEnoughLetters);
    if (!isValidGuess(current, list)) return reject(t.notInList);
    if (hardMode) {
      const err = hardModeError(current, rows, t);
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
      const WORD = displayAnswer(answer, list);
      if (won) {
        setStatus('won');
        setBounce(true);
        toast(t.praise[idx] ?? t.praise[t.praise.length - 1], 1600);
        onComplete({
          won: true,
          guesses: next.length,
          share,
          summary: (
            <>
              {t.wordWas} <strong>{WORD}</strong>
            </>
          ),
        });
      } else if (next.length >= MAX_GUESSES) {
        setStatus('lost');
        toast(WORD, 3000);
        onComplete({ won: false, guesses: MAX_GUESSES, share, summary: `${t.wordWas} ${WORD}` });
      }
    }, REVEAL_MS);
  }, [answer, current, hardMode, highContrast, list, onComplete, reject, rows, t]);

  const press = useCallback(
    (key: string) => {
      if (locked) return;
      if (key === 'enter') submit();
      else if (key === 'back') setCurrent((c) => c.slice(0, -1));
      else if (keyToLetter(key, list.lang) === key) setCurrent((c) => (c.length < WORD_LEN ? c + key : c));
    },
    [list.lang, locked, submit],
  );

  // Physical keyboard. Accented letters map to their base letter; Ñ only exists in the Spanish list.
  const wordLang = list.lang;
  const pressRef = useRef(press);
  useEffect(() => {
    pressRef.current = press;
  }, [press]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const el = e.target instanceof Element ? e.target : null;
      if (el?.closest('input, textarea, select, [contenteditable="true"]')) return;
      // A shell modal (help, settings, results) is open on top of the board.
      if (document.querySelector('[role="dialog"]')) return;
      let key: string | null = null;
      if (e.key === 'Enter') key = 'enter';
      else if (e.key === 'Backspace') key = 'back';
      else key = keyToLetter(e.key, wordLang);
      if (!key) return;
      // Stop a focused button (e.g. Hint) from also activating on Enter.
      e.preventDefault();
      pressRef.current(key);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [wordLang]);

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
      <div className={styles.grid} role="grid" aria-label={t.board}>
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
              aria-label={t.row(r + 1)}
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
                const label = ch
                  ? `${ch.toUpperCase()}${mark && revealing !== r ? `, ${t.marks[mark]}` : ''}`
                  : ghost
                    ? t.hintTile(ghost.toUpperCase())
                    : t.empty;
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
        <ControlButton icon={<Bulb size={18} />} label={t.hint} onClick={takeHint} disabled={!canHint} badge={`${MAX_HINTS - hints.length}`} />
        {hints.map((p) => (
          <span key={p} className={styles.hintPill} aria-label={t.hintPillAria(p, answer[p].toUpperCase())}>
            <span className={styles.hintTile}>{answer[p]}</span>
            {t.hintPill(p)}
          </span>
        ))}
      </div>

      <div className={styles.keyboard} aria-label={t.keyboard}>
        {KEY_ROWS[list.lang].map((keys, ri) => {
          const spacers = ri === 1 && keys.length < 10;
          return (
            <div key={ri} className={styles.keyRow}>
              {spacers && <span className={styles.half} />}
              {ri === 2 && <KeyButton k="enter" label={t.enter} aria={t.enterAria} wide onPress={press} />}
              {[...keys].map((k) => (
                <KeyButton key={k} k={k} label={k} mark={kb[k]} markLabels={t.marks} onPress={press} />
              ))}
              {ri === 2 && <KeyButton k="back" label={<Backspace size={20} />} aria={t.backspace} wide onPress={press} />}
              {spacers && <span className={styles.half} />}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function KeyButton({
  k,
  label,
  aria,
  mark,
  markLabels,
  wide,
  onPress,
}: {
  k: string;
  label: ReactNode;
  aria?: string;
  mark?: Mark;
  markLabels?: Record<Mark, string>;
  wide?: boolean;
  onPress(k: string): void;
}) {
  return (
    <button
      type="button"
      className={`${styles.key}${wide ? ` ${styles.wide}` : ''}`}
      data-mark={mark}
      aria-label={aria ?? (typeof label === 'string' ? `${label}${mark && markLabels ? `, ${markLabels[mark]}` : ''}` : undefined)}
      onMouseDown={(e) => e.preventDefault()}
      onClick={() => onPress(k)}
    >
      {label}
    </button>
  );
}
