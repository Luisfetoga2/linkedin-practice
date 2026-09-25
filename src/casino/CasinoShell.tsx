import { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState, type ComponentType } from 'react';
import { ArrowLeft, Chart, Help } from '../core/components/Icons';
import { Modal } from '../core/components/Modal';
import { ErrorBoundary } from '../core/components/ErrorBoundary';
import { toast } from '../core/components/Toast';
import { href } from '../lib/router';
import { readJSON, writeJSON } from '../lib/storage';
import { formatDate, pick, type Lang } from '../lib/i18n';
import { useCore } from '../i18n/core';
import { CS } from './i18n';
import { Money } from './components';
import type { CasinoEntry, CasinoGameProps, Round } from './types';
import {
  casinoStats,
  clampBet,
  clearCasino,
  closeAbandoned,
  DEFAULT_BET,
  formatMoney,
  openRound,
  raiseRound,
  settleRound,
  useCasinoRecords,
  type CasinoRecord,
} from './wallet';

export function CasinoShell({ entry }: { entry: CasinoEntry }) {
  const { meta } = entry;
  const { t: core, lang } = useCore();
  const t = CS[lang];
  const name = pick(meta.name, lang);
  const Game = useMemo(() => lazy(entry.load) as unknown as ComponentType<CasinoGameProps>, [entry]);
  const records = useCasinoRecords();
  const stats = useMemo(() => casinoStats(records, meta.id), [records, meta.id]);

  const [bet, setBetState] = useState(() => clampBet(readJSON<number>('casino-bet', DEFAULT_BET)));
  const setBet = useCallback((v: number) => {
    const c = clampBet(v);
    setBetState(c);
    writeJSON('casino-bet', c);
  }, []);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  busyRef.current = busy;
  const liveStake = useRef(0);
  const [modal, setModal] = useState<null | 'help' | 'stats' | 'leave'>(null);

  // A round left open by leaving, a reload or a closed tab counts as lost.
  useEffect(() => {
    closeAbandoned(meta.id);
    return () => closeAbandoned(meta.id);
  }, [meta.id]);

  useEffect(() => {
    const seen = readJSON<Record<string, boolean>>('seen-help', {});
    const key = `casino-${meta.id}`;
    if (!seen[key]) {
      setModal('help');
      writeJSON('seen-help', { ...seen, [key]: true });
    }
  }, [meta.id]);

  useEffect(() => {
    const onUnload = (e: BeforeUnloadEvent) => {
      if (!busyRef.current) return;
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', onUnload);
    return () => window.removeEventListener('beforeunload', onUnload);
  }, []);

  const begin = useCallback(
    (stake: number, note?: string): Round => {
      const id = openRound(meta.id, stake, note);
      liveStake.current = stake;
      let done = false;
      return {
        raise(extra) {
          if (done) return;
          liveStake.current += extra;
          raiseRound(id, extra);
        },
        settle(payout, n) {
          if (done) return;
          done = true;
          settleRound(id, payout, n);
        },
      };
    },
    [meta.id],
  );

  const onBusy = useCallback((b: boolean) => setBusy(b), []);

  const style = { '--game-color': meta.color, '--game-color-end': meta.colorEnd, '--game-tint': meta.tint } as React.CSSProperties;

  return (
    <div className="lp-shell cs-shell" style={style}>
      <header className="lp-topbar">
        <div className="lp-topbar-inner">
          <a
            className="icon-btn"
            href={href('')}
            aria-label={t.back}
            onClick={(e) => {
              if (!busy) return;
              e.preventDefault();
              setModal('leave');
            }}
          >
            <ArrowLeft size={22} />
          </a>
          <div className="lp-topbar-title">
            <span className="lp-topbar-badge" aria-hidden>
              <meta.Icon size={20} />
            </span>
            <h1>{name}</h1>
          </div>
          <div className="lp-topbar-actions">
            <button className="icon-btn" onClick={() => setModal('help')} aria-label={t.howToPlay} title={t.howToPlay}>
              <Help size={22} />
            </button>
            <button className="icon-btn" onClick={() => setModal('stats')} aria-label={t.statistics} title={t.statistics}>
              <Chart size={22} />
            </button>
          </div>
        </div>
      </header>

      <main className="lp-play">
        <div className="lp-play-inner cs-play">
          <div className="lp-play-bar">
            <button className="lp-chip cs-net-chip" onClick={() => setModal('stats')} title={t.statistics}>
              {t.net} <Money value={stats.net} lang={lang} />
            </button>
            <span className="cs-rounds">{t.nRounds(stats.rounds)}</span>
          </div>
          <ErrorBoundary
            fallback={(reload) => (
              <div className="lp-loading lp-load-failed">
                <p>{core.loadFailed}</p>
                <button className="btn btn-primary" onClick={reload}>
                  {core.reload}
                </button>
              </div>
            )}
          >
            <Suspense fallback={<div className="lp-loading">{core.loading}</div>}>
              <Game lang={lang} bet={bet} setBet={setBet} begin={begin} onBusy={onBusy} />
            </Suspense>
          </ErrorBoundary>
          <p className="cs-disclaimer">{t.playMoney}</p>
        </div>
      </main>

      <Modal open={modal === 'help'} onClose={() => setModal(null)} title={core.howToPlayTitle(name)}>
        <div className="lp-howto">{pick(meta.howToPlay, lang)}</div>
      </Modal>

      <Modal open={modal === 'stats'} onClose={() => setModal(null)} title={t.statsTitle(name)} wide>
        <CasinoStatsPanel records={records.filter((r) => r.game === meta.id)} lang={lang} name={name} onReset={() => clearCasino(meta.id)} />
      </Modal>

      <Modal
        open={modal === 'leave'}
        onClose={() => setModal(null)}
        title={t.leaveTitle}
        footer={
          <div className="lp-quit-actions">
            <button className="btn btn-secondary" onClick={() => setModal(null)}>
              {t.stay}
            </button>
            <button
              className="btn btn-primary"
              onClick={() => {
                setModal(null);
                setBusy(false);
                busyRef.current = false;
                window.location.hash = href('');
              }}
            >
              {t.leave}
            </button>
          </div>
        }
      >
        <p className="lp-quit-body">{t.leaveBody(formatMoney(liveStake.current, lang))}</p>
      </Modal>
    </div>
  );
}

/** KPIs, a net-over-time line, and the latest rounds for one casino game. */
export function CasinoStatsPanel({ records, lang, name, onReset }: { records: CasinoRecord[]; lang: Lang; name: string; onReset?(): void }) {
  const t = CS[lang];
  const s = casinoStats(records);
  if (!s.rounds) return <p className="cs-empty">{t.noRounds}</p>;
  const recent = records.slice(-12).reverse();
  return (
    <div className="cs-stats">
      <div className="cs-kpis">
        <Kpi label={t.net} value={<Money value={s.net} lang={lang} />} />
        <Kpi label={t.rounds} value={s.rounds} />
        <Kpi label={t.winRate} value={`${Math.round(s.winRate * 100)}%`} />
        <Kpi label={t.wagered} value={formatMoney(s.wagered, lang)} />
        <Kpi label={t.biggestWin} value={<Money value={s.biggestWin} lang={lang} />} />
        <Kpi label={t.biggestLoss} value={<Money value={s.biggestLoss} lang={lang} />} />
      </div>
      <p className="cs-wlp">
        {t.wins} {s.wins} · {t.losses} {s.losses} · {t.pushes} {s.pushes}
      </p>
      {s.series.length > 1 && (
        <figure className="cs-chart">
          <figcaption>{t.netOverTime}</figcaption>
          <NetChart series={s.series.slice(-300)} />
        </figure>
      )}
      <h3 className="cs-sub">{t.recent}</h3>
      <ul className="cs-recent">
        {recent.map((r) => (
          <li key={r.id}>
            <span className="cs-recent-when">{formatDate(r.at, lang, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</span>
            <span className="cs-recent-note">{r.open ? t.inProgress : (r.note ?? '')}</span>
            <span className="cs-recent-stake">{formatMoney(r.stake, lang)}</span>
            <Money value={r.open ? 0 : r.payout - r.stake} lang={lang} />
          </li>
        ))}
      </ul>
      {onReset && (
        <button
          className="btn btn-secondary btn-sm cs-reset"
          onClick={() => {
            if (confirm(t.resetConfirm(name))) {
              onReset();
              toast(t.resetDone);
            }
          }}
        >
          {t.reset}
        </button>
      )}
    </div>
  );
}

function Kpi({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="cs-kpi">
      <strong>{value}</strong>
      <span>{label}</span>
    </div>
  );
}

/** Running net as a line with the zero line marked; green above, red below. */
function NetChart({ series }: { series: number[] }) {
  const W = 600;
  const H = 160;
  const pad = 6;
  const pts = [0, ...series];
  const lo = Math.min(0, ...pts);
  const hi = Math.max(0, ...pts);
  const span = hi - lo || 1;
  const x = (i: number) => pad + (i / (pts.length - 1)) * (W - pad * 2);
  const y = (v: number) => pad + ((hi - v) / span) * (H - pad * 2);
  const line = pts.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join('');
  const zero = y(0);
  const area = `${line}L${x(pts.length - 1).toFixed(1)} ${zero.toFixed(1)}L${x(0).toFixed(1)} ${zero.toFixed(1)}Z`;
  return (
    <svg className="cs-chart-svg" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" role="img" aria-label="Net over time">
      <defs>
        <clipPath id="cs-above">
          <rect x="0" y="0" width={W} height={zero} />
        </clipPath>
        <clipPath id="cs-below">
          <rect x="0" y={zero} width={W} height={H - zero} />
        </clipPath>
      </defs>
      <path d={area} className="cs-area-up" clipPath="url(#cs-above)" />
      <path d={area} className="cs-area-down" clipPath="url(#cs-below)" />
      <line x1={0} x2={W} y1={zero} y2={zero} className="cs-zero" />
      <path d={line} className="cs-line" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}
