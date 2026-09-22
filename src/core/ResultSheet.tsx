import { useMemo, useState } from 'react';
import type { GameMeta, GameResult } from './types';
import { Modal } from './components/Modal';
import { Chart, Clock, Share } from './components/Icons';
import { computeStats, useHistory, variantKey } from '../lib/stats';
import { formatTime } from '../lib/time';
import { seedToCode } from '../lib/rng';
import { href } from '../lib/router';
import { toast } from './components/Toast';

export interface FinishedRound {
  result: GameResult;
  ms: number;
  hints: number;
  isBest: boolean;
  priorAvgMs: number | null;
  seed: number;
  options: Record<string, string>;
}

const WIN_LINES = ["You're crushing it!", 'Nicely done!', 'Brilliant!', 'Impressive!', 'Great job!', 'Well played!', 'Sharp thinking!'];

export function ResultSheet({ open, meta, round, onClose, onPlayAgain }: { open: boolean; meta: GameMeta; round: FinishedRound; onClose(): void; onPlayAgain(): void }) {
  const history = useHistory(meta.id);
  const variant = variantKey(round.options);
  const stats = useMemo(() => computeStats(history, variant), [history, variant]);
  const [headline] = useState(() => (round.isBest && stats.played > 1 ? 'New personal best!' : WIN_LINES[round.seed % WIN_LINES.length]));
  const { result } = round;
  const diff = round.priorAvgMs !== null && result.won ? round.ms - round.priorAvgMs : null;

  const share = async () => {
    const url = new URL(window.location.href);
    url.hash = href(meta.id, { s: seedToCode(round.seed), ...round.options });
    const score = meta.scoring === 'guesses' ? `${result.won ? result.guesses : 'X'}/${meta.maxGuesses ?? '?'}` : formatTime(round.ms);
    const text = [
      `${meta.name} practice #${seedToCode(round.seed)} | ${score}${round.hints ? ` | 💡${round.hints}` : ''}`,
      result.share,
      url.toString(),
    ]
      .filter(Boolean)
      .join('\n');
    try {
      if (navigator.share && matchMedia('(pointer: coarse)').matches) await navigator.share({ text });
      else {
        await navigator.clipboard.writeText(text);
        toast('Copied results to clipboard');
      }
    } catch {
      // user cancelled share
    }
  };

  const maxDist = Math.max(1, ...stats.guessDist.filter(Boolean));

  return (
    <Modal open={open} onClose={onClose}>
      <div className="lp-result" style={{ '--game-color': meta.color, '--game-tint': meta.tint } as React.CSSProperties}>
        <div className="lp-result-hero">
          <div className="lp-result-icon">
            <meta.Icon size={48} />
          </div>
          <h2 className="lp-result-headline">{result.won ? headline : 'Nice try!'}</h2>
          {meta.scoring === 'guesses' && (
            <p className="lp-result-sub">{result.won ? `Solved in ${result.guesses} ${result.guesses === 1 ? 'guess' : 'guesses'}` : 'Out of guesses this round'}</p>
          )}
          <div className="lp-result-time">
            <Clock size={22} />
            <span>{formatTime(round.ms)}</span>
          </div>
          <div className="lp-result-chips">
            {round.isBest && stats.played > 1 && <span className="lp-pill lp-pill-gold">Personal best</span>}
            {result.won && <span className="lp-pill">{round.hints === 0 ? 'No hints' : `${round.hints} hint${round.hints > 1 ? 's' : ''}`}</span>}
            {diff !== null && Math.abs(diff) >= 1000 && (
              <span className={`lp-pill ${diff < 0 ? 'lp-pill-good' : ''}`}>
                {formatTime(Math.abs(diff))} {diff < 0 ? 'faster' : 'slower'} than avg
              </span>
            )}
          </div>
          {result.summary && <div className="lp-result-summary">{result.summary}</div>}
        </div>

        <div className="lp-result-stats">
          <Stat label="Played" value={stats.played} />
          {meta.scoring === 'guesses' ? <Stat label="Win %" value={Math.round(stats.winRate * 100)} /> : <Stat label="Best" value={stats.bestMs !== null ? formatTime(stats.bestMs) : '–'} />}
          <Stat label="Average" value={stats.avgMs !== null ? formatTime(stats.avgMs) : '–'} />
          <Stat label="Streak" value={`🔥 ${stats.streak.current}`} />
        </div>

        {meta.scoring === 'guesses' && (
          <div className="lp-dist">
            <p className="lp-dist-title">Guess distribution</p>
            {Array.from({ length: meta.maxGuesses ?? 6 }, (_, i) => i + 1).map((g) => {
              const n = stats.guessDist[g] ?? 0;
              const mine = result.won && result.guesses === g;
              return (
                <div key={g} className="lp-dist-row">
                  <span className="lp-dist-label">{g}</span>
                  <span className={`lp-dist-bar${mine ? ' is-mine' : ''}`} style={{ width: `${Math.max(7, (n / maxDist) * 100)}%` }}>
                    {n}
                  </span>
                </div>
              );
            })}
          </div>
        )}

        <div className="lp-result-actions">
          <button className="btn btn-primary btn-block" onClick={onPlayAgain} autoFocus>
            Play again
          </button>
          <div className="lp-result-actions-row">
            <button className="btn btn-secondary" onClick={share}>
              <Share size={16} /> Share
            </button>
            <a className="btn btn-secondary" href={href(`stats/${meta.id}`)}>
              <Chart size={16} /> Stats
            </a>
            <button className="btn btn-tertiary" onClick={onClose}>
              See board
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="lp-stat">
      <span className="lp-stat-value">{value}</span>
      <span className="lp-stat-label">{label}</span>
    </div>
  );
}
