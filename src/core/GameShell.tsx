import { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState, type ComponentType } from 'react';
import { statsVariant, type GameEntry, type GameProps, type GameResult, type GameSettingDef } from './types';
import { Stopwatch } from './stopwatch';
import { Timer } from './components/Timer';
import { ArrowLeft, Chart, Gear, Help, Play, Shuffle } from './components/Icons';
import { Modal } from './components/Modal';
import { ErrorBoundary } from './components/ErrorBoundary';
import { Segmented, Toggle } from './components/Controls';
import { ResultSheet, type FinishedRound } from './ResultSheet';
import { href, navigate, useRoute } from '../lib/router';
import { codeToSeed, randomSeed, seedToCode } from '../lib/rng';
import { addRecord, computeStats, loadHistory, useHistory, variantKey } from '../lib/stats';
import { formatTime } from '../lib/time';
import { useAppSettings, useGameSetting } from '../lib/settings';
import { readJSON, writeJSON } from '../lib/storage';
import { pick, type Lang } from '../lib/i18n';
import { useCore } from '../i18n/core';

type Phase = 'intro' | 'playing' | 'done';

function defaultOptions(entry: GameEntry, params: URLSearchParams, lang: Lang): Record<string, string> {
  const saved = readJSON<Record<string, string>>(`last-options:${entry.meta.id}`, {});
  const out: Record<string, string> = {};
  for (const opt of entry.meta.options ?? []) {
    const fromUrl = params.get(opt.id);
    const valid = (v: string | null | undefined) => !!v && opt.choices.some((c) => c.value === v);
    if (valid(fromUrl)) out[opt.id] = fromUrl!;
    else if (opt.followsLanguage) out[opt.id] = valid(lang) ? lang : opt.default;
    else out[opt.id] = valid(saved[opt.id]) ? saved[opt.id] : opt.default;
  }
  return out;
}

