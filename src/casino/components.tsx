import { useEffect, useState } from 'react';
import { LOCALE, type Lang } from '../lib/i18n';
import { CS } from './i18n';
import { clampBet, formatMoney, MAX_BET, MIN_BET } from './wallet';

/**
 * The bet box every casino game uses: a dollar amount with ½ and 2× buttons. Typing is free-form;
 * the value is clamped to $1–$1,000,000 (cents allowed) when you leave the field.
 */
export function BetInput({ value, onChange, disabled, lang }: { value: number; onChange(v: number): void; disabled?: boolean; lang: Lang }) {
  const t = CS[lang];
  // Shown with grouping ("1,000,000") while not editing; plain digits while typing.
  const pretty = (v: number) => v.toLocaleString(LOCALE[lang], { maximumFractionDigits: 2 });
  const [text, setText] = useState(() => pretty(value));
  const [editing, setEditing] = useState(false);
  useEffect(() => {
    if (!editing) setText(pretty(value));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, lang, editing]);
  const commit = (raw: string) => {
    const n = Number(raw.replace(/[^\d.]/g, ''));
    setEditing(false);
    // Nothing usable typed (empty, "abc", 0): keep the bet you had.
    if (!Number.isFinite(n) || n <= 0) {
      setText(pretty(value));
      return;
    }
    const v = clampBet(n);
    onChange(v);
    setText(pretty(v));
  };
  return (
    <div className={`cs-bet${disabled ? ' is-disabled' : ''}`}>
      <label className="cs-bet-field">
        <span className="cs-bet-label">{t.bet}</span>
        <span className="cs-bet-input">
          <span aria-hidden>$</span>
          <input
            type="text"
            inputMode="decimal"
            value={text}
            disabled={disabled}
            aria-label={t.betAmount}
            onFocus={(e) => {
              setEditing(true);
              setText(String(value));
              // Select the whole amount once it re-renders, so typing replaces it.
              const el = e.currentTarget;
              requestAnimationFrame(() => el.select());
            }}
            onChange={(e) => setText(e.target.value)}
            onBlur={(e) => commit(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
            }}
          />
        </span>
      </label>
      <button type="button" className="cs-bet-step" disabled={disabled || value <= MIN_BET} onClick={() => onChange(clampBet(value / 2))} aria-label={t.halve}>
        ½
      </button>
      <button type="button" className="cs-bet-step" disabled={disabled || value >= MAX_BET} onClick={() => onChange(clampBet(value * 2))} aria-label={t.doubleBet}>
        2×
      </button>
    </div>
  );
}

/** Colored money amount: green for gains, red for losses. */
export function Money({ value, lang, sign = true }: { value: number; lang: Lang; sign?: boolean }) {
  return <span className={`cs-money${value > 0 ? ' is-up' : value < 0 ? ' is-down' : ''}`}>{formatMoney(value, lang, sign)}</span>;
}

/** The end-of-round banner: "You won $200", "You lost $100" or "Push". */
export function RoundResult({ stake, payout, lang, detail }: { stake: number; payout: number; lang: Lang; detail?: string }) {
  const t = CS[lang];
  const profit = Math.round((payout - stake) * 100) / 100;
  const kind = profit > 0 ? 'win' : profit < 0 ? 'loss' : 'push';
  return (
    <div className={`cs-result cs-result-${kind}`} role="status">
      <strong>{kind === 'win' ? t.youWon(formatMoney(profit, lang)) : kind === 'loss' ? t.youLost(formatMoney(-profit, lang)) : t.push}</strong>
      {detail && <span>{detail}</span>}
    </div>
  );
}
