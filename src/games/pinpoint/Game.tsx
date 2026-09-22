import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import type { GameProps } from '../../core/types';
import { ControlBar, ControlButton } from '../../core/components/Controls';
import { Bulb, Check, Close } from '../../core/components/Icons';
import { toast } from '../../core/components/Toast';
import { CLUE_COUNT, displayWord, generatePuzzle } from './generator';
import { clean, isMatch, isMeaningful } from './match';
import styles from './Game.module.css';

type Attempt = { kind: 'guess'; text: string; correct: boolean } | { kind: 'hint' };
type Status = 'playing' | 'won' | 'lost';

const MAX_GUESSES = CLUE_COUNT;
const CASCADE_MS = 110;

function Lock() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden>
      <rect x="5" y="11" width="14" height="10" rx="2" />
      <path d="M8 11V8a4 4 0 018 0v3" />
    </svg>
  );
}

export default function Game({ seed, paused, onReady, onHint, onComplete }: GameProps) {
  const puzzle = useMemo(() => generatePuzzle(seed), [seed]);
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [status, setStatus] = useState<Status>('playing');
  const [text, setText] = useState('');
  const [shake, setShake] = useState(false);
  /** Index of the first card revealed by the end-of-round cascade (for stagger delays). */
  const [cascadeFrom, setCascadeFrom] = useState(CLUE_COUNT);
  const inputRef = useRef<HTMLInputElement>(null);
  const barRef = useRef<HTMLFormElement>(null);
  const readyRef = useRef(false);
  const doneRef = useRef(false);

  useEffect(() => {
    if (readyRef.current) return;
    readyRef.current = true;
    onReady();
  }, [onReady]);

  // Desktop only: focus the input (on phones this would pop the keyboard over the board).
  useEffect(() => {
    if (window.matchMedia?.('(pointer: fine)').matches) inputRef.current?.focus({ preventScroll: true });
  }, []);

  const done = status !== 'playing';
  const locked = done || paused;
  const revealed = done ? CLUE_COUNT : Math.min(CLUE_COUNT, 1 + attempts.length);
  const used = attempts.length;
  const left = MAX_GUESSES - used;

  const finish = (next: Attempt[], won: boolean) => {
    if (doneRef.current) return;
    doneRef.current = true;
    setCascadeFrom(Math.min(CLUE_COUNT, 1 + next.length - (won ? 1 : 0)));
    setStatus(won ? 'won' : 'lost');
    const squares = Array.from({ length: MAX_GUESSES }, (_, i) => {
      const a = next[i];
      if (!a) return '⬜';
      if (a.kind === 'hint') return '💡';
      return a.correct ? '🟩' : '🟥';
    });
    onComplete({
      won,
      guesses: won ? next.length : MAX_GUESSES,
      share: `📌 ${squares.join(' ')}`,
      summary: (
        <div className={styles.summary}>
          <p>
            {won ? 'Category' : 'The answer was'}: <strong>{puzzle.category.name}</strong>
          </p>
          <p className={styles.summaryWords}>{puzzle.clues.map(displayWord).join(' · ')}</p>
        </div>
      ),
    });
  };

  const submit = (e?: FormEvent) => {
    e?.preventDefault();
    if (locked) return;
    const guess = text.trim().replace(/\s+/g, ' ');
    if (clean(guess).replace(/ /g, '').length < 2) {
      toast('Guess is too short');
      return;
    }
    if (!isMeaningful(guess)) {
      toast('Try something more specific');
      return;
    }
    const key = clean(guess);
    if (attempts.some((a) => a.kind === 'guess' && clean(a.text) === key)) {
      toast('Already guessed');
      return;
    }
    const correct = isMatch(guess, puzzle.category);
    const next: Attempt[] = [...attempts, { kind: 'guess', text: guess, correct }];
    setAttempts(next);
    setText('');
    if (correct) {
      finish(next, true);
      inputRef.current?.blur();
    } else if (next.length >= MAX_GUESSES) {
      finish(next, false);
      inputRef.current?.blur();
    } else {
      setShake(true);
    }
  };

  const hint = () => {
    if (locked || revealed >= CLUE_COUNT) return;
    onHint();
    setAttempts((a) => [...a, { kind: 'hint' }]);
  };

  // Keep the guess bar visible above the on-screen keyboard.
  const onFocus = () => {
    if (!window.matchMedia?.('(pointer: coarse)').matches) return;
    window.setTimeout(() => barRef.current?.scrollIntoView({ block: 'end', behavior: 'smooth' }), 280);
  };

  return (
    <div className={`${styles.wrap}${status === 'won' ? ` ${styles.won}` : ''}${status === 'lost' ? ` ${styles.lost}` : ''}`}>
      <ol className={styles.stack} aria-label="Clues">
        {puzzle.clues.map((word, i) => {
          const open = i < revealed;
          const a = attempts[i];
          const delay = done && i >= cascadeFrom ? (i - cascadeFrom) * CASCADE_MS : 0;
          return (
            <li key={i} className={styles.slot} style={{ ['--wave-delay' as string]: `${i * 70 + 380}ms` }}>
              <div
                key={open ? 'open' : 'closed'}
                className={`${styles.card} ${styles[`c${i}`]} ${open ? styles.open : styles.closed}`}
                style={{ animationDelay: `${delay}ms` }}
                aria-label={open ? `Clue ${i + 1}: ${word}` : `Clue ${i + 1}, hidden`}
              >
                {open ? (
                  <span className={styles.word}>{displayWord(word)}</span>
                ) : (
                  <span className={styles.placeholder}>
                    <Lock /> Clue {i + 1}
                  </span>
                )}
              </div>
              {a && (
                <div
                  className={`${styles.note} ${a.kind === 'hint' ? styles.noteHint : a.correct ? styles.noteRight : styles.noteWrong}`}
                >
                  {a.kind === 'hint' ? (
                    <>
                      <Bulb size={14} /> <span>Hint used</span>
                    </>
                  ) : a.correct ? (
                    <>
                      <Check size={14} /> <span>{a.text}</span>
                    </>
                  ) : (
                    <>
                      <Close size={14} /> <s>{a.text}</s>
                    </>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ol>

      {done && (
        <div className={`${styles.banner} ${status === 'won' ? styles.bannerWin : styles.bannerLose}`} role="status">
          <span className={styles.bannerLabel}>{status === 'won' ? 'You pinpointed it' : 'The answer was'}</span>
          <span className={styles.bannerName}>
            {puzzle.category.name}
            {status === 'won' && <Check size={20} />}
          </span>
        </div>
      )}

      {!done && (
        <form ref={barRef} className={styles.bar} onSubmit={submit}>
          <div className={`${styles.inputRow}${shake ? ` ${styles.shake}` : ''}`} onAnimationEnd={() => setShake(false)}>
            <input
              ref={inputRef}
              className={styles.input}
              value={text}
              onChange={(e) => setText(e.target.value)}
              onFocus={onFocus}
              placeholder="Guess the category"
              aria-label="Guess the category"
              maxLength={48}
              disabled={paused}
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="none"
              spellCheck={false}
              enterKeyHint="go"
            />
            <button className={styles.submit} type="submit" disabled={paused || !text.trim()} aria-label="Submit guess">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M5 12h14M13 6l6 6-6 6" />
              </svg>
            </button>
          </div>
          <p className={styles.left} aria-live="polite">
            {left} {left === 1 ? 'guess' : 'guesses'} left
          </p>
        </form>
      )}

      {!done && (
        <ControlBar>
          <ControlButton icon={<Bulb size={18} />} label="Hint" onClick={hint} disabled={locked || revealed >= CLUE_COUNT} />
        </ControlBar>
      )}
    </div>
  );
}