export function GameShell({ entry }: { entry: GameEntry }) {
  const { meta } = entry;
  const route = useRoute();
  const [settings] = useAppSettings();
  const { t, lang } = useCore();
  const name = pick(meta.name, lang);
  const englishOnly = !!meta.contentLanguages && !meta.contentLanguages.includes(lang);
  const Game = useMemo(() => lazy(entry.load) as unknown as ComponentType<GameProps>, [entry]);

  const [options, setOptions] = useState(() => defaultOptions(entry, route.params, lang));
  const [seed, setSeed] = useState<number>(() => codeToSeed(route.params.get('s')) ?? randomSeed());
  const [phase, setPhase] = useState<Phase>('intro');
  const [round, setRound] = useState(0);
  const [ready, setReady] = useState(false);
  const [paused, setPaused] = useState(false);
  const [finished, setFinished] = useState<FinishedRound | null>(null);
  const [showResult, setShowResult] = useState(false);
  const [modal, setModal] = useState<null | 'help' | 'settings' | 'variant' | 'quit'>(null);
  const watch = useRef(new Stopwatch()).current;
  const hints = useRef(0);
  const completed = useRef(false);
  const history = useHistory(meta.id);
  const variant = variantKey(statsVariant(meta, options));
  const stats = useMemo(() => computeStats(history, variant), [history, variant]);

  // Warm the game chunk while the intro is showing.
  useEffect(() => {
    entry.load().catch(() => {});
  }, [entry]);

  // First visit to a game: show how to play.
  useEffect(() => {
    const seen = readJSON<Record<string, boolean>>('seen-help', {});
    if (!seen[meta.id]) {
      setModal('help');
      writeJSON('seen-help', { ...seen, [meta.id]: true });
    }
  }, [meta.id]);

  // ---------- Leave guard: confirm before quitting a round you've started ----------
  // Once you touch the board, an extra history entry with the same URL is pushed. Browser or
  // gesture "back" then pops only that entry (the page stays put) and we ask first. After the
  // round is over, popping it just continues back, so it never costs an extra press.
  const [touched, setTouched] = useState(false);
  const guarded = phase === 'playing' && touched;
  const guardedRef = useRef(guarded);
  guardedRef.current = guarded;
  const guardPushed = useRef(false);
  const leaving = useRef(false);
  /** Where to go once the guard entry is popped (in-app links). */
  const pendingTarget = useRef<string | null>(null);
  /** The game's current URL; the entry under the guard may still hold an older seed. */
  const gameUrl = useRef(window.location.href);
  /** Why the quit dialog is open: browser back, or an in-app link to this hash. */
  const quitVia = useRef<'back' | string>('back');
  /** Set while the dialog asks about starting over (New, or a different puzzle type) instead of leaving. */
  const pendingRestart = useRef<(() => void) | null>(null);
  const [quitKind, setQuitKind] = useState<'leave' | 'new'>('leave');

  const pushGuard = useCallback(() => {
    if (guardPushed.current) return;
    window.history.pushState({ lpGuard: meta.id }, '', gameUrl.current);
    guardPushed.current = true;
  }, [meta.id]);

  const markTouched = useCallback(() => {
    if (phase !== 'playing') return;
    setTouched(true);
    pushGuard(); // inside the user's gesture, so browsers keep the entry for "back"
  }, [phase, pushGuard]);

  useEffect(() => {
    const onPop = () => {
      if (!guardPushed.current || window.history.state?.lpGuard) return;
      guardPushed.current = false;
      if (pendingTarget.current) {
        const to = pendingTarget.current;
        pendingTarget.current = null;
        window.location.hash = to;
      } else if (guardedRef.current && !leaving.current) {
        window.history.replaceState(null, '', gameUrl.current);
        quitVia.current = 'back';
        pendingRestart.current = null;
        setQuitKind('leave');
        setModal('quit');
      } else window.history.back();
    };
    const onUnload = (e: BeforeUnloadEvent) => {
      if (!guardedRef.current || leaving.current) return;
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('popstate', onPop);
    window.addEventListener('beforeunload', onUnload);
    return () => {
      window.removeEventListener('popstate', onPop);
      window.removeEventListener('beforeunload', onUnload);
    };
  }, []);

  // Keyboard games (Wordle, Pinpoint, Sudoku digits...) count as touched on their first key.
  useEffect(() => {
    if (phase !== 'playing' || touched || modal) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey || ['Tab', 'Escape', 'Shift', 'Meta', 'Control', 'Alt', 'CapsLock'].includes(e.key)) return;
      if ((e.target as HTMLElement | null)?.closest?.('.lp-topbar, .lp-play-bar')) return;
      markTouched();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [phase, touched, modal, markTouched]);

  /** In-app links out of the game (back arrow, stats): ask first, and never leave the guard behind. */
  // Every in-app link inside the game (back arrow, stats icon, the results sheet's Stats button,
  // "link to this puzzle"...) goes through here. A plain hash change would pop the guard entry and
  // read as "back", bouncing you to the game; instead ask first mid-round, and otherwise pop the
  // guard ourselves and then follow the link.
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as Element | null)?.closest?.('a[href^="#"]') as HTMLAnchorElement | null;
      if (!a || a.target === '_blank') return;
      const target = a.getAttribute('href')!;
      if (!guardPushed.current) return; // no guard entry: the link works as is
      e.preventDefault();
      if (target.split('?')[0] === href(meta.id)) {
        // Same game (e.g. "link to this puzzle"): update the address, keep playing.
        window.history.replaceState(window.history.state, '', target);
        gameUrl.current = window.location.href;
      } else if (guardedRef.current) {
        quitVia.current = target;
        pendingRestart.current = null;
        setQuitKind('leave');
        setModal('quit');
      } else {
        pendingTarget.current = target;
        window.history.back();
      }
    };
    document.addEventListener('click', onClick, true);
    return () => document.removeEventListener('click', onClick, true);
  }, [meta.id]);

  /** Starting a new puzzle mid-round throws the current one away too, so ask first. */
  const confirmNew = (run: () => void) => {
    if (!guarded) {
      setModal(null);
      run();
      return;
    }
    pendingRestart.current = run;
    setQuitKind('new');
    setModal('quit');
  };

  const stay = () => {
    setModal(null);
    if (pendingRestart.current) pendingRestart.current = null;
    else if (quitVia.current === 'back') pushGuard();
  };

  const quit = () => {
    const restart = pendingRestart.current;
    if (restart) {
      pendingRestart.current = null;
      setModal(null);
      restart();
      return;
    }
    leaving.current = true;
    setModal(null);
    if (quitVia.current !== 'back') {
      if (guardPushed.current) {
        pendingTarget.current = quitVia.current;
        window.history.back();
      } else window.location.hash = quitVia.current;
      return;
    }
    // The guard entry is already gone; keep going back. Opened straight from a link, there's
    // nothing behind this page, so fall back to the games list.
    const here = window.location.href;
    window.history.back();
    window.setTimeout(() => {
      if (window.location.href === here) navigate('', undefined, true);
    }, 350);
  };

  const syncUrl = useCallback(
    (s: number, opts: Record<string, string>) => {
      navigate(meta.id, { s: seedToCode(s), ...opts }, true);
      gameUrl.current = window.location.href;
    },
    [meta.id],
  );

  const begin = useCallback(
    (nextSeed: number, opts: Record<string, string>) => {
      watch.reset();
      hints.current = 0;
      completed.current = false;
      setTouched(false);
      setSeed(nextSeed);
      setOptions(opts);
      writeJSON(`last-options:${meta.id}`, opts);
      setFinished(null);
      setShowResult(false);
      setPaused(false);
      setReady(false);
      setRound((r) => r + 1);
      setPhase('playing');
      syncUrl(nextSeed, opts);
    },
    [meta.id, syncUrl, watch],
  );

  const newRound = useCallback(
    (opts = options) => {
      if (settings.skipIntro || phase === 'playing') begin(randomSeed(), opts);
      else {
        setSeed(randomSeed());
        setOptions(opts);
        setFinished(null);
        setShowResult(false);
        setPhase('intro');
      }
    },
    [begin, options, phase, settings.skipIntro],
  );

  const onReady = useCallback(() => {
    setReady(true);
    watch.start();
  }, [watch]);

  const onHint = useCallback(() => {
    hints.current += 1;
  }, []);

  const onComplete = useCallback(
    (result: GameResult) => {
      if (completed.current) return;
      completed.current = true;
      watch.stop();
      const ms = Math.round(watch.ms);
      const prior = computeStats(loadHistory(meta.id), variant);
      addRecord(meta.id, {
        at: Date.now(),
        ms,
        won: result.won,
        hints: hints.current,
        guesses: result.guesses,
        variant,
        seed,
      });
      const isBest = result.won && (prior.bestMs === null || ms < prior.bestMs);
      setFinished({
        result,
        ms,
        hints: hints.current,
        isBest,
        priorAvgMs: prior.avgMs,
        seed,
        options,
      });
      setPhase('done');
      window.setTimeout(() => setShowResult(true), result.won ? 900 : 600);
    },
    [meta.id, options, seed, variant, watch],
  );

  const togglePause = useCallback(() => {
    if (phase !== 'playing' || !ready) return;
    setPaused((p) => {
      if (p) watch.start();
      else watch.stop();
      return !p;
    });
  }, [phase, ready, watch]);

  // Auto-pause when the tab is hidden.
  useEffect(() => {
    if (!settings.autoPause || phase !== 'playing' || !ready) return;
    const onVis = () => {
      if (document.hidden) {
        watch.stop();
        setPaused(true);
      }
    };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, [phase, ready, settings.autoPause, watch]);

  // Pause the clock while a modal covers the board.
  useEffect(() => {
    if (phase !== 'playing' || !ready || paused) return;
    if (modal) {
      watch.stop();
      return () => watch.start();
    }
  }, [modal, phase, ready, paused, watch]);

  const optionLabel = (meta.options ?? [])
    .map((o) => {
      const label = o.choices.find((c) => c.value === options[o.id])?.label;
      return label === undefined ? undefined : pick(label, lang);
    })
    .filter(Boolean)
    .join(' · ');

  const boardMax = meta.boardMax?.(options);
  const style = {
    '--game-color': meta.color,
    '--game-color-end': meta.colorEnd,
    '--game-tint': meta.tint,
    ...(boardMax ? { '--board-max': `${boardMax}px` } : {}),
  } as React.CSSProperties;

  return (
    <div className="lp-shell" style={style}>
      <header className="lp-topbar">
        <div className="lp-topbar-inner">
          <a className="icon-btn" href={href('')} aria-label={t.backToGames}>
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
            <a
              className="icon-btn"
              href={href(`stats/${meta.id}`)}
              aria-label={t.statistics}
              title={t.statistics}
            >
              <Chart size={22} />
            </a>
            <button className="icon-btn" onClick={() => setModal('settings')} aria-label={t.settings} title={t.settings}>
              <Gear size={22} />
            </button>
          </div>
        </div>
      </header>

      {phase === 'intro' ? (
        <section className="lp-intro">
          <div className="lp-intro-inner">
            <div className="lp-intro-icon">
              <meta.Icon size={72} />
            </div>
            <h2 className="lp-intro-name">{name}</h2>
            <p className="lp-intro-tagline">{pick(meta.tagline, lang)}</p>
            <p className="lp-intro-code">{t.practiceCode(seedToCode(seed)).toUpperCase()}</p>
            {englishOnly && <p className="lp-intro-note">{t.englishOnly}</p>}
            {(meta.options ?? []).map((opt) => (
              <div key={opt.id} className="lp-intro-option">
                <span className="lp-intro-option-label">{pick(opt.label, lang)}</span>
                <Segmented
                  tone="onColor"
                  label={pick(opt.label, lang)}
                  value={options[opt.id]}
                  choices={opt.choices.map((c) => ({
                    value: c.value,
                    label: pick(c.label, lang),
                  }))}
                  onChange={(v) => setOptions({ ...options, [opt.id]: v })}
                />
              </div>
            ))}
            <button className="lp-intro-start" onClick={() => begin(seed, options)}>
              {t.startGame}
            </button>
            <div className="lp-intro-stats">
              {stats.streak.current > 0 && <span>{t.dayStreak(stats.streak.current)}</span>}
              {stats.bestMs !== null && <span>{t.bestTime(formatTime(stats.bestMs))}</span>}
              {(meta.scoring === 'guesses' || meta.canLose) && stats.played > 0 && <span>{t.winsPct(Math.round(stats.winRate * 100))}</span>}
              <span>{t.solvedCount(stats.wins)}</span>
            </div>
          </div>
        </section>
      ) : (
        <main className="lp-play">
          <div className="lp-play-inner">
            <div className="lp-play-bar">
              {settings.showTimer || phase === 'done' ? (
                <Timer watch={watch} paused={paused} onToggle={togglePause} disabled={phase === 'done' || !ready} />
              ) : (
                <button className="lp-timer" onClick={togglePause} aria-label={paused ? t.resume : t.pause}>
                  {paused ? t.resume : t.pause}
                </button>
              )}
              <div className="lp-play-bar-right">
                {meta.options?.length ? (
                  <button className="lp-chip" onClick={() => setModal('variant')} title={t.changeType}>
                    {optionLabel}
                  </button>
                ) : null}
                <button className="lp-chip" onClick={() => confirmNew(() => newRound())} title={t.newPuzzleTitle}>
                  <Shuffle size={14} /> {t.newPuzzle}
                </button>
              </div>
            </div>

            {englishOnly && <p className="lp-lang-note">{t.englishOnly}</p>}
            <div className={`lp-board-area${paused ? ' is-paused' : ''}`} onPointerDownCapture={touched ? undefined : markTouched}>
              <ErrorBoundary
                key={round}
                fallback={(reload) => (
                  <div className="lp-loading lp-load-failed">
                    <p>{t.loadFailed}</p>
                    <button className="btn btn-primary" onClick={reload}>
                      {t.reload}
                    </button>
                  </div>
                )}
              >
                <Suspense fallback={<div className="lp-loading">{t.loading}</div>}>
                  <Game
                    key={`${round}-${lang}`}
                    seed={seed}
                    lang={lang}
                    options={options}
                    paused={paused || phase === 'done'}
                    onReady={onReady}
                    onHint={onHint}
                    onComplete={onComplete}
                  />
                </Suspense>
              </ErrorBoundary>
              {paused && (
                <div className="lp-paused">
                  <p className="lp-paused-title">{t.paused}</p>
                  <button className="btn btn-primary" onClick={togglePause}>
                    <Play size={16} /> {t.resume}
                  </button>
                </div>
              )}
            </div>

            {phase === 'playing' && meta.settings?.length ? <GameToggles gameId={meta.id} defs={meta.settings} /> : null}

            {phase === 'done' && finished && !showResult && (
              <div className="lp-done-bar">
                <span>
                  {finished.result.won ? t.solvedIn : t.finishedIn} <strong>{formatTime(finished.ms)}</strong>
                </span>
                <div className="lp-done-actions">
                  <button className="btn btn-secondary btn-sm" onClick={() => setShowResult(true)}>
                    {t.results}
                  </button>
                  <button className="btn btn-primary btn-sm" onClick={() => newRound()}>
                    {t.playAgain}
                  </button>
                </div>
              </div>
            )}
            <p className="lp-play-code">
              {t.practiceCode(seedToCode(seed))} · <a href={`${href(meta.id, { s: seedToCode(seed), ...options })}`}>{t.linkToPuzzle}</a>
            </p>
          </div>
        </main>
      )}

      {finished && <ResultSheet open={showResult} meta={meta} round={finished} onClose={() => setShowResult(false)} onPlayAgain={() => newRound()} />}

      <Modal
        open={modal === 'quit'}
        onClose={stay}
        title={quitKind === 'new' ? t.newTitle : t.quitTitle}
        footer={
          <div className="lp-quit-actions">
            <button className="btn btn-secondary" onClick={stay}>
              {t.keepPlaying}
            </button>
            <button className="btn btn-primary" onClick={quit}>
              {quitKind === 'new' ? t.newConfirm : t.quit}
            </button>
          </div>
        }
      >
        <p className="lp-quit-body">{t.quitBody}</p>
      </Modal>

      <Modal open={modal === 'help'} onClose={() => setModal(null)} title={t.howToPlayTitle(name)}>
        <div className="lp-howto">{pick(meta.howToPlay, lang)}</div>
      </Modal>

      <Modal open={modal === 'settings'} onClose={() => setModal(null)} title={t.settings}>
        <SettingsPanel />
      </Modal>

      <Modal open={modal === 'variant'} onClose={() => setModal(null)} title={t.puzzleType}>
        <VariantPicker
          entry={entry}
          current={options}
          onPick={(opts) => confirmNew(() => begin(randomSeed(), opts))}
        />
      </Modal>
    </div>
  );
}

