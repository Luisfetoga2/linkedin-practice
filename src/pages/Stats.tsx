import { useEffect, useMemo, useRef, useState } from 'react';
import { findGame, games, gameIds } from '../games/registry';
import type { GameEntry } from '../core/types';
import { href } from '../lib/router';
import { clearHistory, computeStats, dayStreak, useAllHistories, winDaysFrom, type PlayRecord } from '../lib/stats';
import { formatTime } from '../lib/time';
import { seedToCode } from '../lib/rng';
import { allKeys, readJSON, writeJSON } from '../lib/storage';
import { Segmented } from '../core/components/Controls';
import { Flame } from '../core/components/Icons';
import { toast } from '../core/components/Toast';
import { SiteFooter, SiteHeader } from './SiteHeader';
import { ActivityHeatmap } from './Activity';
import { ChartTip } from './ChartTip';
import { CasinoStatsSection } from '../casino/CasinoStatsSection';
import { formatClock, formatDate, pick, type Lang } from '../lib/i18n';
import { useCore, type CoreStrings } from '../i18n/core';

export function StatsPage({ gameId }: { gameId?: string }) {
  const histories = useAllHistories(gameIds);
  const entry = findGame(gameId);
  const { t, lang } = useCore();
  const winDays = useMemo(() => winDaysFrom(histories), [histories]);
  const streak = dayStreak(winDays.keys());
  const total = Object.values(histories).reduce((a, h) => a + h.length, 0);
  const wins = [...winDays.values()].reduce((a, b) => a + b, 0);

  return (
    <div className="site">
      <SiteHeader active="stats" />
      <main className="site-main">
        <div className="stats-wrap">
          <section className="card stats-overview">
            <div className="stats-overview-kpis">
              <Kpi label={t.currentStreak} value={<><Flame size={18} className="kpi-flame" /> {streak.current}</>} />
              <Kpi label={t.bestStreak} value={streak.max} />
              <Kpi label={t.puzzlesSolved} value={wins} />
              <Kpi label={t.roundsPlayed} value={total} />
              <Kpi label={t.daysActive} value={winDays.size} />
            </div>
            <ActivityHeatmap days={winDays} weeks={26} />
          </section>

          <nav className="stats-tabs" aria-label={t.chooseGame}>
            <a className={`stats-tab${!entry ? ' is-on' : ''}`} href={href('stats')}>
              {t.allGames}
            </a>
            {games.map(({ meta }) => (
              <a key={meta.id} className={`stats-tab${entry?.meta.id === meta.id ? ' is-on' : ''}`} href={href(`stats/${meta.id}`)}>
                <span className="stats-tab-icon" style={{ background: meta.tint }}>
                  <meta.Icon size={18} />
                </span>
                {pick(meta.name, lang)}
              </a>
            ))}
          </nav>

          {entry ? <GameStatsView entry={entry} history={histories[entry.meta.id] ?? []} /> : <AllGames histories={histories} />}
          {!entry && <CasinoStatsSection />}

          <DataTools />
          <SiteFooter />
        </div>
      </main>
    </div>
  );
}

function Kpi({ label, value, sub }: { label: string; value: React.ReactNode; sub?: string }) {
  return (
    <div className="kpi">
      <span className="kpi-value">{value}</span>
      <span className="kpi-label">{label}</span>
      {sub && <span className="kpi-sub">{sub}</span>}
    </div>
  );
}

function AllGames({ histories }: { histories: Record<string, PlayRecord[]> }) {
  const { t, lang } = useCore();
  return (
    <div className="stats-cards">
      {games.map(({ meta }) => {
        const s = computeStats(histories[meta.id] ?? []);
        return (
          <a key={meta.id} className="card stats-card" href={href(`stats/${meta.id}`)}>
            <div className="stats-card-head">
              <span className="stats-card-icon" style={{ background: meta.tint }}>
                <meta.Icon size={32} />
              </span>
              <div>
                <div className="stats-card-name">{pick(meta.name, lang)}</div>
                <div className="stats-card-sub">{s.played ? t.nPlayed(s.played) : t.notPlayed}</div>
              </div>
            </div>
            <div className="stats-card-kpis">
              <div>
                <strong>{s.streak.current}</strong>
                <span>{t.streak}</span>
              </div>
              {meta.scoring === 'time' ? (
                <div>
                  <strong>{s.bestMs !== null ? formatTime(s.bestMs) : '–'}</strong>
                  <span>{t.best}</span>
                </div>
              ) : (
                <div>
                  <strong>{s.played ? `${Math.round(s.winRate * 100)}%` : '–'}</strong>
                  <span>{t.winRate}</span>
                </div>
              )}
              <div>
                <strong>{s.avgMs !== null ? formatTime(s.avgMs) : '–'}</strong>
                <span>{t.average}</span>
              </div>
            </div>
          </a>
        );
      })}
    </div>
  );
}

