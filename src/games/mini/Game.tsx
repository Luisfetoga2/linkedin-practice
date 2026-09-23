import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import type { GameProps } from '../../core/types';
import { ControlBar, ControlButton } from '../../core/components/Controls';
import { toast } from '../../core/components/Toast';
import { useGameSetting } from '../../lib/settings';
import { entriesIfLoaded, loadEntries, WordsUnavailable, type WordLang } from './data';
import type { ClueEntry } from './data/types';
import { generateMini, type MiniClue, type MiniSize } from './generator';
import { afterType, arrow, backspace, clueAt, isFull, isSolved, keyToLetter, landOn, revealTarget, stepClue, type Cursor } from './logic';
import { Keyboard } from './Keyboard';
import { STR } from './i18n';
import styles from './Game.module.css';

function cx(...parts: (string | false | null | undefined)[]): string {
  return parts.filter(Boolean).join(' ');
}

/** Loads the word list picked by the `words` option (not the UI language), then shows the grid. */
export default function Game(props: GameProps) {
  const wordLang: WordLang = props.options.words === 'es' ? 'es' : 'en';
  const t = STR[props.lang];
  const [entries, setEntries] = useState<ClueEntry[] | null>(() => entriesIfLoaded(wordLang));
  const [failed, setFailed] = useState<'missing' | 'error' | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (entries) return;
    let alive = true;
    loadEntries(wordLang).then(
      (list) => alive && setEntries(list),
      (err) => alive && setFailed(err instanceof WordsUnavailable ? 'missing' : 'error'),
    );
    return () => {
      alive = false;
    };
  }, [wordLang, entries, attempt]);

  if (!entries) {
    return (
      <div className="lp-loading" role="status">
        {failed === 'missing' ? (
          <p>{t.notAvailable}</p>
        ) : failed === 'error' ? (
          <p>
            {t.loadFailed}{' '}
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => {
                setFailed(null);
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
  return <Board {...props} wordLang={wordLang} words={entries} />;
}

const ArrowIcon = ({ flip }: { flip?: boolean }) => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d={flip ? 'M9 5l7 7-7 7' : 'M15 5l-7 7 7 7'} />
  </svg>
);
const RevealIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);
const CheckIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M4 12.5l5 5L20 6.5" />
  </svg>
);

type Props = GameProps & { wordLang: WordLang; words: ClueEntry[] };

function Board({ seed, lang, options, paused, onReady, onHint, onComplete, wordLang, words }: Props) {
  const t = STR[lang];
  const size: MiniSize = options.size === '4' ? 4 : 5;
  const puzzle = useMemo(() => generateMini(seed, size, words), [seed, size, words]);
  const N = puzzle.size;
  const cellCount = N * N;
  const [autoCheck] = useGameSetting<boolean>('mini', 'autoCheck', false);
  const [skipFilled] = useGameSetting<boolean>('mini', 'skipFilled', true);

  const [entries, setEntries] = useState<string[]>(() => Array<string>(cellCount).fill(''));
  const [revealed, setRevealed] = useState<boolean[]>(() => Array<boolean>(cellCount).fill(false));
  const [right, setRight] = useState<boolean[]>(() => Array<boolean>(cellCount).fill(false));
  const [flagged, setFlagged] = useState<boolean[]>(() => Array<boolean>(cellCount).fill(false));
  const [cursor, setCursor] = useState<Cursor>(() => landOn(puzzle.across[0], Array<string>(cellCount).fill('')));
  const [won, setWon] = useState(false);
  const cellEls = useRef<(HTMLDivElement | null)[]>([]);
  const readyRef = useRef(false);
  const doneRef = useRef(false);
  const lastFullWrong = useRef<string | null>(null);

  const locked = useMemo(() => revealed.map((r, i) => r || right[i]), [revealed, right]);
  const clue = clueAt(puzzle, cursor.cell, cursor.dir);
  const cross = clueAt(puzzle, cursor.cell, cursor.dir === 'across' ? 'down' : 'across');
  const wordCells = new Set(clue.cells);
  const active = !paused && !won;

  useEffect(() => {
    if (readyRef.current) return;
    readyRef.current = true;
    onReady();
  }, [onReady]);

  // ---- state updates ---------------------------------------------------------------------
  const clearFlag = (i: number, fl = flagged) => (fl[i] ? fl.map((v, j) => (j === i ? false : v)) : fl);

  /** Apply a new grid; detects a win, or a full grid that isn't right yet. */
  const commit = (next: string[]) => {
    setEntries(next);
    if (isSolved(puzzle, next)) {
      finish(next);
      return;
    }
    if (isFull(puzzle, next)) {
      const key = next.join('');
      if (lastFullWrong.current !== key) {
        lastFullWrong.current = key;
        toast(t.notQuite, 2200);
      }
    } else lastFullWrong.current = null;
  };

  const typeLetter = (ch: string) => {
    let at = cursor;
    if (locked[at.cell]) {
      // Checked / revealed squares can't change: type into the next open square instead.
      const nextOpen = clue.cells.slice(clue.cells.indexOf(at.cell) + 1).find((i) => !locked[i]);
      if (nextOpen === undefined) {
        setCursor(afterType(puzzle, at, entries, locked, skipFilled));
        return;
      }
      at = { cell: nextOpen, dir: at.dir };
    }
    const next = entries.slice();
    next[at.cell] = ch;
    setFlagged(clearFlag(at.cell));
    setCursor(afterType(puzzle, at, next, locked, skipFilled));
    commit(next);
  };

  const erase = () => {
    const res = backspace(puzzle, cursor, entries, locked);
    setCursor(res.cursor);
    if (res.clear >= 0) {
      const next = entries.slice();
      next[res.clear] = '';
      setFlagged(clearFlag(res.clear));
      commit(next);
    }
  };

  const deleteHere = () => {
    if (!entries[cursor.cell] || locked[cursor.cell]) return;
    const next = entries.slice();
    next[cursor.cell] = '';
    setFlagged(clearFlag(cursor.cell));
    commit(next);
  };

  const toggleDir = () => setCursor((c) => ({ cell: c.cell, dir: c.dir === 'across' ? 'down' : 'across' }));
  const goClue = (delta: 1 | -1) => setCursor(stepClue(puzzle, clue, delta, entries, false));
  const nextClueSkipping = (delta: 1 | -1) => setCursor(stepClue(puzzle, clue, delta, entries, true));

  const selectCell = (i: number) => {
    if (!active || puzzle.blocks[i]) return;
    if (i === cursor.cell) toggleDir();
    else setCursor({ cell: i, dir: cursor.dir });
  };

  const pickClue = (c: MiniClue) => {
    if (!active) return;
    setCursor(landOn(c, entries));
  };

  // ---- hints -------------------------------------------------------------------------------
  const revealSquare = () => {
    if (!active) return;
    const i = revealTarget(puzzle, cursor, entries);
    if (i < 0) return;
    onHint();
    const next = entries.slice();
    next[i] = puzzle.solution[i];
    const rev = revealed.map((v, j) => v || j === i);
    setRevealed(rev);
    setFlagged(clearFlag(i));
    const lockedNow = rev.map((r, j) => r || right[j]);
    const at: Cursor = clue.cells.includes(i) ? { cell: i, dir: cursor.dir } : { cell: i, dir: clueAt(puzzle, i, cursor.dir).dir };
    setCursor(afterType(puzzle, at, next, lockedNow, skipFilled));
    commit(next);
  };

  const checkWord = () => {
    if (!active) return;
    const toCheck = clue.cells.filter((i) => entries[i] && !locked[i]);
    if (!toCheck.length) {
      if (clue.cells.some((i) => !entries[i])) toast(t.nothingToCheck);
      return;
    }
    onHint();
    const good = toCheck.filter((i) => entries[i] === puzzle.solution[i]);
    const bad = toCheck.filter((i) => entries[i] !== puzzle.solution[i]);
    setRight(right.map((v, i) => v || good.includes(i)));
    setFlagged(flagged.map((v, i) => v || bad.includes(i)));
  };

  // ---- win -----------------------------------------------------------------------------------
  const finish = (grid: string[]) => {
    if (doneRef.current) return;
    doneRef.current = true;
    setWon(true);
    cellEls.current.forEach((el, i) => {
      if (!el || puzzle.blocks[i]) return;
      const r = Math.floor(i / N);
      const c = i % N;
      el.animate?.(
        [{ transform: 'scale(1)' }, { transform: 'scale(1.12) rotate(-4deg)', offset: 0.45 }, { transform: 'scale(1)' }],
        { duration: 480, delay: (r + c) * 70, easing: 'ease-in-out' },
      );
    });
    onComplete({
      won: true,
      share: t.share(N),
      summary: (
        <div className={styles.summary}>
          <span className={styles.summaryLabel}>{t.theGrid}</span>
          <div className={styles.summaryGrid} style={{ '--n': N } as CSSProperties}>
            {grid.map((ch, i) => (
              <span key={i} className={puzzle.blocks[i] ? styles.summaryBlock : undefined}>
                {puzzle.blocks[i] ? '' : ch}
              </span>
            ))}
          </div>
        </div>
      ),
    });
  };

  // ---- keyboard ------------------------------------------------------------------------------
  const onKey = (key: string, shift = false) => {
    if (!active) return;
    if (/^[A-ZÑ]$/.test(key)) typeLetter(key);
    else if (key === 'Backspace') erase();
    else if (key === 'Delete') deleteHere();
    else if (key === 'Enter' || key === 'Tab') nextClueSkipping(shift ? -1 : 1);
    else if (key === ' ') toggleDir();
    else if (key === 'ArrowLeft' || key === 'ArrowRight' || key === 'ArrowUp' || key === 'ArrowDown') setCursor(arrow(puzzle, cursor, key));
  };
  const keyHandler = useRef(onKey);
  keyHandler.current = onKey;
  useEffect(() => {
    const fn = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const target = e.target as HTMLElement | null;
      if (target?.closest?.('input, textarea, select, .lp-modal')) return;
      if ((e.key === 'Enter' || e.key === ' ') && target?.closest?.('button, a')) return;
      const key = keyToLetter(e.key, wordLang) ?? e.key;
      if (/^[A-ZÑ]$/.test(key) || ['Backspace', 'Delete', 'Enter', 'Tab', ' ', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(key)) {
        e.preventDefault();
        keyHandler.current(key, e.shiftKey);
      }
    };
    window.addEventListener('keydown', fn);
    return () => window.removeEventListener('keydown', fn);
  }, [wordLang]);

  // ---- rendering -----------------------------------------------------------------------------
  const isWrong = (i: number) => !!entries[i] && (flagged[i] || (autoCheck && entries[i] !== puzzle.solution[i]));
  const clueList = (dir: 'across' | 'down') => (
    <section className={styles.listSection}>
      <h3 className={styles.listTitle}>{dir === 'across' ? t.across : t.down}</h3>
      <ol className={styles.list}>
        {(dir === 'across' ? puzzle.across : puzzle.down).map((c) => {
          const isCur = c.dir === clue.dir && c.num === clue.num;
          const isCross = c.dir === cross.dir && c.num === cross.num;
          const done = c.cells.every((i) => entries[i]);
          return (
            <li key={c.num}>
              <button
                type="button"
                className={cx(styles.listItem, isCur && styles.listCur, isCross && styles.listCross, done && styles.listDone)}
                onClick={() => pickClue(c)}
                disabled={!active}
              >
                <span className={styles.listNum}>{c.num}</span>
                <span className={styles.listText}>{c.clue}</span>
              </button>
            </li>
          );
        })}
      </ol>
    </section>
  );

  const gridStyle = { '--n': N } as CSSProperties;

  return (
    <div className={cx(styles.wrap, won && styles.won)}>
      <div className={styles.main}>
        <div className={styles.board} style={gridStyle} role="grid" aria-label={t.grid}>
          {puzzle.blocks.map((block, i) => {
            const r = Math.floor(i / N);
            const c = i % N;
            if (block) return <div key={i} className={styles.block} role="gridcell" aria-label={t.blackSquare} />;
            const num = puzzle.numbers[i];
            const ch = entries[i];
            const wrong = isWrong(i);
            const state = revealed[i] ? t.stateRevealed : wrong ? t.stateWrong : right[i] ? t.stateRight : '';
            return (
              <div
                key={i}
                ref={(el) => {
                  cellEls.current[i] = el;
                }}
                role="gridcell"
                aria-label={t.cell(r + 1, c + 1, num, ch, state)}
                aria-selected={i === cursor.cell}
                className={cx(
                  styles.cell,
                  !won && wordCells.has(i) && styles.inWord,
                  !won && i === cursor.cell && styles.selected,
                  revealed[i] && styles.revealed,
                  right[i] && !revealed[i] && styles.right,
                  wrong && styles.wrong,
                )}
                onClick={() => selectCell(i)}
              >
                {num > 0 && <span className={styles.num}>{num}</span>}
                <span className={styles.letter}>{ch}</span>
              </div>
            );
          })}
        </div>

        <ControlBar>
          <ControlButton label={t.revealSquare} icon={<RevealIcon />} onClick={revealSquare} disabled={!active} />
          <ControlButton label={t.checkWord} icon={<CheckIcon />} onClick={checkWord} disabled={!active} />
        </ControlBar>

        <div className={styles.clueBar} aria-live="polite">
          <button type="button" className={styles.arrow} onClick={() => goClue(-1)} aria-label={t.prevClue} disabled={!active}>
            <ArrowIcon />
          </button>
          <button type="button" className={styles.clueBody} onClick={toggleDir} aria-label={`${t.clueRef(clue.num, clue.dir)}: ${clue.clue}. ${t.toggleDir}`} disabled={!active}>
            <span className={styles.clueNum}>
              {clue.num}
              {t.dirLetter(clue.dir)}
            </span>
            <span className={styles.clueText}>{won ? t.solved : clue.clue}</span>
          </button>
          <button type="button" className={styles.arrow} onClick={() => goClue(1)} aria-label={t.nextClue} disabled={!active}>
            <ArrowIcon flip />
          </button>
        </div>

        <Keyboard labels={t} layout={wordLang} disabled={!active} onKey={(k) => onKey(k)} />
      </div>

      <aside className={styles.lists}>
        {clueList('across')}
        {clueList('down')}
      </aside>
    </div>
  );
}