function VariantPicker({ entry, current, onPick }: { entry: GameEntry; current: Record<string, string>; onPick(o: Record<string, string>): void }) {
  const [draft, setDraft] = useState(current);
  const { t, lang } = useCore();
  return (
    <div className="lp-variant">
      {(entry.meta.options ?? []).map((opt) => (
        <div key={opt.id} className="lp-variant-row">
          <span className="lp-variant-label">{pick(opt.label, lang)}</span>
          <Segmented
            label={pick(opt.label, lang)}
            value={draft[opt.id]}
            choices={opt.choices.map((c) => ({
              value: c.value,
              label: pick(c.label, lang),
            }))}
            onChange={(v) => setDraft({ ...draft, [opt.id]: v })}
          />
        </div>
      ))}
      <button className="btn btn-primary btn-block" onClick={() => onPick(draft)}>
        {t.startNewPuzzle}
      </button>
    </div>
  );
}

/** This game's own options (Autocheck, Show mistakes...), as switches right under the board. */
function GameToggles({ gameId, defs }: { gameId: string; defs: GameSettingDef[] }) {
  return (
    <div className="lp-game-toggles">
      {defs.map((d) => (
        <GameToggleChip key={d.key} gameId={gameId} def={d} />
      ))}
    </div>
  );
}

