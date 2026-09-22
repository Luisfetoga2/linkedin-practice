import { useMemo } from 'react';
import { games, gameIds } from '../games/registry';
import { href } from '../lib/router';
import { computeStats, dayStreak, useAllHistories, winDaysFrom } from '../lib/stats';
import { dayKey, formatTime } from '../lib/time';
import { Check, Flame } from '../core/components/Icons';
import { SiteFooter, SiteHeader } from './SiteHeader';
import { ActivityHeatmap } from './Activity';

export function Home() {
  const histories = useAllHistories(gameIds);
  const winDays = useMemo(() => winDaysFrom(histories), [histories]);
  const streak = dayStreak(winDays.keys());
  const today = dayKey();
  const solvedToday = winDays.get(today) ?? 0;
  const totalSolved = [...winDays.values()].reduce((a, b) => a + b, 0);

  return (
    <div className="site">
      <SiteHeader active="games" />
      <main className="site-main">
        <div className="home-grid">
          <section className="card home-list" aria-labelledby="home-title">
            <div className="home-list-head">
              <h2 id="home-title">Practice your daily games</h2>
              <p>Endless rounds with hints, timers, streaks and stats. No sign-in needed.</p>
            </div>
            <ul className="home-rows">
              {games.map(({ meta }) => {
                const s = computeStats(histories[meta.id] ?? []);
                const doneToday = (histories[meta.id] ?? []).some((r) => r.won && dayKey(r.at) === today);
                return (
                  <li key={meta.id}>
                    <a className="home-row" href={href(meta.id)} style={{ '--game-tint': meta.tint, '--game-color': meta.color } as React.CSSProperties}>
                      <div className="home-row-text">
                        <span className="home-row-tag">{meta.tagline}</span>
                        <span className="home-row-name">{meta.name}</span>
                        <span className="home-row-meta">
                          {s.played === 0 ? (
                            'Not played yet'
                          ) : (
                            <>
                              {s.streak.current > 0 && (
                                <span className="home-row-streak">
                                  <Flame size={14} /> {s.streak.current}
                                </span>
                              )}
                              {meta.scoring === 'time' && s.bestMs !== null && <span>Best {formatTime(s.bestMs)}</span>}
                              {meta.scoring === 'guesses' && <span>{Math.round(s.winRate * 100)}% won</span>}
                              <span>{s.wins} solved</span>
                            </>
                          )}
                        </span>
                      </div>
                      <div className="home-row-tile">
                        <meta.Icon size={52} />
                        {doneToday && (
                          <span className="home-row-done" title="Solved today">
                            <Check size={14} strokeWidth={3} />
                          </span>
                        )}
                      </div>
                    </a>
                  </li>
                );
              })}
            </ul>
          </section>

          <aside className="home-side">
            <section className="card side-card">
              <h3 className="side-title">Your practice</h3>
              <div className="side-streak">
                <span className={`side-flame${streak.today ? ' is-lit' : ''}`}>
                  <Flame size={30} />
                </span>
                <div>
                  <div className="side-streak-value">
                    {streak.current} day{streak.current === 1 ? '' : 's'}
                  </div>
                  <div className="side-streak-label">{streak.today ? 'Streak extended today' : streak.current > 0 ? 'Solve a puzzle to keep it going' : 'Solve any puzzle to start a streak'}</div>
                </div>
              </div>
              <div className="side-kpis">
                <div>
                  <strong>{solvedToday}</strong>
                  <span>Today</span>
                </div>
                <div>
                  <strong>{totalSolved}</strong>
                  <span>All time</span>
                </div>
                <div>
                  <strong>{streak.max}</strong>
                  <span>Best streak</span>
                </div>
              </div>
              <ActivityHeatmap days={winDays} weeks={16} />
              <a className="btn btn-secondary btn-block" href={href('stats')}>
                See all stats
              </a>
            </section>
            <SiteFooter />
          </aside>
        </div>
      </main>
    </div>
  );
}
