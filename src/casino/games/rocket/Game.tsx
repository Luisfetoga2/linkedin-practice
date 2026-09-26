import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type MouseEvent } from 'react';
import type { CasinoGameProps, Round } from '../../types';
import { BetInput, RoundResult } from '../../components';
import { formatMoney, formatMult } from '../../wallet';
import { LOCALE, type Lang } from '../../../lib/i18n';
import { readJSON, writeJSON } from '../../../lib/storage';
import {
  clampAuto,
  crashPoint,
  crashTier,
  DEFAULT_AUTO,
  flightAt,
  HISTORY_SIZE,
  K,
  MIN_AUTO,
  multiplierAt,
  niceStep,
  parseAuto,
  payoutFor,
  pushHistory,
  reachChance,
  timeToMult,
} from './logic';
import { RK } from './i18n';
import s from './Game.module.css';

const AUTO_KEY = 'casino-rocket-auto';
const HISTORY_KEY = 'casino-rocket-history';

interface AutoPref {
  on: boolean;
  value: number;
}

function loadAuto(): AutoPref {
  const v = readJSON<Partial<AutoPref> | null>(AUTO_KEY, null);
  return { on: !!v?.on, value: clampAuto(typeof v?.value === 'number' ? v.value : DEFAULT_AUTO) };
}

function loadHistory(): number[] {
  const v = readJSON<unknown>(HISTORY_KEY, []);
  return Array.isArray(v) ? v.filter((x): x is number => typeof x === 'number' && x >= 1).slice(0, HISTORY_SIZE) : [];
}

/** One flight: decided at launch, drawn from the elapsed time. */
interface Flight {
  crash: number;
  /** Auto cash-out target for this flight (null = off). */
  auto: number | null;
  /** performance.now() at launch. */
  start: number;
  stake: number;
  /** The live bet; null once it's settled (cashed out or lost). */
  round: Round | null;
  /** Where the bet was cashed out, if it was: the rocket keeps flying after. */
  cashed: { t: number; mult: number } | null;
  /** Seconds after launch it exploded (null while in the air). */
  endT: number | null;
  /** Its crash point went into the history strip. */
  logged: boolean;
}

type Phase = 'idle' | 'flying' | 'boom';

interface End {
  stake: number;
  payout: number;
  detail: string;
}

interface Cashed {
  mult: number;
  payout: number;
}

/** Twinkling stars at fixed pseudo-random spots, so they don't reshuffle on every render. */
const STARS = Array.from({ length: 38 }, (_, i) => {
  const h = Math.imul(i + 1, 2654435761) >>> 0;
  return {
    x: (h % 1000) / 10,
    y: ((h >>> 10) % 1000) / 10,
    size: 1 + ((h >>> 20) % 3) * 0.55,
    delay: -((h >>> 4) % 40) / 10,
    dur: 2.2 + ((h >>> 14) % 30) / 10,
  };
});

const SPARKS = Array.from({ length: 12 }, (_, i) => ({ a: i * 30 + ((i * 17) % 11), d: 44 + ((i * 29) % 5) * 9 }));

const reducedMotion = () => typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

function pct(p: number, lang: Lang): string {
  return p.toLocaleString(LOCALE[lang], { style: 'percent', maximumFractionDigits: p < 0.1 ? 2 : 1 });
}

/** "×1.5" / "×20" / "×15k" for the graph's axis. */
function axisMult(v: number, step: number, lang: Lang): string {
  if (v >= 10000) return `×${(v / 1000).toLocaleString(LOCALE[lang], { maximumFractionDigits: 1 })}k`;
  const digits = step < 0.1 ? 2 : step < 1 ? 1 : 0;
  return `×${v.toLocaleString(LOCALE[lang], { minimumFractionDigits: digits, maximumFractionDigits: digits })}`;
}

interface Tip {
  x: number;
  y: number;
  angle: number;
}

interface DrawState {
  /** Seconds since launch (0 before any flight). */
  t: number;
  /** Exact multiplier at the tip. */
  m: number;
  flown: boolean;
  boom: boolean;
  cashed: { t: number; mult: number } | null;
  lang: Lang;
}

/**
 * Paint the graph: grid and axes that rescale with the flight (the tip stays around 80% across
 * and 62% up once it's past the starting window, under the big multiplier), the filled curve, and the cash-out marker.
 * Returns where the tip is so the rocket can ride it.
 */