function GameToggleChip({ gameId, def }: { gameId: string; def: GameSettingDef }) {
  const [value, set] = useGameSetting<boolean>(gameId, def.key, def.default);
  const { lang } = useCore();
  const description = def.description === undefined ? undefined : pick(def.description, lang);
  return (
    <button type="button" role="switch" aria-checked={value} className={`lp-gtoggle${value ? ' is-on' : ''}`} onClick={() => set(!value)} title={description}>
      <span className="lp-gtoggle-track" aria-hidden>
        <span className="lp-gtoggle-thumb" />
      </span>
      {pick(def.label, lang)}
    </button>
  );
}

/** App-wide settings (the gear button). A game's own options sit under its board instead. */
export function SettingsPanel() {
  const [settings, update] = useAppSettings();
  const { t } = useCore();
  return (
    <div className="lp-settings">
      <section>
        <h3 className="lp-settings-heading">{t.general}</h3>
        <div className="lp-toggle-row">
          <span className="lp-toggle-text">
            <span className="lp-toggle-label">{t.language}</span>
          </span>
          <Segmented
            label={t.language}
            value={settings.language}
            onChange={(language) => update({ language })}
            choices={[
              { value: 'auto', label: t.languageAuto },
              { value: 'en', label: 'English' },
              { value: 'es', label: 'Español' },
            ]}
          />
        </div>
        <div className="lp-toggle-row">
          <span className="lp-toggle-text">
            <span className="lp-toggle-label">{t.theme}</span>
          </span>
          <Segmented
            label={t.theme}
            value={settings.theme}
            onChange={(theme) => update({ theme })}
            choices={[
              { value: 'system', label: t.themeAuto },
              { value: 'light', label: t.themeLight },
              { value: 'dark', label: t.themeDark },
            ]}
          />
        </div>
        <Toggle checked={settings.showTimer} onChange={(showTimer) => update({ showTimer })} label={t.showTimer} description={t.showTimerDesc} />
        <Toggle checked={settings.autoPause} onChange={(autoPause) => update({ autoPause })} label={t.autoPause} description={t.autoPauseDesc} />
        <Toggle checked={settings.skipIntro} onChange={(skipIntro) => update({ skipIntro })} label={t.quickReplay} description={t.quickReplayDesc} />
      </section>
    </div>
  );
}
