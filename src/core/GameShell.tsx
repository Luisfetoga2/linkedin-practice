import { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState, type ComponentType } from 'react';
import type { GameEntry, GameProps, GameResult } from './types';
import { Stopwatch } from './stopwatch';
import { Timer } from './components/Timer';
import { ArrowLeft, Chart, Gear, Help, Play, Shuffle } from './components/Icons';
import { Modal } from './components/Modal';
import { Segmented, Toggle } from './components/Controls';
import { ResultSheet, type FinishedRound } from './ResultSheet';
import { href, navigate, useRoute } from '../lib/router';
import { codeToSeed, randomSeed, seedToCode } from '../lib/rng';
import { addRecord, computeStats, loadHistory, useHistory, variantKey } from '../lib/stats';
import { formatTime } from '../lib/time';
import { useAppSettings, useGameSetting } from '../lib/settings';
import { readJSON, writeJSON } from '../lib/storage';

type Phase = 'intro' | 'playing' | 'done';

function defaultOptions(entry: GameEntry, params: URLSearchParams): Record<string, string> {
  const saved = readJSON<Record<string, string>>(`last-options:${entry.meta.id}`, {});
  const out: Record<string, string> = {};
  for (const opt of entry.meta.options ?? []) {
    const fromUrl = params.get(opt.id);
    const valid = (v: string | null | undefined) => !!v && opt.choices.some((c) => c.value === v);
    out[opt.id] = valid(fromUrl) ? fromUrl! : valid(saved[opt.id]) ? saved[opt.id] : opt.default;
  }
  return out;
}

export function GameShell({ entry }: { entry: GameEntry }) {
  const { meta } = entry;
  const route = useRoute();
  const [settings] = useAppSettings();
  const Game = useMemo(() => lazy(entry.load) as unknown as ComponentType<GameProps>, [entry]);

  const [options, setOptions] = useState(() => defaultOptions(entry, route.params));
  const [seed, setSeed] = useState<number>(() => codeToSeed(route.params.get('s')) ?? randomSeed());
  const [phase, setPhase] = useState<Phase>('intro');
  const [round, setRound] = useState(0);
  const [ready, setReady] = useState(false);
  const [paused, setPaused] = useState(false);
  const [finished, setFinished] = useState<FinishedRound | null>(null);
  const [showResult, setShowResult] = useState(false);
  const [modal, setModal] = useState<null | 'help' | 'settings' | 'variant'>(null);
  const watch = useRef(new Stopwatch()).current;
  const hints = useRef(0);
  const completed = useRef(false);
  const history = useHistory(meta.id);
  const variant = variantKey(options);
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

  const syncUrl = useCallback(
    (s: number, opts: Record<string, string>) => navigate(meta.id, { s: seedToCode(s), ...opts }, true),
    [meta.id],
  );

  const begin = useCallback(
    (nextSeed: number, opts: Record<string, string>) => {
      watch.reset();
      hints.current = 0;
      completed.current = false;
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
      setFinished({ result, ms, hints: hints.current, isBest, priorAvgMs: prior.avgMs, seed, options });
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
    .map((o) => o.choices.find((c) => c.value === options[o.id])?.label)
    .filter(Boolean)
    .join(' · ');

  const style = { '--game-color': meta.color, '--game-color-end': meta.colorEnd, '--game-tint': meta.tint } as React.CSSProperties;

  return (
    <div className="lp-shell" style={style}>
      <header className="lp-topbar">
        <div className="lp-topbar-inner">
          <a className="icon-btn" href={href('')} aria-label="Back to games">
            <ArrowLeft size={22} />
          </a>
          <div className="lp-topbar-title">
            <span className="lp-topbar-badge" aria-hidden>
              <meta.Icon size={20} />
            </span>
            <h1>{meta.name}</h1>
          </div>
          <div className="lp-topbar-actions">
            <button className="icon-btn" onClick={() => setModal('help')} aria-label="How to play" title="How to play">
              <Help size={22} />
            </button>
            <a className="icon-btn" href={href(`stats/${meta.id}`)} aria-label="Statistics" title="Statistics">
              <Chart size={22} />
            </a>
            <button className="icon-btn" onClick={() => setModal('settings')} aria-label="Settings" title="Settings">
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
            <h2 className="lp-intro-name">{meta.name}</h2>
            <p className="lp-intro-tagline">{meta.tagline}</p>
            <p className="lp-intro-code">PRACTICE #{seedToCode(seed)}</p>
            {(meta.options ?? []).map((opt) => (
              <div key={opt.id} className="lp-intro-option">
                <span className="lp-intro-option-label">{opt.label}</span>
                <Segmented
                  tone="onColor"
                  label={opt.label}
                  value={options[opt.id]}
                  choices={opt.choices}
                  onChange={(v) => setOptions({ ...options, [opt.id]: v })}
                />
              </div>
            ))}
            <button className="lp-intro-start" onClick={() => begin(seed, options)}>
              Start game
            </button>
            <div className="lp-intro-stats">
              {stats.streak.current > 0 && <span>🔥 {stats.streak.current}-day streak</span>}
              {stats.bestMs !== null && <span>Best {formatTime(stats.bestMs)}</span>}
              {meta.scoring === 'guesses' && stats.played > 0 && <span>{Math.round(stats.winRate * 100)}% wins</span>}
              <span>{stats.wins} solved</span>
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
                <button className="lp-timer" onClick={togglePause} aria-label={paused ? 'Resume' : 'Pause'}>
                  {paused ? 'Resume' : 'Pause'}
                </button>
              )}
              <div className="lp-play-bar-right">
                {meta.options?.length ? (
                  <button className="lp-chip" onClick={() => setModal('variant')} title="Change puzzle type">
                    {optionLabel}
                  </button>
                ) : null}
                <button className="lp-chip" onClick={() => newRound()} title="Skip to a new puzzle">
                  <Shuffle size={14} /> New
                </button>
              </div>
            </div>

            <div className={`lp-board-area${paused ? ' is-paused' : ''}`}>
              <Suspense fallback={<div className="lp-loading">Loading…</div>}>
                <Game
                  key={round}
                  seed={seed}
                  options={options}
                  paused={paused || phase === 'done'}
                  onReady={onReady}
                  onHint={onHint}
                  onComplete={onComplete}
                />
              </Suspense>
              {paused && (
                <div className="lp-paused">
                  <p className="lp-paused-title">Paused</p>
                  <button className="btn btn-primary" onClick={togglePause}>
                    <Play size={16} /> Resume
                  </button>
                </div>
              )}
            </div>

            {phase === 'done' && finished && !showResult && (
              <div className="lp-done-bar">
                <span>
                  {finished.result.won ? 'Solved' : 'Finished'} in <strong>{formatTime(finished.ms)}</strong>
                </span>
                <div className="lp-done-actions">
                  <button className="btn btn-secondary btn-sm" onClick={() => setShowResult(true)}>
                    Results
                  </button>
                  <button className="btn btn-primary btn-sm" onClick={() => newRound()}>
                    Play again
                  </button>
                </div>
              </div>
            )}
            <p className="lp-play-code">
              Practice #{seedToCode(seed)} · <a href={`${href(meta.id, { s: seedToCode(seed), ...options })}`}>link to this puzzle</a>
            </p>
          </div>
        </main>
      )}

      {finished && (
        <ResultSheet
          open={showResult}
          meta={meta}
          round={finished}
          onClose={() => setShowResult(false)}
          onPlayAgain={() => newRound()}
        />
      )}

      <Modal open={modal === 'help'} onClose={() => setModal(null)} title={`How to play ${meta.name}`}>
        <div className="lp-howto">{meta.howToPlay}</div>
      </Modal>

      <Modal open={modal === 'settings'} onClose={() => setModal(null)} title="Settings">
        <SettingsPanel gameId={meta.id} defs={meta.settings ?? []} />
      </Modal>

      <Modal open={modal === 'variant'} onClose={() => setModal(null)} title="Puzzle type">
        <VariantPicker
          entry={entry}
          current={options}
          onPick={(opts) => {
            setModal(null);
            begin(randomSeed(), opts);
          }}
        />
      </Modal>
    </div>
  );
}

