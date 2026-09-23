import { useEffect, useState } from 'react';
import type { Stopwatch } from '../stopwatch';
import { formatTime } from '../../lib/time';
import { Clock, Pause, Play } from './Icons';
import { useCore } from '../../i18n/core';

/** Re-renders only itself a few times per second, so the board never re-renders for the clock. */
export function Timer({ watch, paused, hidden, onToggle, disabled }: { watch: Stopwatch; paused: boolean; hidden?: boolean; onToggle(): void; disabled?: boolean }) {
  const [, setTick] = useState(0);
  const { t } = useCore();
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 250);
    return () => clearInterval(id);
  }, []);
  return (
    <button
      type="button"
      className="lp-timer"
      onClick={onToggle}
      disabled={disabled}
      aria-label={paused ? t.resumeTimer : t.pauseTimer}
      title={paused ? t.resume : t.pause}
    >
      <Clock size={16} />
      <span className="lp-timer-value">{hidden ? '–:––' : formatTime(watch.ms)}</span>
      {!disabled && (paused ? <Play size={12} /> : <Pause size={14} />)}
    </button>
  );
}