function variantLabel(entry: GameEntry, variant: string, t: CoreStrings, lang: Lang): string {
  if (!variant) return t.standard;
  const parts = new URLSearchParams(variant);
  return (entry.meta.options ?? [])
    .map((o) => {
      const label = o.choices.find((c) => c.value === parts.get(o.id))?.label;
      return label === undefined ? parts.get(o.id) : pick(label, lang);
    })
    .filter(Boolean)
    .join(' · ');
}

function GameStatsView({ entry, history }: { entry: GameEntry; history: PlayRecord[] }) {
  const { meta } = entry;
  const { t, lang } = useCore();
  const name = pick(meta.name, lang);
  const variants = useMemo(() => [...new Set(history.map((r) => r.variant))].sort(), [history]);
  const [variant, setVariant] = useState<string>('*');
  const active = variant === '*' || !variants.includes(variant) ? undefined : variant;
  const recs = active === undefined ? history : history.filter((r) => r.variant === active);
  const s = computeStats(history, active);
  const guessGame = meta.scoring === 'guesses';

  const resetGame = () => {
    if (confirm(t.resetConfirm(name))) {
      clearHistory(meta.id);
      toast(t.resetDone(name));
    }
  };

  return (
    <section className="card stats-game" style={{ '--game-color': meta.color, '--game-tint': meta.tint } as React.CSSProperties}>
      <div className="stats-game-head">
        <span className="stats-card-icon" style={{ background: meta.tint }}>
          <meta.Icon size={36} />
        </span>
        <div className="stats-game-title">
          <h2>{name}</h2>
          <p>{pick(meta.tagline, lang)}</p>
        </div>
        <a className="btn btn-primary btn-sm" href={href(meta.id)}>
          {t.play}
        </a>
      </div>

      {variants.length > 1 && (
        <div className="stats-filter">
          <Segmented
            label={t.puzzleType}
            value={active ?? '*'}
            onChange={setVariant}
            choices={[{ value: '*', label: t.all }, ...variants.map((v) => ({ value: v, label: variantLabel(entry, v, t, lang) }))]}
          />
        </div>
      )}

      {s.played === 0 ? (
        <div className="stats-empty">
          <p>{t.noRounds}</p>
        </div>
      ) : (
        <>
          <div className="stats-kpis">
            <Kpi label={t.played} value={s.played} />
            <Kpi label={guessGame || meta.canLose ? t.winRate : t.solved} value={guessGame || meta.canLose ? `${Math.round(s.winRate * 100)}%` : s.wins} />
            <Kpi label={t.dayStreakLabel} value={s.streak.current} sub={t.bestN(s.streak.max)} />
            {guessGame ? (
              <Kpi label={t.winStreak} value={s.winStreak} sub={t.bestN(s.maxWinStreak)} />
            ) : (
              <Kpi label={t.bestTimeLabel} value={s.bestMs !== null ? formatTime(s.bestMs) : '–'} />
            )}
            <Kpi label={t.average} value={s.avgMs !== null ? formatTime(s.avgMs) : '–'} />
            <Kpi label={t.median} value={s.medianMs !== null ? formatTime(s.medianMs) : '–'} />
            <Kpi label={t.last10} value={s.last10AvgMs !== null ? formatTime(s.last10AvgMs) : '–'} />
            {guessGame ? (
              <Kpi label={t.avgGuesses} value={s.avgGuesses !== null ? s.avgGuesses.toLocaleString(lang === 'es' ? 'es-419' : 'en-US', { maximumFractionDigits: 2, minimumFractionDigits: 2 }) : '–'} />
            ) : (
              <Kpi label={t.hintFree} value={s.cleanWins} sub={t.hintsUsed(s.hintsUsed)} />
            )}
          </div>

          <div className="stats-charts">
            <figure className="chart-block">
              <figcaption>
                <span className="chart-title">{t.solveTimes}</span>
                <span className="chart-sub">{t.solveTimesSub(Math.min(30, recs.filter((r) => r.won).length))}</span>
              </figcaption>
              <TimesChart records={recs.filter((r) => r.won).slice(-30)} avgMs={s.avgMs} entry={entry} />
            </figure>
            <figure className="chart-block">
              {guessGame ? (
                <>
                  <figcaption>
                    <span className="chart-title">{t.guessDistribution}</span>
                    <span className="chart-sub">{t.guessDistributionSub}</span>
                  </figcaption>
                  <GuessDist dist={s.guessDist} max={meta.maxGuesses ?? 6} losses={s.played - s.wins} />
                </>
              ) : (
                <>
                  <figcaption>
                    <span className="chart-title">{t.timeDistribution}</span>
                    <span className="chart-sub">{t.timeDistributionSub}</span>
                  </figcaption>
                  <TimeHistogram times={recs.filter((r) => r.won).map((r) => r.ms)} />
                </>
              )}
            </figure>
          </div>

          <RecentTable entry={entry} records={recs.slice(-25).reverse()} />
        </>
      )}
      {history.length > 0 && (
        <div className="stats-danger">
          <button className="btn btn-tertiary btn-sm" onClick={resetGame}>
            {t.resetGame(name)}
          </button>
        </div>
      )}
    </section>
  );
}