function drawScene(cv: HTMLCanvasElement, w: number, h: number, st: DrawState): Tip {
  const narrow = w < 420;
  const L = narrow ? 40 : 48;
  const R = narrow ? 16 : 22;
  const T = 18;
  const B = 26;
  const pw = Math.max(1, w - L - R);
  const ph = Math.max(1, h - T - B);
  const xSpan = Math.max(10, st.t * 1.25);
  const ySpan = Math.max(1, (st.m - 1) * 1.6);
  const X = (sec: number) => L + (sec / xSpan) * pw;
  const Y = (v: number) => T + ph - ((v - 1) / ySpan) * ph;

  const dpr = Math.min(3, window.devicePixelRatio || 1);
  if (cv.width !== Math.round(w * dpr) || cv.height !== Math.round(h * dpr)) {
    cv.width = Math.round(w * dpr);
    cv.height = Math.round(h * dpr);
  }
  const ctx = cv.getContext('2d');
  const angleAt = () => Math.atan2(((K * st.m) / ySpan) * ph, pw / xSpan);
  const tip = { x: X(st.t), y: Y(st.m), angle: angleAt() };
  if (!ctx) return tip;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w, h);
  const font = getComputedStyle(cv).fontFamily || 'system-ui, sans-serif';

  // Grid + labels.
  ctx.lineWidth = 1;
  ctx.font = `600 ${narrow ? 10 : 11}px ${font}`;
  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  const yStep = niceStep(ySpan, 4);
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';
  // The ×1 baseline, then round values (×1.2, ×1.4… / ×20, ×40…).
  const yTicks = [1];
  for (let k = Math.floor(1 / yStep) + 1; k * yStep <= 1 + ySpan + 1e-9; k++) yTicks.push(k * yStep);
  for (const v of yTicks) {
    const y = Math.round(Y(v)) + 0.5;
    if (v !== 1 && Y(v) > T + ph - 12) continue;
    ctx.strokeStyle = v === 1 ? 'rgba(255,255,255,0.22)' : 'rgba(255,255,255,0.07)';
    ctx.beginPath();
    ctx.moveTo(L, y);
    ctx.lineTo(w - R, y);
    ctx.stroke();
    if (y > T + 6) ctx.fillText(axisMult(v, yStep, st.lang), L - 7, y);
  }
  const xStep = Math.max(2, niceStep(xSpan, 4));
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  for (let sec = 0; sec <= xSpan + 1e-9; sec += xStep) {
    const x = Math.round(X(sec)) + 0.5;
    ctx.strokeStyle = sec === 0 ? 'rgba(255,255,255,0.22)' : 'rgba(255,255,255,0.07)';
    ctx.beginPath();
    ctx.moveTo(x, T);
    ctx.lineTo(x, T + ph);
    ctx.stroke();
    if (x < w - R - 8 || sec === 0) ctx.fillText(`${Math.round(sec)}s`, x, T + ph + 7);
  }

  if (st.flown && st.t > 0) {
    const n = Math.max(24, Math.min(120, Math.round(pw / 5)));
    const pts: [number, number][] = [];
    for (let i = 0; i <= n; i++) {
      const sec = (st.t * i) / n;
      pts.push([X(sec), Y(i === n ? st.m : multiplierAt(sec))]);
    }
    const line = st.boom ? ['#ff6b6b', '#fa5252'] : ['#ff922b', '#ffd43b'];
    // Area under the curve.
    const fill = ctx.createLinearGradient(0, tip.y, 0, T + ph);
    fill.addColorStop(0, st.boom ? 'rgba(250,82,82,0.32)' : 'rgba(255,146,43,0.34)');
    fill.addColorStop(1, st.boom ? 'rgba(250,82,82,0.02)' : 'rgba(255,146,43,0.02)');
    ctx.beginPath();
    ctx.moveTo(pts[0][0], pts[0][1]);
    for (const [x, y] of pts) ctx.lineTo(x, y);
    ctx.lineTo(tip.x, T + ph);
    ctx.lineTo(pts[0][0], T + ph);
    ctx.closePath();
    ctx.fillStyle = fill;
    ctx.fill();
    // The curve, with a soft glow.
    const stroke = ctx.createLinearGradient(L, 0, Math.max(L + 1, tip.x), 0);
    stroke.addColorStop(0, line[0]);
    stroke.addColorStop(1, line[1]);
    ctx.save();
    ctx.shadowColor = st.boom ? 'rgba(250,82,82,0.6)' : 'rgba(255,169,77,0.65)';
    ctx.shadowBlur = 12;
    ctx.strokeStyle = stroke;
    ctx.lineWidth = narrow ? 3 : 3.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(pts[0][0], pts[0][1]);
    for (const [x, y] of pts) ctx.lineTo(x, y);
    ctx.stroke();
    ctx.restore();
  }

  // Where the bet was cashed out.
  if (st.cashed) {
    const cx = X(st.cashed.t);
    const cy = Y(st.cashed.mult);
    ctx.save();
    ctx.setLineDash([3, 4]);
    ctx.strokeStyle = 'rgba(105,219,124,0.55)';
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx, T + ph);
    ctx.stroke();
    ctx.restore();
    ctx.beginPath();
    ctx.arc(cx, cy, 5.5, 0, Math.PI * 2);
    ctx.fillStyle = '#51cf66';
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#fff';
    ctx.stroke();
    const label = formatMult(st.cashed.mult, st.lang);
    ctx.font = `700 ${narrow ? 11 : 12}px ${font}`;
    const tw = ctx.measureText(label).width + 12;
    // Below and to the right of the dot, clear of the rocket that was sitting there.
    const lx = Math.min(w - R - tw, cx + 9);
    const ly = Math.min(T + ph - 22, cy + 8);
    ctx.fillStyle = '#2b8a3e';
    ctx.beginPath();
    ctx.roundRect(lx, ly, tw, 19, 9.5);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, lx + tw / 2, ly + 10);
  }
  // Where it blew up: a scorched glow that stays after the blast fades.
  if (st.boom) {
    const g = ctx.createRadialGradient(tip.x, tip.y, 0, tip.x, tip.y, 16);
    g.addColorStop(0, 'rgba(255,107,107,0.95)');
    g.addColorStop(0.35, 'rgba(250,82,82,0.45)');
    g.addColorStop(1, 'rgba(250,82,82,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(tip.x, tip.y, 16, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(tip.x, tip.y, 4, 0, Math.PI * 2);
    ctx.fillStyle = '#fff5f5';
    ctx.fill();
  }
  return tip;
}

