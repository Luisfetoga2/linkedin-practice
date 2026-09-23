import { useMemo } from 'react';
import { games, gameIds } from '../games/registry';
import { href } from '../lib/router';
import { computeStats, dayStreak, useAllHistories, winDaysFrom } from '../lib/stats';
import { dayKey, formatTime } from '../lib/time';
import { Check, Flame } from '../core/components/Icons';
import { SiteFooter, SiteHeader } from './SiteHeader';
import { ActivityHeatmap } from './Activity';
import { pick } from '../lib/i18n';
import { useCore } from '../i18n/core';

export function Home() {
  const histories = useAllHistories(gameIds);
  const { t, lang } = useCore();
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
              <h2 id="home-title">{t.homeTitle}</h2>
              <p>{t.homeSubtitle}</p>
            </div>
            <ul className="home-rows">
              {games.map(({ meta }) => {
                const s = computeStats(histories[meta.id] ?? []);
                const doneToday = (histories[meta.id] ?? []).some((r) => r.won && dayKey(r.at) === today);
                return (
                  <li key={meta.id}>
                    <a className="home-row" href={href(meta.id)} style={{ '--game-tint': meta.tint, '--game-color': meta.color } as React.CSSProperties}>
                      <div className="home-row-text">
                        <span className="home-row-tag">{pick(meta.tagline, lang)}</span>
                        <span className="home-row-name">{pick(meta.name, lang)}</span>
                        <span className="home-row-meta">
                          {s.played === 0 ? (
                            t.notPlayed
                          ) : (
                            <>
                              {s.streak.current > 0 && (
                                <span className="home-row-streak">
                                  <Flame size={14} /> {s.streak.current}
                                </span>
                              )}
                              {meta.scoring === 'time' && s.bestMs !== null && <span>{t.bestTime(formatTime(s.bestMs))}</span>}
                              {meta.scoring === 'guesses' && <span>{t.wonPct(Math.round(s.winRate * 100))}</span>}
                              <span>{t.solvedCount(s.wins)}</span>
                            </>
                          )}
                        </span>
                      </div>
                      <div className="home-row-tile">
                        <meta.Icon size={52} />
                        {doneToday && (
                          <span className="home-row-done" title={t.solvedToday}>
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
              <h3 className="side-title">{t.yourPractice}</h3>
              <div className="side-streak">
                <span className={`side-flame${streak.today ? ' is-lit' : ''}`}>
                  <Flame size={30} />
                </span>
                <div>
                  <div className="side-streak-value">{t.days(streak.current)}</div>
                  <div className="side-streak-label">{streak.today ? t.streakToday : streak.current > 0 ? t.streakKeep : t.streakStart}</div>
                </div>
              </div>
              <div className="side-kpis">
                <div>
                  <strong>{solvedToday}</strong>
                  <span>{t.today}</span>
                </div>
                <div>
                  <strong>{totalSolved}</strong>
                  <span>{t.allTime}</span>
                </div>
                <div>
                  <strong>{streak.max}</strong>
                  <span>{t.bestStreak}</span>
                </div>
              </div>
              <ActivityHeatmap days={winDays} weeks={16} />
              <a className="btn btn-secondary btn-block" href={href('stats')}>
                {t.seeAllStats}
              </a>
            </section>
            <SiteFooter />
          </aside>
        </div>
      </main>
    </div>
  );
}
