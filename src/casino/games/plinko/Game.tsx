import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type MouseEvent, type ReactNode } from 'react';
import type { CasinoGameProps, Round } from '../../types';
import { BetInput, Money, RoundResult } from '../../components';
import { formatMoney } from '../../wallet';
import { LOCALE, type Lang } from '../../../lib/i18n';
import { readJSON, writeJSON } from '../../../lib/storage';
import {
  BOARD_ASPECT,
  BOARD_H,
  BOARD_W,
  ballTrack,
  bucketChance,
  bucketColor,
  bucketLabel,
  bucketSpan,
  clampBalls,
  clampRows,
  DEFAULT_RISK,
  dropBall,
  expectedReturn,
  geometry,
  isRisk,
  MAX_BALLS,
  MAX_ROWS,
  MIN_BALLS,
  MIN_ROWS,
  multText,
  pegCount,
  pegOffset,
  pegsInRow,
  pegX,
  pegY,
  positionAt,
  QUICK_BALLS,
  releaseGap,
  RISKS,
  stepMs,
  table,
  type Risk,
  type Track,
} from './logic';
import { PS } from './i18n';
import s from './Game.module.css';

const ROWS_KEY = 'casino-plinko-rows';
const RISK_KEY = 'casino-plinko-risk';
const BALLS_KEY = 'casino-plinko-balls';
/** How many recent landings the results column keeps. */
const HISTORY = 8;
/** A peg's glow after a hit, and a landed ball's fade into its bucket (ms). */
const FLASH_MS = 380;
const FADE_MS = 110;

interface LiveBall {
  track: Track;
  start: number;
  /** Next event on the track to handle (a peg hit, then the landing). */
  next: number;
  landedAt: number;
  round: Round;
  bucket: number;
  mult: number;
  payout: number;
  bet: number;
  rows: number;
  risk: Risk;
}

interface Queue {
  left: number;
  total: number;
  bet: number;
  rows: number;
  risk: Risk;
  nextAt: number;
}

/** Totals for the current drop (every ball since the board was last empty). */
interface DropTotals {
  total: number;
  released: number;
  landed: number;
  staked: number;
  /** Stakes of the balls that have landed (the in-flight ones aren't decided yet on screen). */
  landedStake: number;
  won: number;
  best: number;
  lastMult: number;
}

interface Landing {
  id: number;
  mult: number;
  color: string;
}

const pct = (p: number, lang: Lang, digits = 0) =>
  p.toLocaleString(LOCALE[lang], { style: 'percent', minimumFractionDigits: digits, maximumFractionDigits: digits });

const reducedMotion = () => typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

