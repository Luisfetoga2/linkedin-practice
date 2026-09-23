import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import type { GameProps } from '../../core/types';
import { Check, Close } from '../../core/components/Icons';
import { toast } from '../../core/components/Toast';
import { CORE } from '../../i18n/core';
import { CLUE_COUNT, displayWord, generatePuzzle } from './generator';
import type { Closeness } from './closeness';
import { contentIfLoaded, loadContent, type Content, type WordLang } from './content';
import { STR } from './i18n';
import styles from './Game.module.css';

interface Attempt {
  text: string;
  correct: boolean;
}
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

export default function Game(props: GameProps) {
  const wordLang: WordLang = props.options.words === 'es' ? 'es' : 'en';
  const [content, setContent] = useState<Content | null>(() => contentIfLoaded(wordLang));
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    if (content) return;
    let alive = true;
    loadContent(wordLang).then(
      (c) => alive && setContent(c),
      () => alive && setFailed(true),
    );
    return () => {
      alive = false;
    };
  }, [content, wordLang]);
  if (!content) return <div className="lp-loading">{failed ? STR[props.lang].loadError : CORE[props.lang].loading}</div>;
  return <Board {...props} content={content} />;
}

function Board({ seed, lang, paused, onReady, onComplete, content }: GameProps & { content: Content }) {
  const t = STR[lang];
  const { clean, isMatch, isMeaningful } = content.matcher;
  const puzzle = useMemo(() => generatePuzzle(seed, content.categories), [seed, content]);
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [status, setStatus] = useState<Status>('playing');
  const [text, setText] = useState('');
  const [shake, setShake] = useState(false);
  /** Closeness of each guess, computed once the round ends. */
  const [scores, setScores] = useState<Closeness[] | null>(null);
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

  const scoreAll = (list: Attempt[]): Closeness[] => {
    const near = content.nearFor(puzzle.category.name);
    return list.map((a) => content.scorer.closeness(a.text, puzzle.category, near));
  };

  const finish = (next: Attempt[], won: boolean) => {
    if (doneRef.current) return;
    doneRef.current = true;
    setCascadeFrom(Math.min(CLUE_COUNT, 1 + next.length - (won ? 1 : 0)));
    setStatus(won ? 'won' : 'lost');
    const sc = scoreAll(next);
    setScores(sc);
    const squares = Array.from({ length: MAX_GUESSES }, (_, i) => {
      const a = next[i];
      if (!a) return '⬜';
      return a.correct ? '🟩' : '🟥';
    });
    onComplete({
      won,
      guesses: won ? next.length : MAX_GUESSES,
      share: `📌 ${squares.join(' ')}`,
      summary: (
        <div className={styles.summary}>
          <p>
            {won ? t.category : t.answerWas}: <strong>{puzzle.category.name}</strong>
          </p>
          <p className={styles.summaryWords}>{puzzle.clues.map(displayWord).join(' · ')}</p>
          <ol className={styles.summaryGuesses} aria-label={t.howCloseAria}>
            {next.map((a, i) => (
              <li key={i}>
                <span className={styles.summaryGuess}>{a.text}</span> —{' '}
                <strong>{a.correct ? '✓' : `${sc[i].pct}%`}</strong>
              </li>
            ))}
          </ol>
        </div>
      ),
    });
  };

  const submit = (e?: FormEvent) => {
    e?.preventDefault();
    if (locked) return;
    const guess = text.trim().replace(/\s+/g, ' ');
    if (clean(guess).replace(/ /g, '').length < 2) {
      toast(t.tooShort);
      return;
    }
    if (!isMeaningful(guess)) {
      toast(t.tooVague);
      return;
    }
    const key = clean(guess);
    if (attempts.some((a) => clean(a.text) === key)) {
      toast(t.alreadyGuessed);
      return;
    }
    const correct = isMatch(guess, puzzle.category);
    const next: Attempt[] = [...attempts, { text: guess, correct }];
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

  // Keep the guess bar visible above the on-screen keyboard.
  const onFocus = () => {
    if (!window.matchMedia?.('(pointer: coarse)').matches) return;
    window.setTimeout(() => barRef.current?.scrollIntoView({ block: 'end', behavior: 'smooth' }), 280);
  };

  return (
    <div className={`${styles.wrap}${status === 'won' ? ` ${styles.won}` : ''}${status === 'lost' ? ` ${styles.lost}` : ''}`}>
      <ol className={styles.stack} aria-label={t.clues}>
        {puzzle.clues.map((word, i) => {
          const open = i < revealed;
          const delay = done && i >= cascadeFrom ? (i - cascadeFrom) * CASCADE_MS : 0;
          return (
            <li key={i} className={styles.slot} style={{ ['--wave-delay' as string]: `${i * 70 + 380}ms` }}>
              <div
                key={open ? 'open' : 'closed'}
                className={`${styles.card} ${styles[`c${i}`]} ${open ? styles.open : styles.closed}`}
                style={{ animationDelay: `${delay}ms` }}
                aria-label={open ? t.clueOpen(i + 1, word) : t.clueHidden(i + 1)}
              >
                {open ? (
                  <span className={styles.word}>{displayWord(word)}</span>
                ) : (
                  <span className={styles.placeholder}>
                    <Lock /> {t.clueLabel(i + 1)}
                  </span>
                )}
              </div>
            </li>
          );
        })}
      </ol>

      {done && (
        <div className={`${styles.banner} ${status === 'won' ? styles.bannerWin : styles.bannerLose}`} role="status">
          <span className={styles.bannerLabel}>{status === 'won' ? t.youPinpointed : t.answerWas}</span>
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
              placeholder={t.placeholder}
              aria-label={t.placeholder}
              maxLength={48}
              disabled={paused}
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="none"
              spellCheck={false}
              enterKeyHint="go"
            />
            <button className={styles.submit} type="submit" disabled={paused || !text.trim()} aria-label={t.submitGuess}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M5 12h14M13 6l6 6-6 6" />
              </svg>
            </button>
          </div>
          <p className={styles.left} aria-live="polite">
            {t.guessesLeft(left)}
          </p>
        </form>
      )}

      {attempts.length > 0 && (
        <section className={`${styles.guesses}${scores ? ` ${styles.guessesDone}` : ''}`} aria-label={t.yourGuesses}>
          <h2 className={styles.guessesTitle}>{scores ? t.howClose : t.yourGuesses}</h2>
          <ol className={styles.guessList}>
            {attempts.map((a, i) => {
              const c = scores?.[i];
              return (
                <li key={i} className={`${styles.guess} ${a.correct ? styles.guessRight : styles.guessWrong}`}>
                  <span className={styles.guessIcon}>{a.correct ? <Check size={14} /> : <Close size={14} />}</span>
                  {c || a.correct ? <span className={styles.guessText}>{a.text}</span> : <s className={styles.guessText}>{a.text}</s>}
                  {c && (
                    <span className={`${styles.score} ${styles[c.temp]}`} style={{ animationDelay: `${600 + i * 90}ms` }}>
                      <span className={styles.meter} aria-hidden>
                        <span className={styles.meterFill} style={{ width: `${c.pct}%` }} />
                      </span>
                      <span className={styles.pct}>{c.pct}%</span>
                      <span className={styles.temp}>{t.temp[c.temp]}</span>
                    </span>
                  )}
                </li>
              );
            })}
          </ol>
        </section>
      )}
    </div>
  );
}