function niceStep(maxMs: number): number {
  const steps = [5, 10, 15, 30, 60, 120, 300, 600, 900, 1800, 3600].map((s) => s * 1000);
  return steps.find((s) => maxMs / s <= 4) ?? 3600_000;
}

function TimesChart({ records, avgMs, entry }: { records: PlayRecord[]; avgMs: number | null; entry: GameEntry }) {
  const [hover, setHover] = useState<number | null>(null);
  const bars = useRef<(SVGPathElement | null)[]>([]);
  const { t, lang } = useCore();
  const wrap = useRef<HTMLDivElement>(null);
  const [W, setW] = useState(480);
  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setW(Math.max(240, Math.round(e.contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, [records.length === 0]);
  if (records.length === 0) return <p className="chart-empty">{t.noSolvesYet}</p>;
  const H = 180;
  const padL = 40;
  const padB = 6;
  const padT = 8;
  const max = Math.max(...records.map((r) => r.ms), avgMs ?? 0);
  const step = niceStep(max);
  const top = Math.ceil(max / step) * step;
  const y = (ms: number) => padT + (H - padT - padB) * (1 - ms / top);
  const slot = (W - padL) / Math.max(records.length, 10);
  const barW = Math.max(4, Math.min(22, slot - 2));
  const best = Math.min(...records.map((r) => r.ms));
  const ticks = Array.from({ length: Math.round(top / step) + 1 }, (_, i) => i * step);

  return (
    <div className="chart" ref={wrap}>
      <svg viewBox={`0 0 ${W} ${H}`} className="chart-svg" role="img" aria-label={t.recentSolveTimes}>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={padL} x2={W} y1={y(t)} y2={y(t)} className={t === 0 ? 'chart-baseline' : 'chart-grid'} />
            <text x={padL - 6} y={y(t) + 4} className="chart-tick" textAnchor="end">
              {formatTime(t)}
            </text>
          </g>
        ))}
        {records.map((r, i) => {
          const x = padL + i * slot + (slot - barW) / 2;
          const h = Math.max(2, y(0) - y(r.ms));
          const rad = Math.min(4, barW / 2, h);
          const yTop = y(0) - h;
          const d = `M${x},${y(0)} V${yTop + rad} Q${x},${yTop} ${x + rad},${yTop} H${x + barW - rad} Q${x + barW},${yTop} ${x + barW},${yTop + rad} V${y(0)} Z`;
          return (
            <g key={r.at} onPointerEnter={() => setHover(i)} onPointerLeave={() => setHover(null)}>
              <rect x={padL + i * slot} y={padT} width={slot} height={H - padT - padB} fill="transparent" />
              <path
                ref={(el) => {
                  bars.current[i] = el;
                }}
                d={d}
                className={`chart-bar${r.ms === best ? ' is-best' : ''}${hover === i ? ' is-hover' : ''}`}
              />
            </g>
          );
        })}
        {avgMs !== null && <line x1={padL} x2={W} y1={y(avgMs)} y2={y(avgMs)} className="chart-avg" />}
      </svg>
      {hover !== null && records[hover] && bars.current[hover] && (
        <ChartTip anchor={bars.current[hover]!}>
          <strong>{formatTime(records[hover].ms)}</strong>
          <span>{formatDate(records[hover].at, lang, { month: 'short', day: 'numeric' })}</span>
          <span>{variantLabel(entry, records[hover].variant, t, lang)}</span>
          {records[hover].hints > 0 && <span>{t.hintsCount(records[hover].hints)}</span>}
        </ChartTip>
      )}
    </div>
  );
}

