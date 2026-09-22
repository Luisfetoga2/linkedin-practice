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

export function StatsPage({ gameId }: { gameId?: string }) {
  const histories = useAllHistories(gameIds);
  const entry = findGame(gameId);
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
              <Kpi label="Current streak" value={<><Flame size={18} className="kpi-flame" /> {streak.current}</>} />
              <Kpi label="Best streak" value={streak.max} />
              <Kpi label="Puzzles solved" value={wins} />
              <Kpi label="Rounds played" value={total} />
              <Kpi label="Days active" value={winDays.size} />
            </div>
            <ActivityHeatmap days={winDays} weeks={26} />
          </section>

          <nav className="stats-tabs" aria-label="Choose a game">
            <a className={`stats-tab${!entry ? ' is-on' : ''}`} href={href('stats')}>
              All games
            </a>
            {games.map(({ meta }) => (
              <a key={meta.id} className={`stats-tab${entry?.meta.id === meta.id ? ' is-on' : ''}`} href={href(`stats/${meta.id}`)}>
                <span className="stats-tab-icon" style={{ background: meta.tint }}>
                  <meta.Icon size={18} />
                </span>
                {meta.name}
              </a>
            ))}
          </nav>

          {entry ? <GameStatsView entry={entry} history={histories[entry.meta.id] ?? []} /> : <AllGames histories={histories} />}

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
                <div className="stats-card-name">{meta.name}</div>
                <div className="stats-card-sub">{s.played ? `${s.played} played` : 'Not played yet'}</div>
              </div>
            </div>
            <div className="stats-card-kpis">
              <div>
                <strong>{s.streak.current}</strong>
                <span>Streak</span>
              </div>
              {meta.scoring === 'time' ? (
                <div>
                  <strong>{s.bestMs !== null ? formatTime(s.bestMs) : '–'}</strong>
                  <span>Best</span>
                </div>
              ) : (
                <div>
                  <strong>{s.played ? `${Math.round(s.winRate * 100)}%` : '–'}</strong>
                  <span>Win rate</span>
                </div>
              )}
              <div>
                <strong>{s.avgMs !== null ? formatTime(s.avgMs) : '–'}</strong>
                <span>Average</span>
              </div>
            </div>
          </a>
        );
      })}
    </div>
  );
}

function variantLabel(entry: GameEntry, variant: string): string {
  if (!variant) return 'Standard';
  const parts = new URLSearchParams(variant);
  return (entry.meta.options ?? [])
    .map((o) => o.choices.find((c) => c.value === parts.get(o.id))?.label ?? parts.get(o.id))
    .filter(Boolean)
    .join(' · ');
}

