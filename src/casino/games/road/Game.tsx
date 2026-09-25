import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import type { CasinoGameProps, Round } from '../../types';
import { BetInput, RoundResult } from '../../components';
import { formatMoney, formatMult } from '../../wallet';
import { readJSON, writeJSON } from '../../../lib/storage';
import { RS } from './i18n';
import {
  advance,
  canCashOut,
  cashOut,
  DEFAULT_LEVEL,
  HIT_CHANCE,
  isLevel,
  LANES,
  LEVELS,
  multiplier,
  multiplierTable,
  payoutFor,
  startRoad,
  type Level,
  type RoadState,
} from './logic';
import s from './Game.module.css';

const LEVEL_KEY = 'casino-road-level';

/** Ambient traffic: a fixed look per lane (colour, kind, speed, phase) so it doesn't reshuffle on every render. */
const CAR_COLORS = ['#e03131', '#1c7ed6', '#f59f00', '#7048e8', '#0ca678', '#f76707', '#e64980', '#495057', '#15aabf'];
interface Traffic {
  color: string;
  truck: boolean;
  dur: number;
  delay: number;
  parked: boolean;
}
const TRAFFIC: Traffic[] = Array.from({ length: LANES + 1 }, (_, i) => {
  const h = (i * 2654435761) >>> 0;
  return {
    color: CAR_COLORS[(i * 5 + 3) % CAR_COLORS.length],
    truck: h % 7 === 0,
    dur: 2.6 + ((h >>> 3) % 23) / 10,
    delay: -(((h >>> 9) % 41) / 10),
    parked: (h >>> 5) % 3 !== 0,
  };
});

type End = { stake: number; payout: number; detail: string; delay: number };