function TimeHistogram({ times }: { times: number[] }) {
  const [hover, setHover] = useState<number | null>(null);
  const { t } = useCore();
  if (times.length === 0) return <p className="chart-empty">{t.noSolvesYet}</p>;
  const max = Math.max(...times);
  const candidates = [10, 15, 30, 60, 120, 300, 600].map((s) => s * 1000);
  const bucket = candidates.find((b) => max / b <= 8) ?? 600_000;
  const n = Math.max(1, Math.ceil((max + 1) / bucket));
  const counts = Array.from({ length: n }, () => 0);
  for (const t of times) counts[Math.min(n - 1, Math.floor(t / bucket))]++;
  const peak = Math.max(...counts);
  return (
    <div className="hbars">
      {counts.map((c, i) => (
        <div key={i} className="hbar-row" onPointerEnter={() => setHover(i)} onPointerLeave={() => setHover(null)}>
          <span className="hbar-label">
            {formatTime(i * bucket)}–{formatTime((i + 1) * bucket)}
          </span>
          <span className="hbar-track">
            <span className={`hbar${hover === i ? ' is-hover' : ''}`} style={{ width: `${c ? Math.max(3, (c / peak) * 100) : 0}%` }} />
          </span>
          <span className="hbar-value">{c}</span>
        </div>
      ))}
    </div>
  );
}

function GuessDist({ dist, max, losses }: { dist: number[]; max: number; losses: number }) {
  const rows = Array.from({ length: max }, (_, i) => ({ label: String(i + 1), n: dist[i + 1] ?? 0 }));
  rows.push({ label: 'X', n: losses });
  const peak = Math.max(1, ...rows.map((r) => r.n));
  return (
    <div className="hbars hbars-short">
      {rows.map((r) => (
        <div key={r.label} className="hbar-row">
          <span className="hbar-label hbar-label-short">{r.label}</span>
          <span className="hbar-track">
            <span className={`hbar${r.label === 'X' ? ' is-muted' : ''}`} style={{ width: `${r.n ? Math.max(3, (r.n / peak) * 100) : 0}%` }} />
          </span>
          <span className="hbar-value">{r.n}</span>
        </div>
      ))}
    </div>
  );
}

function when(at: number, t: CoreStrings, lang: Lang): string {
  const d = new Date(at);
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  const time = formatClock(d, lang);
  return sameDay ? t.todayAt(time) : `${formatDate(d, lang, { month: 'short', day: 'numeric' })} ${time}`;
}

function RecentTable({ entry, records }: { entry: GameEntry; records: PlayRecord[] }) {
  const guessGame = entry.meta.scoring === 'guesses';
  const { t, lang } = useCore();
  return (
    <div className="recent">
      <h3 className="chart-title">{t.recentRounds}</h3>
      <div className="recent-scroll">
        <table className="recent-table">
          <thead>
            <tr>
              <th>{t.colWhen}</th>
              <th>{t.colPuzzle}</th>
              <th className="num">{t.colTime}</th>
              {guessGame && <th className="num">{t.colGuesses}</th>}
              <th className="num">{t.colHints}</th>
              <th>{t.colResult}</th>
              <th>
                <span className="visually-hidden">{t.replay}</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {records.map((r) => {
              const opts = Object.fromEntries(new URLSearchParams(r.variant));
              return (
                <tr key={r.at}>
                  <td>{when(r.at, t, lang)}</td>
                  <td>{variantLabel(entry, r.variant, t, lang)}</td>
                  <td className="num">{formatTime(r.ms)}</td>
                  {guessGame && <td className="num">{r.won ? r.guesses : '–'}</td>}
                  <td className="num">{r.hints}</td>
                  <td>{r.won ? <span className="tag tag-good">{t.solved}</span> : <span className="tag">{t.missed}</span>}</td>
                  <td>
                    <a href={href(entry.meta.id, { s: seedToCode(r.seed), ...opts })}>{t.replay}</a>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function DataTools() {
  const file = useRef<HTMLInputElement>(null);
  const { t } = useCore();
  const exportData = () => {
    const data: Record<string, unknown> = {};
    for (const k of allKeys()) data[k] = readJSON(k, null);
    const blob = new Blob([JSON.stringify({ app: 'games-practice', version: 1, exportedAt: new Date().toISOString(), data }, null, 2)], {
      type: 'application/json',
    });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `games-practice-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };
  const importData = async (f: File) => {
    try {
      const parsed = JSON.parse(await f.text());
      if (parsed?.app !== 'games-practice' || typeof parsed.data !== 'object') throw new Error('bad file');
      if (!confirm(t.importConfirm)) return;
      for (const [k, v] of Object.entries(parsed.data)) writeJSON(k, v);
      toast(t.imported);
    } catch {
      toast(t.badImport);
    }
  };
  return (
    <section className="card data-tools">
      <div>
        <h3 className="chart-title">{t.yourData}</h3>
        <p className="chart-sub">{t.yourDataDesc}</p>
      </div>
      <div className="data-tools-actions">
        <button className="btn btn-secondary btn-sm" onClick={exportData}>
          {t.export}
        </button>
        <button className="btn btn-secondary btn-sm" onClick={() => file.current?.click()}>
          {t.import}
        </button>
        <input
          ref={file}
          type="file"
          accept="application/json"
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) importData(f);
            e.target.value = '';
          }}
        />
      </div>
    </section>
  );
}
