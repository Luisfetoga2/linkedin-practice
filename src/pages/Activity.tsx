import { useMemo, useState } from 'react';
import { addDays, dayKey } from '../lib/time';
import { formatDate } from '../lib/i18n';
import { useCore } from '../i18n/core';

function level(n: number): number {
  if (n === 0) return 0;
  if (n === 1) return 1;
  if (n <= 3) return 2;
  if (n <= 6) return 3;
  return 4;
}

/** GitHub-style calendar of wins per day, single-hue sequential scale. */
export function ActivityHeatmap({ days, weeks = 17 }: { days: Map<string, number>; weeks?: number }) {
  const [hover, setHover] = useState<{ key: string; n: number; x: number; y: number } | null>(null);
  const { t, lang } = useCore();
  const cols = useMemo(() => {
    const today = dayKey();
    const d = new Date();
    // Columns end on the current week; rows are Sun..Sat.
    const end = addDays(today, 6 - d.getDay());
    const start = addDays(end, -(weeks * 7 - 1));
    const out: { key: string; n: number; future: boolean }[][] = [];
    let cursor = start;
    for (let w = 0; w < weeks; w++) {
      const col = [];
      for (let r = 0; r < 7; r++) {
        col.push({ key: cursor, n: days.get(cursor) ?? 0, future: cursor > today });
        cursor = addDays(cursor, 1);
      }
      out.push(col);
    }
    return out;
  }, [days, weeks]);

  const cell = 13;
  const gap = 3;
  const width = weeks * (cell + gap) - gap;
  const height = 7 * (cell + gap) - gap;

  return (
    <div className="heatmap">
      <div className="heatmap-scroll">
        <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} role="img" aria-label={t.solvesPerDay}>
          {cols.map((col, w) =>
            col.map((c, r) =>
              c.future ? null : (
                <rect
                  key={c.key}
                  x={w * (cell + gap)}
                  y={r * (cell + gap)}
                  width={cell}
                  height={cell}
                  rx={3}
                  className={`heat-${level(c.n)}`}
                  onPointerEnter={() => setHover({ key: c.key, n: c.n, x: w * (cell + gap) + cell / 2, y: r * (cell + gap) })}
                  onPointerLeave={() => setHover(null)}
                />
              ),
            ),
          )}
        </svg>
        {hover && (
          <div className="chart-tip" style={{ left: hover.x, top: hover.y }}>
            <strong>{hover.n === 0 ? t.noSolves : t.nSolved(hover.n)}</strong>
            <span>{formatDate(new Date(hover.key + 'T12:00'), lang, { weekday: 'short', month: 'short', day: 'numeric' })}</span>
          </div>
        )}
      </div>
      <div className="heatmap-legend" aria-hidden>
        <span>{t.less}</span>
        {[0, 1, 2, 3, 4].map((l) => (
          <svg key={l} width="11" height="11">
            <rect width="11" height="11" rx="2" className={`heat-${l}`} />
          </svg>
        ))}
        <span>{t.more}</span>
      </div>
    </div>
  );
}
