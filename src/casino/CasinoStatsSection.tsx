import { href } from '../lib/router';
import { pick } from '../lib/i18n';
import { useCore } from '../i18n/core';
import { casinoGames } from './registry';
import { casinoStats, formatMoney, useCasinoRecords } from './wallet';
import { Money } from './components';
import { CS } from './i18n';

/** Stats page: net, rounds and win rate for each casino game (play money). */
export function CasinoStatsSection() {
  const { lang } = useCore();
  const t = CS[lang];
  const records = useCasinoRecords();
  const all = casinoStats(records);
  return (
    <section className="cs-stats-section" aria-labelledby="cs-stats-title">
      <div className="cs-stats-head">
        <h2 id="cs-stats-title">{t.casino}</h2>
        <p>
          {t.net} <Money value={all.net} lang={lang} /> · {t.nRounds(all.rounds)} · {t.wagered} {formatMoney(all.wagered, lang)}
        </p>
      </div>
      <div className="stats-cards">
        {casinoGames.map(({ meta }) => {
          const s = casinoStats(records, meta.id);
          return (
            <a key={meta.id} className="card stats-card" href={href(`casino/${meta.id}`)}>
              <div className="stats-card-head">
                <span className="stats-card-icon" style={{ background: meta.tint }}>
                  <meta.Icon size={32} />
                </span>
                <div>
                  <div className="stats-card-name">{pick(meta.name, lang)}</div>
                  <div className="stats-card-sub">{s.rounds ? t.nRounds(s.rounds) : t.notPlayed}</div>
                </div>
              </div>
              <div className="stats-card-kpis">
                <div>
                  <strong>{s.rounds ? <Money value={s.net} lang={lang} /> : '–'}</strong>
                  <span>{t.net}</span>
                </div>
                <div>
                  <strong>{s.rounds ? `${Math.round(s.winRate * 100)}%` : '–'}</strong>
                  <span>{t.winRate}</span>
                </div>
                <div>
                  <strong>{s.rounds ? <Money value={s.biggestWin} lang={lang} /> : '–'}</strong>
                  <span>{t.biggestWin}</span>
                </div>
              </div>
            </a>
          );
        })}
      </div>
    </section>
  );
}