function GameStatsView({ entry, history }: { entry: GameEntry; history: PlayRecord[] }) {
  const { meta } = entry;
  const variants = useMemo(() => [...new Set(history.map((r) => r.variant))].sort(), [history]);
  const [variant, setVariant] = useState<string>('*');
  const active = variant === '*' || !variants.includes(variant) ? undefined : variant;
  const recs = active === undefined ? history : history.filter((r) => r.variant === active);
  const s = computeStats(history, active);
  const guessGame = meta.scoring === 'guesses';

  const resetGame = () => {
    if (confirm(`Delete all ${meta.name} history on this device? This can't be undone.`)) {
      clearHistory(meta.id);
      toast(`${meta.name} stats reset`);
    }
  };

  return (
    <section className="card stats-game" style={{ '--game-color': meta.color, '--game-tint': meta.tint } as React.CSSProperties}>
      <div className="stats-game-head">
        <span className="stats-card-icon" style={{ background: meta.tint }}>
          <meta.Icon size={36} />
        </span>
        <div className="stats-game-title">
          <h2>{meta.name}</h2>
          <p>{meta.tagline}</p>
        </div>
        <a className="btn btn-primary btn-sm" href={href(meta.id)}>
          Play
        </a>
      </div>

      {variants.length > 1 && (
        <div className="stats-filter">
          <Segmented
            label="Puzzle type"
            value={active ?? '*'}
            onChange={setVariant}
            choices={[{ value: '*', label: 'All' }, ...variants.map((v) => ({ value: v, label: variantLabel(entry, v) }))]}
          />
        </div>
      )}

      {s.played === 0 ? (
        <div className="stats-empty">
          <p>No rounds yet. Play one to start tracking your times.</p>
        </div>
      ) : (
        <>
          <div className="stats-kpis">
            <Kpi label="Played" value={s.played} />
            <Kpi label={guessGame ? 'Win rate' : 'Solved'} value={guessGame ? `${Math.round(s.winRate * 100)}%` : s.wins} />
            <Kpi label="Day streak" value={s.streak.current} sub={`Best ${s.streak.max}`} />
            {guessGame ? (
              <Kpi label="Win streak" value={s.winStreak} sub={`Best ${s.maxWinStreak}`} />
            ) : (
              <Kpi label="Best time" value={s.bestMs !== null ? formatTime(s.bestMs) : '–'} />
            )}
            <Kpi label="Average" value={s.avgMs !== null ? formatTime(s.avgMs) : '–'} />
            <Kpi label="Median" value={s.medianMs !== null ? formatTime(s.medianMs) : '–'} />
            <Kpi label="Last 10 avg" value={s.last10AvgMs !== null ? formatTime(s.last10AvgMs) : '–'} />
            {guessGame ? (
              <Kpi label="Avg guesses" value={s.avgGuesses !== null ? s.avgGuesses.toFixed(2) : '–'} />
            ) : (
              <Kpi label="Hint-free" value={s.cleanWins} sub={`${s.hintsUsed} hints used`} />
            )}
          </div>

          <div className="stats-charts">
            <figure className="chart-block">
              <figcaption>
                <span className="chart-title">Solve times</span>
                <span className="chart-sub">Last {Math.min(30, recs.filter((r) => r.won).length)} solves · dashed line is your average</span>
              </figcaption>
              <TimesChart records={recs.filter((r) => r.won).slice(-30)} avgMs={s.avgMs} entry={entry} />
            </figure>
            <figure className="chart-block">
              {guessGame ? (
                <>
                  <figcaption>
                    <span className="chart-title">Guess distribution</span>
                    <span className="chart-sub">Wins by number of guesses</span>
                  </figcaption>
                  <GuessDist dist={s.guessDist} max={meta.maxGuesses ?? 6} losses={s.played - s.wins} />
                </>
              ) : (
                <>
                  <figcaption>
                    <span className="chart-title">Time distribution</span>
                    <span className="chart-sub">How often you finish in each time range</span>
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
            Reset {meta.name} stats
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
  const wrap = useRef<HTMLDivElement>(null);
  const [W, setW] = useState(480);
  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setW(Math.max(240, Math.round(e.contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, [records.length === 0]);
  if (records.length === 0) return <p className="chart-empty">No solves yet.</p>;
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
      <svg viewBox={`0 0 ${W} ${H}`} className="chart-svg" role="img" aria-label="Recent solve times">
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
              <path d={d} className={`chart-bar${r.ms === best ? ' is-best' : ''}${hover === i ? ' is-hover' : ''}`} />
            </g>
          );
        })}
        {avgMs !== null && <line x1={padL} x2={W} y1={y(avgMs)} y2={y(avgMs)} className="chart-avg" />}
      </svg>
      {hover !== null && records[hover] && (
        <div
          className="chart-tip"
          style={{
            left: `${((padL + hover * slot + slot / 2) / W) * 100}%`,
            top: `${(y(records[hover].ms) / H) * 100}%`,
          }}
        >
          <strong>{formatTime(records[hover].ms)}</strong>
          <span>{new Date(records[hover].at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span>
          <span>{variantLabel(entry, records[hover].variant)}</span>
          {records[hover].hints > 0 && <span>{records[hover].hints} hints</span>}
        </div>
      )}
    </div>
  );
}

function TimeHistogram({ times }: { times: number[] }) {
  const [hover, setHover] = useState<number | null>(null);
  if (times.length === 0) return <p className="chart-empty">No solves yet.</p>;
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

function when(at: number): string {
  const d = new Date(at);
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  const time = d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  return sameDay ? `Today ${time}` : `${d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} ${time}`;
}

function RecentTable({ entry, records }: { entry: GameEntry; records: PlayRecord[] }) {
  const guessGame = entry.meta.scoring === 'guesses';
  return (
    <div className="recent">
      <h3 className="chart-title">Recent rounds</h3>
      <div className="recent-scroll">
        <table className="recent-table">
          <thead>
            <tr>
              <th>When</th>
              <th>Puzzle</th>
              <th className="num">Time</th>
              {guessGame && <th className="num">Guesses</th>}
              <th className="num">Hints</th>
              <th>Result</th>
              <th>
                <span className="visually-hidden">Replay</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {records.map((r) => {
              const opts = Object.fromEntries(new URLSearchParams(r.variant));
              return (
                <tr key={r.at}>
                  <td>{when(r.at)}</td>
                  <td>{variantLabel(entry, r.variant)}</td>
                  <td className="num">{formatTime(r.ms)}</td>
                  {guessGame && <td className="num">{r.won ? r.guesses : '–'}</td>}
                  <td className="num">{r.hints}</td>
                  <td>{r.won ? <span className="tag tag-good">Solved</span> : <span className="tag">Missed</span>}</td>
                  <td>
                    <a href={href(entry.meta.id, { s: seedToCode(r.seed), ...opts })}>Replay</a>
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
      if (!confirm('Replace the stats on this device with the imported file?')) return;
      for (const [k, v] of Object.entries(parsed.data)) writeJSON(k, v);
      toast('Stats imported');
    } catch {
      toast('That file is not a Games Practice export');
    }
  };
  return (
    <section className="card data-tools">
      <div>
        <h3 className="chart-title">Your data</h3>
        <p className="chart-sub">Everything is stored in this browser. Export a backup or move it to another device.</p>
      </div>
      <div className="data-tools-actions">
        <button className="btn btn-secondary btn-sm" onClick={exportData}>
          Export
        </button>
        <button className="btn btn-secondary btn-sm" onClick={() => file.current?.click()}>
          Import
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