export default function Game({ lang, bet, setBet, begin, onBusy }: CasinoGameProps) {
  const t = RK[lang];
  const [auto, setAutoState] = useState<AutoPref>(loadAuto);
  const [autoText, setAutoText] = useState(() => auto.value.toFixed(2));
  const [history, setHistory] = useState<number[]>(loadHistory);
  const [historyNo, setHistoryNo] = useState(0);
  const [phase, setPhase] = useState<Phase>('idle');
  const [mult, setMult] = useState(1);
  const [live, setLive] = useState(false);
  const [stake, setStake] = useState(bet);
  const [cashed, setCashed] = useState<Cashed | null>(null);
  const [end, setEnd] = useState<End | null>(null);
  const [lastCrash, setLastCrash] = useState<number | null>(null);
  const [burst, setBurst] = useState<{ x: number; y: number; n: number } | null>(null);

  const flightRef = useRef<Flight | null>(null);
  const sceneRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rocketRef = useRef<HTMLDivElement>(null);
  const sizeRef = useRef({ w: 0, h: 0 });
  const rafRef = useRef(0);
  const timerRef = useRef(0);
  const tipRef = useRef<Tip>({ x: 0, y: 0, angle: 0 });
  // Each explosion gets a fresh key so its animation always replays.
  const burstNo = useRef(0);
  const historyRef = useRef(history);
  historyRef.current = history;

  // Everything the animation loop reads, fresh on every render.
  const ctx = useRef({ t, lang, onBusy });
  ctx.current = { t, lang, onBusy };

  const saveAuto = (next: AutoPref) => {
    setAutoState(next);
    writeJSON(AUTO_KEY, next);
  };

  // ---------- Drawing ----------

  const paint = (now = performance.now()) => {
    const cv = canvasRef.current;
    const { w, h } = sizeRef.current;
    if (!cv || !w || !h) return;
    const f = flightRef.current;
    const sec = f ? (f.endT ?? Math.max(0, (now - f.start) / 1000)) : 0;
    const m = f && f.endT != null ? Math.max(1, f.crash) : multiplierAt(sec);
    const tip = drawScene(cv, w, h, { t: sec, m, flown: !!f, boom: !!f && f.endT != null, cashed: f?.cashed ?? null, lang: ctx.current.lang });
    tipRef.current = tip;
    const el = rocketRef.current;
    if (el) el.style.transform = `translate3d(${tip.x.toFixed(1)}px, ${tip.y.toFixed(1)}px, 0) rotate(${(-tip.angle).toFixed(4)}rad)`;
  };

  // ---------- Flight ----------

  const logCrash = (f: Flight) => {
    if (f.logged) return;
    f.logged = true;
    const next = pushHistory(historyRef.current, f.crash);
    historyRef.current = next;
    setHistory(next);
    setHistoryNo((n) => n + 1);
    writeJSON(HISTORY_KEY, next);
  };

  const settleCash = (f: Flight, m: number, at: number, isAuto: boolean) => {
    const r = f.round;
    if (!r) return;
    const { t: tx, lang: lg, onBusy: busy } = ctx.current;
    const label = formatMult(m, lg);
    const payout = payoutFor(f.stake, m);
    r.settle(payout, isAuto ? tx.noteAuto(label) : tx.noteCashed(label));
    f.round = null;
    f.cashed = { t: at, mult: m };
    busy(false);
    setLive(false);
    setCashed({ mult: m, payout });
    setEnd({ stake: f.stake, payout, detail: isAuto ? tx.detailAuto(label) : tx.detailCashed(label) });
  };

  const explode = (f: Flight) => {
    if (f.endT != null) return;
    f.endT = timeToMult(f.crash);
    const { t: tx, lang: lg, onBusy: busy } = ctx.current;
    const label = formatMult(f.crash, lg);
    if (f.round) {
      f.round.settle(0, tx.noteExploded(label));
      f.round = null;
      busy(false);
      setLive(false);
      setEnd({ stake: f.stake, payout: 0, detail: f.crash <= 1 ? tx.detailPad : tx.detailExploded(label) });
    }
    logCrash(f);
    cancelAnimationFrame(rafRef.current);
    clearTimeout(timerRef.current);
    setPhase('boom');
    setMult(f.crash);
    setLastCrash(f.crash);
    paint();
    const tip = tipRef.current;
    burstNo.current += 1;
    setBurst({ x: tip.x, y: tip.y, n: burstNo.current });
    if (!reducedMotion()) {
      sceneRef.current?.animate?.(
        [
          { transform: 'translate(0, 0)' },
          { transform: 'translate(-5px, 3px)' },
          { transform: 'translate(4px, -3px)' },
          { transform: 'translate(-3px, -2px)' },
          { transform: 'translate(2px, 2px)' },
          { transform: 'translate(0, 0)' },
        ],
        { duration: 420, easing: 'ease-out' },
      );
    }
  };

  /** Wake up in time for the next thing that can happen (auto cash-out or crash), even in a background tab. */
  const schedule = (f: Flight) => {
    clearTimeout(timerRef.current);
    if (f.endT != null) return;
    const next = f.round && f.auto != null && f.auto <= f.crash ? timeToMult(f.auto) : timeToMult(f.crash);
    const wait = Math.max(0, f.start + next * 1000 - performance.now()) + 15;
    timerRef.current = window.setTimeout(() => step(), wait);
  };

  /** Bring the flight up to date with the clock. */
  const step = (now = performance.now()) => {
    const f = flightRef.current;
    if (!f || f.endT != null) return;
    const sec = Math.max(0, (now - f.start) / 1000);
    if (f.round) {
      const o = flightAt(f.crash, f.auto, sec);
      if (o.kind === 'auto') {
        settleCash(f, o.mult, o.at, true);
        schedule(f);
      }
    }
    const o = flightAt(f.crash, f.round ? f.auto : null, sec);
    if (o.kind === 'crashed') {
      explode(f);
      return;
    }
    setMult(o.mult);
    paint(now);
  };

  const stepRef = useRef(step);
  stepRef.current = step;

  // Same clock as the launch time (a frame's own timestamp can be a hair earlier).
  const loop = () => {
    stepRef.current(performance.now());
    const f = flightRef.current;
    if (f && f.endT == null) rafRef.current = requestAnimationFrame(loop);
  };

  const launch = () => {
    const prev = flightRef.current;
    if (prev?.round) return;
    // Launching again while the last rocket is still flying (after a cash-out) ends that flight.
    if (prev && prev.endT == null) {
      prev.endT = timeToMult(prev.crash);
      logCrash(prev);
    }
    cancelAnimationFrame(rafRef.current);
    clearTimeout(timerRef.current);
    const target = auto.on ? auto.value : null;
    const crash = crashPoint();
    const round = begin(bet, target ? t.noteStartAuto(formatMult(target, lang)) : t.noteStart);
    onBusy(true);
    const f: Flight = { crash, auto: target, start: performance.now(), stake: bet, round, cashed: null, endT: null, logged: false };
    flightRef.current = f;
    setStake(bet);
    setLive(true);
    setPhase('flying');
    setMult(1);
    setCashed(null);
    setEnd(null);
    setBurst(null);
    step(f.start);
    if (f.endT == null) {
      schedule(f);
      rafRef.current = requestAnimationFrame(loop);
    }
  };

  const cashOut = () => {
    const f = flightRef.current;
    if (!f?.round || f.endT != null) return;
    const now = performance.now();
    // Catch up first: the rocket may have exploded (or hit the auto target) since the last frame.
    step(now);
    if (!f.round || f.endT != null) return;
    const sec = Math.max(0, (now - f.start) / 1000);
    const o = flightAt(f.crash, f.auto, sec);
    if (o.kind !== 'flying') return;
    settleCash(f, o.mult, sec, false);
    schedule(f);
    paint(now);
  };

  const main = () => (flightRef.current?.round ? cashOut() : launch());

  // Canvas size follows the scene.
  useLayoutEffect(() => {
    const el = sceneRef.current;
    if (!el) return;
    const measure = () => {
      sizeRef.current = { w: el.clientWidth, h: el.clientHeight };
      paint();
    };
    measure();
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Axis labels follow the language.
  useEffect(() => {
    paint();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lang]);

  // Back from a hidden tab: resolve whatever happened meanwhile. Stop everything on unmount.
  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState === 'visible') stepRef.current();
    };
    document.addEventListener('visibilitychange', onVis);
    return () => {
      document.removeEventListener('visibilitychange', onVis);
      cancelAnimationFrame(rafRef.current);
      clearTimeout(timerRef.current);
    };
  }, []);

  // Keyboard: Space / Enter launches or cashes out.
  const keys = useRef({ main });
  keys.current = { main };
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey || e.repeat) return;
      if (document.querySelector('[role="dialog"], .lp-modal-backdrop')) return;
      const el = e.target instanceof HTMLElement ? e.target : null;
      if (el?.closest('input, textarea, select, [contenteditable="true"]')) return;
      if (e.key !== ' ' && e.key !== 'Enter') return;
      // A focused control answers Space / Enter itself.
      if (el?.closest('button, a, [role="switch"]')) return;
      e.preventDefault();
      keys.current.main();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // ---------- Auto cash-out field ----------

  const commitAuto = (raw: string) => {
    const v = parseAuto(raw);
    if (v == null) {
      // Cleared: auto cash-out off, keep the last target for next time.
      saveAuto({ ...auto, on: false });
      setAutoText(auto.value.toFixed(2));
      return;
    }
    saveAuto({ on: true, value: v });
    setAutoText(v.toFixed(2));
  };

  // Mouse clicks shouldn't leave focus on a button, so Space keeps meaning "launch / cash out".
  const noFocus = (e: MouseEvent) => e.preventDefault();

  // ---------- Render ----------

  const flying = phase === 'flying';
  const boom = phase === 'boom';
  const cashAmount = payoutFor(stake, mult);
  const target = auto.on ? auto.value : null;
  const tier = boom ? 'boom' : mult >= 10 ? 'high' : mult >= 2 ? 'mid' : 'low';
  const grow = 1 + Math.min(0.2, Math.log10(Math.max(1, mult)) * 0.1);
  const readLabel = boom
    ? lastCrash != null && lastCrash <= 1
      ? t.onPad
      : t.explodedAtLabel
    : flying
      ? live && target
        ? `${t.cashAt} ${formatMult(target, lang)}`
        : ''
      : history.length
        ? t.ready
        : t.firstHint;

  return (
    <div className={s.wrap}>
      <div className={s.history} aria-label={t.history}>
        <span className={s.historyLabel}>{t.history}</span>
        <div className={s.chips}>
          {history.length === 0 ? (
            <span className={s.historyEmpty}>{t.historyEmpty}</span>
          ) : (
            history.map((m, i) => (
              <span
                key={i === 0 ? `new-${historyNo}` : `${i}-${m}`}
                className={`${s.chip} ${s[`chip_${crashTier(m)}`]}${i === 0 && historyNo > 0 ? ` ${s.chipNew}` : ''}`}
                title={t.historyChip(formatMult(m, lang))}
              >
                {formatMult(m, lang)}
              </span>
            ))
          )}
        </div>
      </div>

      {/* Stats / result slot: same height either way so nothing jumps. */}
      <div className={s.slot}>
        {end ? (
          <RoundResult stake={end.stake} payout={end.payout} lang={lang} detail={end.detail} />
        ) : live ? (
          <div className={s.hud}>
            <Stat label={t.stake} value={formatMoney(stake, lang)} />
            <Stat label={t.profit} value={formatMoney(cashAmount - stake, lang, true)} tone={cashAmount > stake ? 'up' : undefined} big />
            <Stat label={t.cashAt} value={target ? formatMult(target, lang) : t.manual} />
          </div>
        ) : (
          <div className={s.hud}>
            <Stat label={t.target} value={target ? formatMult(target, lang) : t.manual} />
            <Stat label={t.chance} value={target ? pct(reachChance(target), lang) : '—'} big />
            <Stat label={t.pays} value={target ? formatMoney(payoutFor(bet, target), lang) : '—'} />
          </div>
        )}
      </div>

      <div
        ref={sceneRef}
        className={`${s.scene}${flying ? ` ${s.isFlying}` : ''}${boom ? ` ${s.isBoom}` : ''}`}
        role="img"
        aria-label={boom ? t.explodedAt(formatMult(mult, lang)) : t.scene}
      >
        <div className={s.sky} aria-hidden>
          <div className={s.starfield}>
            {[0, 50].map((off) =>
              STARS.map((st, i) => (
                <i
                  key={`${off}-${i}`}
                  className={s.star}
                  style={
                    {
                      left: `${st.x}%`,
                      top: `${off + st.y / 2}%`,
                      '--sz': `${st.size}px`,
                      animationDelay: `${st.delay}s`,
                      animationDuration: `${st.dur}s`,
                    } as CSSProperties
                  }
                />
              )),
            )}
          </div>
        </div>
        <canvas ref={canvasRef} className={s.canvas} aria-hidden />

        <div className={`${s.rocket}${boom ? ` ${s.rocketGone}` : ''}${flying ? ` ${s.rocketOn}` : ''}`} ref={rocketRef} aria-hidden>
          <RocketSvg />
        </div>

        {burst && (
          <div key={burst.n} className={s.burst} style={{ left: burst.x, top: burst.y }} aria-hidden>
            <span className={s.flash} />
            <span className={s.ring} />
            {SPARKS.map((sp, i) => (
              <i key={i} className={s.spark} style={{ '--a': `${sp.a}deg`, '--d': `${sp.d}px` } as CSSProperties} />
            ))}
            {[0, 1, 2, 3].map((i) => (
              <b key={i} className={s.smoke} style={{ '--a': `${i * 90 + 45}deg` } as CSSProperties} />
            ))}
          </div>
        )}

        <div className={`${s.readout}${phase === 'idle' ? ` ${s.readoutIdle}` : ''}`} aria-hidden>
          {flying && cashed ? (
            <span className={s.cashedPill} key={`c${cashed.mult}`}>
              {t.youCashed(formatMult(cashed.mult, lang), formatMoney(cashed.payout, lang))}
            </span>
          ) : (
            <span className={`${s.readLabel}${boom ? ` ${s.readLabelBoom}` : ''}`}>{readLabel || ' '}</span>
          )}
          <strong className={`${s.big} ${s[`big_${tier}`]}${flying && cashed ? ` ${s.bigGhost}` : ''}`} style={{ '--grow': grow } as CSSProperties}>
            {formatMult(mult, lang)}
          </strong>
        </div>
      </div>

      <div className={s.controls}>
        <BetInput value={bet} onChange={setBet} disabled={live} lang={lang} />

        <div className={`${s.auto}${auto.on ? ` ${s.autoOn}` : ''}${live ? ` ${s.autoLocked}` : ''}`} title={t.autoHint(formatMult(MIN_AUTO, lang))}>
          <label className={s.autoField}>
            <span className={s.autoLabel}>{t.autoCashOut}</span>
            <span className={s.autoInput}>
              <span aria-hidden>×</span>
              <input
                type="text"
                inputMode="decimal"
                value={autoText}
                disabled={live}
                aria-label={t.autoTarget}
                placeholder={t.autoOff}
                onFocus={(e) => {
                  const el = e.currentTarget;
                  requestAnimationFrame(() => el.select());
                }}
                onChange={(e) => setAutoText(e.target.value)}
                onBlur={(e) => commitAuto(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                }}
              />
            </span>
          </label>
          <span className={s.autoState}>{auto.on ? pct(reachChance(auto.value), lang) : t.autoOff}</span>
          <button
            type="button"
            role="switch"
            aria-checked={auto.on}
            aria-label={t.autoToggle}
            className={s.switch}
            disabled={live}
            onMouseDown={noFocus}
            onClick={() => saveAuto({ ...auto, on: !auto.on })}
          >
            <span className={s.knob} />
          </button>
        </div>

        {live ? (
          <button type="button" className={`btn btn-block ${s.bigBtn} ${s.cashBtn}`} onMouseDown={noFocus} onClick={cashOut}>
            {t.cashOut(formatMoney(cashAmount, lang))}
          </button>
        ) : (
          <button type="button" className={`btn btn-block ${s.bigBtn} ${s.launchBtn}`} onMouseDown={noFocus} onClick={launch}>
            <LaunchIcon />
            {flying || boom ? t.launchAgain : t.launch}
          </button>
        )}
        <p className={s.keys}>{t.keysHint}</p>
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

/** Side-on rocket, nose to the right; (0, 0) of its box is the middle of the nozzle. */
function RocketSvg() {
  return (
    <svg className={s.rocketSvg} viewBox="0 0 64 32" aria-hidden>
      <g className={s.flame}>
        <path d="M17 16c-5-6-11-6-17 0 6 6 12 6 17 0z" fill="#ff922b" />
        <path d="M17 16c-3.5-3.6-7.5-3.6-11.5 0 4 3.6 8 3.6 11.5 0z" fill="#ffd43b" />
        <path d="M17 16c-2-1.8-4-1.8-6 0 2 1.8 4 1.8 6 0z" fill="#fff9db" />
      </g>
      {/* fins */}
      <path d="M22 9.5 17 3.5h6.5l6 6z" fill="#e03131" />
      <path d="M22 22.5 17 28.5h6.5l6-6z" fill="#e03131" />
      {/* nozzle */}
      <path d="M17.5 12h4.5v8h-4.5z" fill="#495057" />
      {/* body */}
      <path d="M21 9.5h26c7 0 12 3.2 15 6.5-3 3.3-8 6.5-15 6.5H21z" fill="#f1f3f5" />
      <path d="M21 16h41c-3 3.3-8 6.5-15 6.5H21z" fill="#ced4da" />
      <path d="M50 10.2c5 .9 9 3.2 12 5.8-3 2.6-7 4.9-12 5.8 1.6-3.8 1.6-7.8 0-11.6z" fill="#e03131" />
      <circle cx="40" cy="16" r="3.6" fill="#1c7ed6" stroke="#adb5bd" strokeWidth="1.4" />
      <circle cx="39" cy="15" r="1.1" fill="#fff" opacity=".8" />
      <path d="M26 9.5v13" stroke="#adb5bd" strokeWidth="1" />
      {/* centre fin */}
      <path d="M24 16h8l-3 2.2h-5z" fill="#c92a2a" />
    </svg>
  );
}

function LaunchIcon() {
  return (
    <svg className={s.launchIcon} viewBox="0 0 20 20" aria-hidden>
      <path d="M11.8 2.6c2.6-.9 4.8-.9 5.6-.4.5.8.5 3-.4 5.6-.9 2.5-3 5-5.9 6.8l-.9 3-2.3-2.3-1.7.6-1.9-1.9.6-1.7-2.3-2.3 3-.9C7.4 5.6 9.3 3.5 11.8 2.6z" fill="currentColor" />
      <circle cx="12.8" cy="7.2" r="1.7" fill="var(--rk-launch)" />
      <path d="M4.6 13.2c-1.4.4-2.3 1.8-2.4 4.2 2.4-.1 3.8-1 4.2-2.4" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}