export default function Game({ lang, bet, setBet, begin, onBusy }: CasinoGameProps) {
  const t = RS[lang];
  const [level, setLevelState] = useState<Level>(() => {
    const v = readJSON<unknown>(LEVEL_KEY, DEFAULT_LEVEL);
    return isLevel(v) ? v : DEFAULT_LEVEL;
  });
  const setLevel = (l: Level) => {
    if (round.current) return;
    setLevelState(l);
    writeJSON(LEVEL_KEY, l);
    // A new difficulty clears the last road so the plates preview the new multipliers.
    setState({ phase: 'idle', level: l, lane: 0 });
    setEnd(null);
    setShowEnd(false);
  };
  const [state, setState] = useState<RoadState>({ phase: 'idle', level, lane: 0 });
  // Bumped each Play so per-round animations (barriers, hops) start fresh.
  const [roundNo, setRoundNo] = useState(0);
  const [end, setEnd] = useState<End | null>(null);
  const [showEnd, setShowEnd] = useState(false);
  const round = useRef<Round | null>(null);
  const stake = useRef(bet);
  const lockUntil = useRef(0);

  const live = state.phase === 'live';
  const lvl = live || state.phase !== 'idle' ? state.level : level;
  const table = useMemo(() => multiplierTable(lvl), [lvl]);
  const pct = Math.round(HIT_CHANCE[level] * 100);
  const curMult = multiplier(lvl, state.lane);
  const cashAmount = Math.round(stake.current * curMult * 100) / 100;

  const levelName = (l: Level) => t.levels[l];

  const finish = useCallback(
    (next: RoadState) => {
      const r = round.current;
      if (!r) return;
      const m = formatMult(multiplier(next.level, next.lane), lang);
      const name = RS[lang].levels[next.level];
      const payout = payoutFor(next, stake.current);
      if (next.phase === 'hit') {
        r.settle(0, t.noteHit(next.hitLane ?? next.lane + 1, name));
        setEnd({ stake: stake.current, payout: 0, detail: t.detailHit(next.hitLane ?? next.lane + 1), delay: 850 });
      } else if (next.phase === 'crossed') {
        r.settle(payout, t.noteCrossed(name, m));
        setEnd({ stake: stake.current, payout, detail: t.detailCrossed(m), delay: 450 });
      } else if (next.phase === 'cashed') {
        r.settle(payout, t.noteCashed(next.lane, name, m));
        setEnd({ stake: stake.current, payout, detail: t.detailCashed(next.lane, m), delay: 0 });
      } else return;
      round.current = null;
      onBusy(false);
    },
    [lang, onBusy, t],
  );

  const play = useCallback(() => {
    if (round.current) return;
    stake.current = bet;
    round.current = begin(bet, t.noteStart(RS[lang].levels[level]));
    onBusy(true);
    setEnd(null);
    setShowEnd(false);
    setRoundNo((n) => n + 1);
    setState(startRoad(level));
    lockUntil.current = 0;
  }, [bet, begin, lang, level, onBusy, t]);

  const stateRef = useRef(state);
  stateRef.current = state;

  const go = useCallback(() => {
    const cur = stateRef.current;
    if (cur.phase !== 'live' || !round.current) return;
    const now = performance.now();
    if (now < lockUntil.current) return;
    lockUntil.current = now + 280;
    const next = advance(cur);
    stateRef.current = next;
    setState(next);
    if (next.phase !== 'live') finish(next);
  }, [finish]);

  const cash = useCallback(() => {
    const cur = stateRef.current;
    if (!canCashOut(cur) || !round.current) return;
    const next = cashOut(cur);
    stateRef.current = next;
    setState(next);
    finish(next);
  }, [finish]);

  // The result banner waits for the hop / crash to play out.
  useEffect(() => {
    if (!end) return;
    if (!end.delay) {
      setShowEnd(true);
      return;
    }
    const id = setTimeout(() => setShowEnd(true), end.delay);
    return () => clearTimeout(id);
  }, [end]);

  // Keyboard: Space / Enter / → = Go (or Play), C = cash out.
  const keys = useRef({ go, cash, play });
  keys.current = { go, cash, play };
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey || e.repeat) return;
      const el = e.target as HTMLElement | null;
      if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable)) return;
      if (document.querySelector('.lp-modal-backdrop')) return;
      const k = e.key;
      const isGo = k === ' ' || k === 'Enter' || k === 'ArrowRight';
      // A focused button already answers Space / Enter itself.
      if ((k === ' ' || k === 'Enter') && el?.tagName === 'BUTTON') return;
      if (isGo) {
        e.preventDefault();
        if (stateRef.current.phase === 'live') keys.current.go();
        else keys.current.play();
      } else if (k === 'c' || k === 'C') {
        if (stateRef.current.phase === 'live') {
          e.preventDefault();
          keys.current.cash();
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Where the chicken is drawn: 0 = start grass, 1..LANES = a lane, LANES + 1 = the far side.
  const pos = state.phase === 'hit' ? (state.hitLane ?? state.lane + 1) : state.phase === 'crossed' ? LANES + 1 : state.lane;

  // Keep the chicken in view, about a third of the way in.
  const scroller = useRef<HTMLDivElement>(null);
  const roadRef = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const sc = scroller.current;
    const el = roadRef.current?.querySelector<HTMLElement>(`[data-pos="${pos}"]`);
    if (!sc || !el) return;
    const target = Math.max(0, el.offsetLeft + el.offsetWidth / 2 - sc.clientWidth * 0.36);
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (typeof sc.scrollTo === 'function') sc.scrollTo({ left: target, behavior: reduce || pos === 0 ? 'auto' : 'smooth' });
  }, [pos, roundNo]);

  const next = state.lane + 1;
  const over = state.phase === 'hit' || state.phase === 'cashed' || state.phase === 'crossed';

  const chickenStyle: CSSProperties = {
    left:
      pos === 0
        ? 'calc(var(--side-w) / 2)'
        : pos > LANES
          ? `calc(var(--side-w) * 1.5 + ${LANES} * var(--lane-w))`
          : `calc(var(--side-w) + ${pos - 0.5} * var(--lane-w))`,
  };

  return (
    <div className={s.wrap}>
      {/* Stats / result slot: same height either way so nothing jumps. */}
      <div className={s.slot}>
        {over && showEnd && end ? (
          <RoundResult stake={end.stake} payout={end.payout} lang={lang} detail={end.detail} />
        ) : live || over ? (
          <div className={s.hud}>
            <Stat label={t.multiplier} value={formatMult(curMult, lang)} big />
            <Stat
              label={t.cashOutNow}
              value={state.phase === 'hit' ? formatMoney(0, lang) : state.lane ? formatMoney(cashAmount, lang) : '—'}
              tone={state.lane && state.phase !== 'hit' ? 'up' : undefined}
              big
            />
            <Stat label={t.nextLane} value={next <= LANES ? formatMult(table[next - 1], lang) : '—'} />
          </div>
        ) : (
          <div className={s.hud}>
            <Stat label={t.topPrize} value={formatMult(table[LANES - 1], lang)} big />
            <Stat label={t.firstLane} value={formatMult(table[0], lang)} />
            <Stat label={t.carChance} value={t.perLane(pct)} />
          </div>
        )}
      </div>

      <div className={s.scroller} ref={scroller}>
        <div className={s.road} ref={roadRef} role="img" aria-label={t.road}>
          <div className={`${s.side} ${s.start}`} data-pos={0}>
            <Tufts />
          </div>
          {table.map((m, i) => {
            const k = i + 1;
            const crossed = (live || over) && k <= state.lane;
            const current = live && k === state.lane;
            const isNext = live && k === next;
            const hitHere = state.phase === 'hit' && k === state.hitLane;
            const tr = TRAFFIC[k];
            const label = formatMult(m, lang);
            return (
              <div
                key={k}
                data-pos={k}
                className={`${s.lane}${crossed ? ` ${s.crossed}` : ''}${current ? ` ${s.current}` : ''}${isNext ? ` ${s.next}` : ''}${hitHere ? ` ${s.hitLane}` : ''}`}
              >
                {!crossed && !hitHere && (
                  <div className={s.drive} style={{ '--dur': `${tr.dur}s`, '--delay': `${tr.delay}s` } as CSSProperties}>
                    <Car color={tr.color} truck={tr.truck} />
                  </div>
                )}
                {crossed && (
                  <>
                    {tr.parked && (
                      <div className={s.parked} key={`p${roundNo}`}>
                        <Car color={tr.color} truck={false} />
                      </div>
                    )}
                    <div className={s.barrier} key={`b${roundNo}`} />
                  </>
                )}
                {hitHere && (
                  <div className={s.crash} key={`c${roundNo}`}>
                    <Car color="#e03131" truck={false} />
                  </div>
                )}
                <div className={`${s.plate}${label.length > 6 ? ` ${s.plateSmall}` : ''}`} aria-label={t.laneLabel(k, label)}>
                  {label}
                </div>
              </div>
            );
          })}
          <div className={`${s.side} ${s.end}`} data-pos={LANES + 1}>
            <Flag />
            <Tufts />
          </div>

          <div className={`${s.chicken}${state.phase === 'hit' ? ` ${s.squashed}` : ''}${state.phase === 'crossed' || state.phase === 'cashed' ? ` ${s.happy}` : ''}`} style={chickenStyle}>
            <div className={s.hop} key={`${roundNo}-${pos}`}>
              <Chicken label={t.chicken} />
            </div>
            {state.phase === 'hit' && (
              <div className={s.poof} aria-hidden>
                {Array.from({ length: 8 }, (_, i) => (
                  <i key={i} style={{ '--a': `${i * 45 + 20}deg` } as CSSProperties} />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className={s.progress}>
        <span aria-live="polite">
          {state.phase === 'idle' ? '' : live && state.lane === 0 ? t.firstStep : t.laneOf(Math.min(state.phase === 'hit' ? (state.hitLane ?? 0) : state.lane, LANES), LANES)}
        </span>
        <span className={s.keys}>{t.keysHint}</span>
      </div>

      <div className={s.controls}>
        <div className={s.levelRow}>
          <span className={s.levelLabel} id="road-level">
            {t.difficulty}
          </span>
          <div className={s.levels} role="radiogroup" aria-labelledby="road-level">
            {LEVELS.map((l) => (
              <button
                key={l}
                type="button"
                role="radio"
                aria-checked={level === l}
                className={`${s.levelBtn}${level === l ? ` ${s.levelOn}` : ''}`}
                disabled={live}
                onClick={() => setLevel(l)}
                title={t.levelHint(Math.round(HIT_CHANCE[l] * 100))}
              >
                {levelName(l)}
              </button>
            ))}
          </div>
        </div>

        <BetInput value={bet} onChange={setBet} disabled={live} lang={lang} />

        {live ? (
          <div className={s.actions}>
            <button type="button" className={`btn btn-primary ${s.bigBtn}`} onClick={go}>
              {t.go}
            </button>
            <button type="button" className={`btn ${s.bigBtn} ${s.cashBtn}`} onClick={cash} disabled={!canCashOut(state)}>
              {t.cashOut(formatMoney(state.lane ? cashAmount : 0, lang))}
            </button>
          </div>
        ) : (
          <div className={s.actions}>
            <button type="button" className={`btn btn-primary btn-block ${s.bigBtn}`} onClick={play}>
              {t.play}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value, big, tone }: { label: string; value: string; big?: boolean; tone?: 'up' }) {
  return (
    <div className={s.stat}>
      <span>{label}</span>
      <strong className={`${big ? s.statBig : ''}${tone === 'up' ? ` ${s.statUp}` : ''}`}>{value}</strong>
    </div>
  );
}

/** Top-down car pointing down the lane (front at the bottom). */
function Car({ color, truck }: { color: string; truck: boolean }) {
  if (truck)
    return (
      <svg className={s.truck} viewBox="0 0 36 78" aria-hidden>
        <rect x="2" y="1" width="32" height="52" rx="3" fill="#f1f3f5" stroke="rgba(0,0,0,.25)" />
        <rect x="6" y="5" width="24" height="44" rx="2" fill="none" stroke="rgba(0,0,0,.12)" />
        <rect x="3" y="55" width="30" height="21" rx="6" fill={color} />
        <rect x="7" y="64" width="22" height="7" rx="2" fill="#1f2a36" opacity=".8" />
        <rect x="6" y="73.5" width="6" height="2.5" rx="1" fill="#ffe066" />
        <rect x="24" y="73.5" width="6" height="2.5" rx="1" fill="#ffe066" />
      </svg>
    );
  return (
    <svg className={s.car} viewBox="0 0 34 58" aria-hidden>
      <rect x="1" y="9" width="3" height="10" rx="1.5" fill="#1f1f1f" />
      <rect x="30" y="9" width="3" height="10" rx="1.5" fill="#1f1f1f" />
      <rect x="1" y="38" width="3" height="10" rx="1.5" fill="#1f1f1f" />
      <rect x="30" y="38" width="3" height="10" rx="1.5" fill="#1f1f1f" />
      <rect x="3" y="2" width="28" height="54" rx="9" fill={color} />
      <rect x="6" y="10" width="22" height="8" rx="3" fill="#1f2a36" opacity=".75" />
      <rect x="7" y="19" width="20" height="17" rx="3" fill="#fff" opacity=".18" />
      <rect x="6" y="37" width="22" height="9" rx="3" fill="#1f2a36" opacity=".8" />
      <rect x="6" y="2.5" width="6" height="2.5" rx="1" fill="#ff6b6b" />
      <rect x="22" y="2.5" width="6" height="2.5" rx="1" fill="#ff6b6b" />
      <rect x="6" y="52.5" width="6" height="3" rx="1.2" fill="#fff3bf" />
      <rect x="22" y="52.5" width="6" height="3" rx="1.2" fill="#fff3bf" />
    </svg>
  );
}

function Chicken({ label }: { label: string }) {
  return (
    <svg className={s.chickenSvg} viewBox="0 0 64 64" role="img" aria-label={label}>
      <ellipse cx="31" cy="59" rx="15" ry="3.5" fill="rgba(0,0,0,.22)" />
      {/* legs */}
      <path d="M26 48v9M36 48v9M23.5 57h5M33.5 57h5" stroke="#f59f00" strokeWidth="2.6" strokeLinecap="round" />
      {/* tail */}
      <path d="M11 30c-4-6-2-12 2-13 1 4 3 6 6 7z" fill="#fff" stroke="#d9d9d9" strokeWidth="1.2" strokeLinejoin="round" />
      {/* body */}
      <ellipse cx="30" cy="36" rx="18" ry="15" fill="#fff" stroke="#d9d9d9" strokeWidth="1.2" />
      {/* wing */}
      <path d="M20 35c4 7 13 8 17 3-4-1-7-4-8-8-3 3-6 5-9 5z" fill="#eef0f2" stroke="#d0d4d8" strokeWidth="1" strokeLinejoin="round" />
      {/* head */}
      <circle cx="43" cy="19" r="10" fill="#fff" stroke="#d9d9d9" strokeWidth="1.2" />
      {/* comb */}
      <path d="M36.5 11.5c-1-4 2.5-6 4-3 .5-3.5 5-3.5 5 0 1.5-2.6 5.2-1.2 4 2.2-2.4.8-9 2.2-13 .8z" fill="#e03131" />
      {/* beak */}
      <path d="M52 18l7 2.4-7 2.6z" fill="#f59f00" stroke="#e8890c" strokeWidth=".8" strokeLinejoin="round" />
      {/* wattle */}
      <path d="M50 24c.5 3.6-2.6 4.6-3.4 1.6z" fill="#e03131" />
      {/* eye */}
      <circle cx="46.5" cy="17.5" r="2" fill="#1f1f1f" />
      <circle cx="47.1" cy="16.9" r=".7" fill="#fff" />
      {/* blush */}
      <circle cx="44" cy="23" r="2" fill="#ffa8a8" opacity=".7" />
    </svg>
  );
}

function Flag() {
  return (
    <svg className={s.flag} viewBox="0 0 40 56" aria-hidden>
      <rect x="6" y="4" width="3" height="50" rx="1.5" fill="#868e96" />
      <g>
        <rect x="9" y="5" width="28" height="18" fill="#fff" />
        {[0, 1, 2, 3].map((c) =>
          [0, 1, 2].map((r) => ((c + r) % 2 === 0 ? <rect key={`${c}${r}`} x={9 + c * 7} y={5 + r * 6} width="7" height="6" fill="#1f1f1f" /> : null)),
        )}
      </g>
    </svg>
  );
}

function Tufts() {
  return (
    <svg className={s.tufts} viewBox="0 0 60 200" preserveAspectRatio="none" aria-hidden>
      {[
        [12, 24],
        [40, 58],
        [18, 120],
        [44, 150],
        [26, 182],
      ].map(([x, y]) => (
        <path key={`${x}-${y}`} d={`M${x} ${y}l3-7 2 7 3-5 1 5`} stroke="currentColor" strokeWidth="1.6" fill="none" strokeLinecap="round" />
      ))}
    </svg>
  );
}