function VariantPicker({ entry, current, onPick }: { entry: GameEntry; current: Record<string, string>; onPick(o: Record<string, string>): void }) {
  const [draft, setDraft] = useState(current);
  return (
    <div className="lp-variant">
      {(entry.meta.options ?? []).map((opt) => (
        <div key={opt.id} className="lp-variant-row">
          <span className="lp-variant-label">{opt.label}</span>
          <Segmented label={opt.label} value={draft[opt.id]} choices={opt.choices} onChange={(v) => setDraft({ ...draft, [opt.id]: v })} />
        </div>
      ))}
      <button className="btn btn-primary btn-block" onClick={() => onPick(draft)}>
        Start new puzzle
      </button>
    </div>
  );
}

function GameSettingToggle({ gameId, def }: { gameId: string; def: { key: string; label: string; description?: string; default: boolean } }) {
  const [value, set] = useGameSetting<boolean>(gameId, def.key, def.default);
  return <Toggle checked={value} onChange={set} label={def.label} description={def.description} />;
}

export function SettingsPanel({ gameId, defs }: { gameId?: string; defs: { key: string; label: string; description?: string; default: boolean }[] }) {
  const [settings, update] = useAppSettings();
  return (
    <div className="lp-settings">
      {gameId && defs.length > 0 && (
        <section>
          <h3 className="lp-settings-heading">This game</h3>
          {defs.map((d) => (
            <GameSettingToggle key={d.key} gameId={gameId} def={d} />
          ))}
        </section>
      )}
      <section>
        <h3 className="lp-settings-heading">General</h3>
        <div className="lp-toggle-row">
          <span className="lp-toggle-text">
            <span className="lp-toggle-label">Theme</span>
          </span>
          <Segmented
            label="Theme"
            value={settings.theme}
            onChange={(theme) => update({ theme })}
            choices={[
              { value: 'system', label: 'Auto' },
              { value: 'light', label: 'Light' },
              { value: 'dark', label: 'Dark' },
            ]}
          />
        </div>
        <Toggle checked={settings.showTimer} onChange={(showTimer) => update({ showTimer })} label="Show timer" description="The clock still runs and is saved when hidden." />
        <Toggle checked={settings.autoPause} onChange={(autoPause) => update({ autoPause })} label="Auto-pause" description="Stop the clock when you switch tabs or apps." />
        <Toggle checked={settings.skipIntro} onChange={(skipIntro) => update({ skipIntro })} label="Quick replay" description="“Play again” jumps straight into a new puzzle." />
      </section>
    </div>
  );
}
