import { useMemo, useState } from 'react';
import { statsVariant, type GameMeta, type GameResult } from './types';
import { Modal } from './components/Modal';
import { Chart, Clock, Share } from './components/Icons';
import { computeStats, useHistory, variantKey } from '../lib/stats';
import { formatTime } from '../lib/time';
import { seedToCode } from '../lib/rng';
import { href } from '../lib/router';
import { toast } from './components/Toast';
import { pick } from '../lib/i18n';
import { useCore } from '../i18n/core';

export interface FinishedRound {
  result: GameResult;
  ms: number;
  hints: number;
  isBest: boolean;
  priorAvgMs: number | null;
  seed: number;
  options: Record<string, string>;
}

export function ResultSheet({ open, meta, round, onClose, onPlayAgain }: { open: boolean; meta: GameMeta; round: FinishedRound; onClose(): void; onPlayAgain(): void }) {
  const history = useHistory(meta.id);
  const { t, lang } = useCore();
  const name = pick(meta.name, lang);
  const variant = variantKey(statsVariant(meta, round.options));
  const stats = useMemo(() => computeStats(history, variant), [history, variant]);
  const [bestHeadline] = useState(() => round.isBest && stats.played > 1);
  const headline = bestHeadline ? t.newBest : t.winLines[round.seed % t.winLines.length];
  const { result } = round;
  const diff = round.priorAvgMs !== null && result.won ? round.ms - round.priorAvgMs : null;

  const share = async () => {
    const url = new URL(window.location.href);
    url.hash = href(meta.id, { s: seedToCode(round.seed), ...round.options });
    const score = meta.scoring === 'guesses' ? `${result.won ? result.guesses : 'X'}/${meta.maxGuesses ?? '?'}` : formatTime(round.ms);
    const text = [
      `${t.shareHeader(name, seedToCode(round.seed))} | ${score}${round.hints ? ` | 💡${round.hints}` : ''}`,
      result.share,
      url.toString(),
    ]
      .filter(Boolean)
      .join('\n');
    try {
      if (navigator.share && matchMedia('(pointer: coarse)').matches) await navigator.share({ text });
      else {
        await navigator.clipboard.writeText(text);
        toast(t.copied);
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
          <h2 className="lp-result-headline">{result.won ? headline : t.niceTry}</h2>
          {meta.scoring === 'guesses' && (
            <p className="lp-result-sub">{result.won ? t.solvedInGuesses(result.guesses ?? 0) : t.outOfGuesses}</p>
          )}
          <div className="lp-result-time">
            <Clock size={22} />
            <span>{formatTime(round.ms)}</span>
          </div>
          <div className="lp-result-chips">
            {round.isBest && stats.played > 1 && <span className="lp-pill lp-pill-gold">{t.personalBest}</span>}
            {result.won && meta.hasHints !== false && <span className="lp-pill">{round.hints === 0 ? t.noHints : t.hintsCount(round.hints)}</span>}
            {diff !== null && Math.abs(diff) >= 1000 && (
              <span className={`lp-pill ${diff < 0 ? 'lp-pill-good' : ''}`}>
                {t.vsAverage(formatTime(Math.abs(diff)), diff < 0)}
              </span>
            )}
          </div>
          {result.summary && <div className="lp-result-summary">{result.summary}</div>}
        </div>

        <div className="lp-result-stats">
          <Stat label={t.played} value={stats.played} />
          {meta.scoring === 'guesses' ? <Stat label={t.winPct} value={Math.round(stats.winRate * 100)} /> : <Stat label={t.best} value={stats.bestMs !== null ? formatTime(stats.bestMs) : '–'} />}
          <Stat label={t.average} value={stats.avgMs !== null ? formatTime(stats.avgMs) : '–'} />
          <Stat label={t.streak} value={`🔥 ${stats.streak.current}`} />
        </div>

        {meta.scoring === 'guesses' && (
          <div className="lp-dist">
            <p className="lp-dist-title">{t.guessDistribution}</p>
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
            {t.playAgain}
          </button>
          <div className="lp-result-actions-row">
            <button className="btn btn-secondary" onClick={share}>
              <Share size={16} /> {t.share}
            </button>
            <a className="btn btn-secondary" href={href(`stats/${meta.id}`)}>
              <Chart size={16} /> {t.stats}
            </a>
            <button className="btn btn-tertiary" onClick={onClose}>
              {t.seeBoard}
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