export default function Game({ lang, bet, setBet, begin, onBusy }: CasinoGameProps) {
  const t = PS[lang];
  const tRef = useRef(t);
  tRef.current = t;
  const langRef = useRef(lang);
  langRef.current = lang;

  const [rows, setRowsState] = useState(() => clampRows(readJSON<unknown>(ROWS_KEY, 16)));
  const [risk, setRiskState] = useState<Risk>(() => {
    const v = readJSON<unknown>(RISK_KEY, DEFAULT_RISK);
    return isRisk(v) ? v : DEFAULT_RISK;
  });
  const [balls, setBallsState] = useState(() => clampBalls(readJSON<unknown>(BALLS_KEY, 1)));
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const [releasing, setReleasing] = useState<{ k: number; n: number } | null>(null);
  const [totals, setTotals] = useState<DropTotals | null>(null);
  const [done, setDone] = useState(false);
  const [history, setHistory] = useState<Landing[]>([]);

  const g = useMemo(() => geometry(rows), [rows]);
  const mults = useMemo(() => table(rows, risk), [rows, risk]);
  const span = bucketSpan(g);

  // ---------- Engine state (refs: the animation never waits on React) ----------
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const boardRef = useRef<HTMLDivElement>(null);
  const bucketEls = useRef<(HTMLDivElement | null)[]>([]);
  const popEls = useRef<(HTMLSpanElement | null)[]>([]);
  const live = useRef<LiveBall[]>([]);
  const queue = useRef<Queue | null>(null);
  const flashes = useRef<Float64Array>(new Float64Array(pegCount(MAX_ROWS)).fill(-1e9));
  const raf = useRef(0);
  const size = useRef({ w: 0, dpr: 1 });
  const sprite = useRef<{ c: HTMLCanvasElement; r: number; pad: number } | null>(null);
  const geo = useRef(g);
  geo.current = g;
  const reduced = useRef(false);
  const landingId = useRef(0);
  const lastPop = useRef(-1e9);
  const beginRef = useRef(begin);
  beginRef.current = begin;
  const onBusyRef = useRef(onBusy);
  onBusyRef.current = onBusy;

  const locked = busy;

  // ---------- Settings ----------
  const clearDrop = () => {
    setTotals(null);
    setDone(false);
  };
  const setRows = (n: number) => {
    if (busy) return;
    const c = clampRows(n);
    setRowsState(c);
    writeJSON(ROWS_KEY, c);
    clearDrop();
  };
  const setRisk = (r: Risk) => {
    if (busy) return;
    setRiskState(r);
    writeJSON(RISK_KEY, r);
    clearDrop();
  };
  const setBalls = (n: number) => {
    if (busy) return;
    const c = clampBalls(n);
    setBallsState(c);
    writeJSON(BALLS_KEY, c);
  };

  // ---------- Drawing ----------
  const buildSprite = useCallback(() => {
    const { w, dpr } = size.current;
    if (!w) return;
    const k = (w / BOARD_W) * dpr;
    const r = geo.current.ballR * k;
    const pad = Math.ceil(r * 1.3);
    const dim = Math.ceil((r + pad) * 2);
    const c = document.createElement('canvas');
    c.width = dim;
    c.height = dim;
    const ctx = c.getContext('2d');
    if (!ctx) return;
    const cx = dim / 2;
    // Soft pink glow, then the ball with a highlight up and to the left.
    const glow = ctx.createRadialGradient(cx, cx, r * 0.6, cx, cx, r + pad);
    glow.addColorStop(0, 'rgba(255, 70, 140, 0.55)');
    glow.addColorStop(0.45, 'rgba(255, 70, 140, 0.18)');
    glow.addColorStop(1, 'rgba(255, 70, 140, 0)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, dim, dim);
    const body = ctx.createRadialGradient(cx - r * 0.35, cx - r * 0.4, r * 0.1, cx, cx, r);
    body.addColorStop(0, '#ffd1e3');
    body.addColorStop(0.35, '#ff5c9a');
    body.addColorStop(1, '#d6246a');
    ctx.fillStyle = body;
    ctx.beginPath();
    ctx.arc(cx, cx, r, 0, Math.PI * 2);
    ctx.fill();
    sprite.current = { c, r, pad };
  }, []);

  const draw = useCallback((now: number) => {
    const cv = canvasRef.current;
    const ctx = cv?.getContext('2d');
    const { w, dpr } = size.current;
    if (!cv || !ctx || !w) return;
    const gm = geo.current;
    const k = (w / BOARD_W) * dpr;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, cv.width, cv.height);
    ctx.setTransform(k, 0, 0, k, 0, 0);
    const fl = flashes.current;
    const calm = reduced.current;

    // Pegs, with a pink halo on the ones just hit.
    for (let r = 0; r < gm.rows; r++) {
      const y = pegY(gm, r);
      const n = pegsInRow(r);
      const off = pegOffset(r);
      for (let i = 0; i < n; i++) {
        const x = pegX(gm, r, i);
        const age = (now - fl[off + i]) / FLASH_MS;
        const hit = age >= 0 && age < 1;
        if (hit && !calm) {
          ctx.fillStyle = `rgba(255, 92, 154, ${(0.45 * (1 - age)).toFixed(3)})`;
          ctx.beginPath();
          ctx.arc(x, y, gm.pegR * (1.8 + 1.6 * age), 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.fillStyle = hit ? `rgb(255, ${Math.round(200 + 55 * age)}, ${Math.round(225 + 30 * age)})` : 'rgba(240, 244, 255, 0.92)';
        ctx.beginPath();
        ctx.arc(x, y, gm.pegR * (hit ? 1.12 - 0.12 * age : 1), 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Balls.
    const sp = sprite.current;
    if (!sp) return;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    for (const b of live.current) {
      const el = now - b.start;
      if (el < 0) continue;
      const p = positionAt(b.track, el);
      let alpha = Math.min(1, el / 90);
      let y = p.y;
      if (b.landedAt) {
        const f = (now - b.landedAt) / FADE_MS;
        alpha = Math.max(0, 1 - f);
        y += f * gm.ballR * 1.2;
      }
      if (alpha <= 0) continue;
      ctx.globalAlpha = alpha;
      const d = sp.c.width;
      ctx.drawImage(sp.c, p.x * k - d / 2, y * k - d / 2);
    }
    ctx.globalAlpha = 1;
  }, []);

  // ---------- Landing ----------
  const land = useCallback((b: LiveBall, now: number) => {
    b.landedAt = now;
    const tt = tRef.current;
    b.round.settle(b.payout, tt.note(b.rows, tt.risks[b.risk], multText(b.mult, langRef.current)));
    const bucketEl = bucketEls.current[b.bucket];
    const pop = popEls.current[b.bucket];
    if (!reduced.current && typeof bucketEl?.animate === 'function') {
      bucketEl.animate(
        [{ transform: 'translateY(0)' }, { transform: 'translateY(22%)', filter: 'brightness(1.25)' }, { transform: 'translateY(0)' }],
        { duration: 280, easing: 'cubic-bezier(.3,1.6,.5,1)' },
      );
    }
    // The newest landing's bucket (and its pop-up) sits on top of its neighbours'.
    if (bucketEl) bucketEl.style.zIndex = String(++landingId.current);
    // Wins always pop; other landings only when nothing else is popping, so a busy middle stays readable.
    const showPop = b.mult > 1 || now - lastPop.current > 420;
    if (showPop) lastPop.current = now;
    if (showPop && pop && typeof pop.animate === 'function') {
      pop.getAnimations().forEach((a) => a.cancel());
      pop.animate(
        reduced.current
          ? [{ opacity: 1 }, { opacity: 1, offset: 0.6 }, { opacity: 0 }]
          : [
              { opacity: 0, transform: 'translate(-50%, 30%) scale(.7)' },
              { opacity: 1, transform: 'translate(-50%, -40%) scale(1.08)', offset: 0.25 },
              { opacity: 1, transform: 'translate(-50%, -80%) scale(1)', offset: 0.7 },
              { opacity: 0, transform: 'translate(-50%, -120%) scale(1)' },
            ],
        { duration: 700, easing: 'ease-out' },
      );
    }
    const color = bucketColor(b.bucket, b.rows).bg;
    const id = ++landingId.current;
    setHistory((h) => [{ id, mult: b.mult, color }, ...h].slice(0, HISTORY));
    setTotals((tot) =>
      tot
        ? {
            ...tot,
            landed: tot.landed + 1,
            landedStake: Math.round((tot.landedStake + b.bet) * 100) / 100,
            won: Math.round((tot.won + b.payout) * 100) / 100,
            best: Math.max(tot.best, b.mult),
            lastMult: b.mult,
          }
        : tot,
    );
  }, []);

  // ---------- The loop ----------
  const release = useCallback((now: number) => {
    const q = queue.current;
    if (!q || q.left <= 0) return;
    const tt = tRef.current;
    const ball = dropBall(q.rows, q.risk, q.bet);
    const round = beginRef.current(q.bet, tt.noteStart(q.rows, tt.risks[q.risk]));
    const track = ballTrack(geometry(q.rows), ball.path, stepMs(q.rows, reduced.current), { bounce: reduced.current ? 0.35 : 0.9 });
    live.current.push({ track, start: now, next: 0, landedAt: 0, round, bucket: ball.bucket, mult: ball.mult, payout: ball.payout, bet: q.bet, rows: q.rows, risk: q.risk });
    q.left--;
    q.nextAt = now + releaseGap(q.total);
    const k = q.total - q.left;
    setReleasing(q.left > 0 ? { k, n: q.total } : null);
    setTotals((tot) => (tot ? { ...tot, released: tot.released + 1, staked: Math.round((tot.staked + q.bet) * 100) / 100 } : tot));
    if (q.left <= 0) queue.current = null;
  }, []);

  const tick = useCallback(
    (now: number) => {
      raf.current = 0;
      const q = queue.current;
      if (q && now >= q.nextAt) release(now);
      const fl = flashes.current;
      let lastFlash = -1e9;
      for (const b of live.current) {
        const el = now - b.start;
        const tr = b.track;
        while (b.next < tr.pegs.length && tr.ends[b.next] <= el) {
          const peg = tr.pegs[b.next];
          const at = b.start + tr.ends[b.next];
          if (peg >= 0) fl[peg] = at;
          else land(b, now);
          b.next++;
        }
      }
      for (let i = 0; i < fl.length; i++) if (fl[i] > lastFlash) lastFlash = fl[i];
      // Drop balls that have faded into their bucket.
      live.current = live.current.filter((b) => !b.landedAt || now - b.landedAt < FADE_MS);
      draw(now);
      const flying = live.current.some((b) => !b.landedAt);
      if (!flying && !queue.current && busyRef.current) {
        busyRef.current = false;
        setBusy(false);
        setDone(true);
        onBusyRef.current(false);
      }
      if (live.current.length || queue.current || now - lastFlash < FLASH_MS) raf.current = requestAnimationFrame(tick);
    },
    [draw, land, release],
  );

  const kick = useCallback(() => {
    if (!raf.current) raf.current = requestAnimationFrame(tick);
  }, [tick]);

  useEffect(
    () => () => {
      if (raf.current) cancelAnimationFrame(raf.current);
      raf.current = 0;
    },
    [],
  );

  // ---------- Drop ----------
  const drop = useCallback(() => {
    if (queue.current) return;
    const now = performance.now();
    reduced.current = reducedMotion();
    const fresh = !live.current.some((b) => !b.landedAt);
    setTotals((tot) =>
      fresh || !tot
        ? { total: balls, released: 0, landed: 0, staked: 0, landedStake: 0, won: 0, best: 0, lastMult: 0 }
        : { ...tot, total: tot.total + balls },
    );
    setDone(false);
    if (!busyRef.current) {
      busyRef.current = true;
      setBusy(true);
      onBusyRef.current(true);
    }
    queue.current = { left: balls, total: balls, bet, rows, risk, nextAt: now };
    release(now);
    kick();
  }, [balls, bet, kick, release, risk, rows]);

  // ---------- Size ----------
  useLayoutEffect(() => {
    const el = boardRef.current;
    const cv = canvasRef.current;
    if (!el || !cv) return;
    const fit = () => {
      const w = el.clientWidth;
      const dpr = Math.min(window.devicePixelRatio || 1, 3);
      if (!w) return;
      size.current = { w, dpr };
      cv.width = Math.round(w * dpr);
      cv.height = Math.round(w * BOARD_ASPECT * dpr);
      buildSprite();
      draw(performance.now());
    };
    fit();
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  }, [buildSprite, draw]);

  // New rows: new peg layout and ball size.
  useLayoutEffect(() => {
    buildSprite();
    draw(performance.now());
  }, [g, buildSprite, draw]);

  // ---------- Keyboard: Space / Enter drop ----------
  const keys = useRef(drop);
  keys.current = drop;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey || e.repeat) return;
      if (document.querySelector('[role="dialog"], .lp-modal-backdrop')) return;
      const el = e.target instanceof HTMLElement ? e.target : null;
      if (el?.closest('input, textarea, select, [contenteditable="true"]')) return;
      if (e.key === ' ' || e.key === 'Enter') {
        // A focused button answers Space / Enter itself.
        if (el?.closest('button, a')) return;
        e.preventDefault();
        keys.current();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Mouse clicks shouldn't leave focus on a button, so Space keeps meaning "drop".
  const noFocus = (e: MouseEvent) => e.preventDefault();

  // ---------- Stats ----------
  const n = rows;
  const lowest = Math.min(...mults);
  const lowShare = mults.reduce((sum, m, k) => (m === lowest ? sum + bucketChance(n, k) : sum), 0);
  const edgeOdds = (2 ** n / 2).toLocaleString(LOCALE[lang]);
  const rtp = expectedReturn(n, risk);
  const cost = Math.round(bet * balls * 100) / 100;
  const riskName = t.risks[risk];

  let slot;
  if (done && totals) {
    const back = formatMoney(totals.won, lang);
    slot = (
      <RoundResult
        stake={totals.staked}
        payout={totals.won}
        lang={lang}
        detail={totals.landed === 1 ? t.summaryOne(multText(totals.lastMult, lang), back) : t.summary(totals.landed, back, multText(totals.best, lang))}
      />
    );
  } else if (totals) {
    const air = totals.released - totals.landed;
    slot = (
      <div className={s.hud}>
        <Stat label={t.landed} value={`${totals.landed} / ${totals.total}`} sub={t.inAir(air)} />
        <Stat label={t.won} value={formatMoney(totals.won, lang)} sub={t.ofStake(formatMoney(totals.staked, lang))} />
        <Stat
          label={t.net}
          value={<Money value={Math.round((totals.won - totals.landedStake) * 100) / 100} lang={lang} />}
          sub={totals.landed ? t.bestSub(multText(totals.best, lang)) : '\u00a0'}
        />
      </div>
    );
  } else {
    slot = (
      <div className={s.hud}>
        <Stat label={t.topPrize} value={multText(mults[0], lang)} sub={t.edgeOdds(edgeOdds)} />
        <Stat label={t.lowest} value={multText(lowest, lang)} sub={t.lowShare(pct(lowShare, lang))} />
        <Stat label={t.returnLabel} value={pct(rtp, lang, 1)} sub={t.longRun} />
      </div>
    );
  }

  const bucketFont = `clamp(7px, ${((g.gap / BOARD_W) * 100 * 0.4).toFixed(3)}cqw, 15px)`;
  const bucketsStyle: CSSProperties = {
    left: `${(span.left / BOARD_W) * 100}%`,
    width: `${(span.width / BOARD_W) * 100}%`,
    top: `${(g.bucketTop / BOARD_H) * 100}%`,
    height: `${(g.bucketH / BOARD_H) * 100}%`,
    gridTemplateColumns: `repeat(${n + 1}, minmax(0, 1fr))`,
    fontSize: bucketFont,
  };

  return (
    <div className={s.wrap}>
      <div className={s.slot} aria-live="polite">
        {slot}
      </div>

      <div className={s.boardWrap}>
        <div className={s.board} ref={boardRef} role="img" aria-label={t.board(n, riskName)}>
          <canvas ref={canvasRef} className={s.canvas} aria-hidden />
          <div className={s.buckets} style={bucketsStyle}>
            {mults.map((m, k) => {
              const c = bucketColor(k, n);
              return (
                <div
                  key={`${n}-${k}`}
                  ref={(el) => {
                    bucketEls.current[k] = el;
                  }}
                  className={s.bucket}
                  style={{ '--b': c.bg, '--be': c.edge } as CSSProperties}
                  title={t.bucketLabel(k, multText(m, lang), pct(bucketChance(n, k), lang, 2))}
                >
                  <span className={`${s.bucketText}${bucketLabel(m, lang).length >= 3 ? ` ${s.long}` : ''}`}>
                    {bucketLabel(m, lang)}
                    <i>×</i>
                  </span>
                  <span
                    className={s.pop}
                    ref={(el) => {
                      popEls.current[k] = el;
                    }}
                    aria-hidden
                  >
                    {multText(m, lang)}
                  </span>
                </div>
              );
            })}
          </div>
          {history.length > 0 && (
            <ol className={s.history} aria-label={t.lastResults}>
              {history.map((h) => (
                <li key={h.id} className={s.chip} style={{ '--b': h.color } as CSSProperties}>
                  {bucketLabel(h.mult, lang)}×
                </li>
              ))}
            </ol>
          )}
        </div>
      </div>

      <div className={s.controls}>
        <div className={s.settings}>
          <div className={s.block}>
            <span className={s.label} id="plinko-rows">
              {t.rows}
            </span>
            <div className={s.stepper} role="group" aria-labelledby="plinko-rows">
              <button type="button" className={s.step} disabled={locked || rows <= MIN_ROWS} onMouseDown={noFocus} onClick={() => setRows(rows - 1)} aria-label={t.fewerRows}>
                <svg viewBox="0 0 16 16" aria-hidden>
                  <path d="M3.5 8h9" />
                </svg>
              </button>
              <output className={s.value} aria-label={t.rowsValue(rows)}>
                {rows}
              </output>
              <button type="button" className={s.step} disabled={locked || rows >= MAX_ROWS} onMouseDown={noFocus} onClick={() => setRows(rows + 1)} aria-label={t.moreRows}>
                <svg viewBox="0 0 16 16" aria-hidden>
                  <path d="M3.5 8h9M8 3.5v9" />
                </svg>
              </button>
            </div>
          </div>
          <div className={`${s.block} ${s.grow}`}>
            <span className={s.label} id="plinko-risk">
              {t.risk}
            </span>
            <div className={s.segment} role="radiogroup" aria-labelledby="plinko-risk">
              {RISKS.map((r) => (
                <button
                  key={r}
                  type="button"
                  role="radio"
                  aria-checked={risk === r}
                  className={`${s.segBtn}${risk === r ? ` ${s.segOn}` : ''}`}
                  disabled={locked}
                  onMouseDown={noFocus}
                  onClick={() => setRisk(r)}
                >
                  {t.risks[r]}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className={s.block}>
          <div className={s.head}>
            <span className={s.label} id="plinko-balls">
              {t.balls}
            </span>
            <span className={s.info}>{t.costPerDrop(formatMoney(cost, lang))}</span>
          </div>
          <div className={s.ballsRow}>
            <div className={s.stepper} role="group" aria-labelledby="plinko-balls">
              <button type="button" className={s.step} disabled={locked || balls <= MIN_BALLS} onMouseDown={noFocus} onClick={() => setBalls(balls - 1)} aria-label={t.fewerBalls}>
                <svg viewBox="0 0 16 16" aria-hidden>
                  <path d="M3.5 8h9" />
                </svg>
              </button>
              <output className={s.value} aria-label={t.ballsPick(balls)}>
                {balls}
              </output>
              <button type="button" className={s.step} disabled={locked || balls >= MAX_BALLS} onMouseDown={noFocus} onClick={() => setBalls(balls + 1)} aria-label={t.moreBalls}>
                <svg viewBox="0 0 16 16" aria-hidden>
                  <path d="M3.5 8h9M8 3.5v9" />
                </svg>
              </button>
            </div>
            <div className={s.quick}>
              {QUICK_BALLS.map((q) => (
                <button
                  key={q}
                  type="button"
                  className={`${s.chipBtn}${q === balls ? ` ${s.chipOn}` : ''}`}
                  disabled={locked}
                  aria-pressed={q === balls}
                  aria-label={t.ballsPick(q)}
                  onMouseDown={noFocus}
                  onClick={() => setBalls(q)}
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        </div>

        <BetInput value={bet} onChange={setBet} disabled={locked} lang={lang} />

        <button type="button" className={`btn btn-primary btn-block ${s.dropBtn}`} disabled={!!releasing} onMouseDown={noFocus} onClick={drop}>
          {releasing ? t.dropping(releasing.k, releasing.n) : t.drop(balls, formatMoney(cost, lang))}
        </button>
        <p className={s.keys}>{t.keys}</p>
      </div>
    </div>
  );
}

function Stat({ label, value, sub }: { label: string; value: ReactNode; sub: string }) {
  return (
    <div className={s.stat}>
      <span className={s.statLabel}>{label}</span>
      <strong className={s.statValue}>{value}</strong>
      <span className={s.statSub}>{sub}</span>
    </div>
  );
}
