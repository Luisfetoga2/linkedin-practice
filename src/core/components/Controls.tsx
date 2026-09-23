import type { ReactNode } from 'react';
import { useCore } from '../../i18n/core';

/** Row of pill buttons under a board (Undo / Hint / Clear), LinkedIn style. */
export function ControlBar({ children }: { children: ReactNode }) {
  return <div className="lp-controls">{children}</div>;
}

interface ControlButtonProps {
  icon?: ReactNode;
  label: string;
  onClick(): void;
  disabled?: boolean;
  /** Toggle buttons (e.g. notes mode) */
  active?: boolean;
  /** Small counter badge, e.g. remaining notes */
  badge?: ReactNode;
}

export function ControlButton({ icon, label, onClick, disabled, active, badge }: ControlButtonProps) {
  return (
    <button
      type="button"
      className={`lp-control${active ? ' is-active' : ''}`}
      onClick={onClick}
      disabled={disabled}
      aria-pressed={active === undefined ? undefined : active}
    >
      {icon}
      <span>{label}</span>
      {badge != null && <span className="lp-control-badge">{badge}</span>}
    </button>
  );
}

/** Speech-bubble style hint message shown near the board. */
export function HintBubble({ children, onDismiss }: { children: ReactNode; onDismiss?(): void }) {
  const { t } = useCore();
  return (
    <div className="lp-hint" role="status">
      <span className="lp-hint-icon" aria-hidden>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <path d="M9 18h6M10 21h4" />
          <path d="M12 3a6 6 0 00-3.6 10.8c.6.5 1.1 1.3 1.1 2.2h5c0-.9.5-1.7 1.1-2.2A6 6 0 0012 3z" />
        </svg>
      </span>
      <div className="lp-hint-text">{children}</div>
      {onDismiss && (
        <button className="lp-hint-close" onClick={onDismiss} aria-label={t.dismissHint}>
          ×
        </button>
      )}
    </div>
  );
}

export function Segmented<T extends string>({
  value,
  onChange,
  choices,
  label,
  tone = 'default',
}: {
  value: T;
  onChange(v: T): void;
  choices: { value: T; label: string }[];
  label?: string;
  tone?: 'default' | 'onColor';
}) {
  return (
    <div className={`lp-seg lp-seg-${tone}`} role="radiogroup" aria-label={label}>
      {choices.map((c) => (
        <button
          key={c.value}
          type="button"
          role="radio"
          aria-checked={c.value === value}
          className={c.value === value ? 'is-on' : ''}
          onClick={() => onChange(c.value)}
        >
          {c.label}
        </button>
      ))}
    </div>
  );
}

export function Toggle({ checked, onChange, label, description }: { checked: boolean; onChange(v: boolean): void; label: string; description?: string }) {
  return (
    <label className="lp-toggle-row">
      <span className="lp-toggle-text">
        <span className="lp-toggle-label">{label}</span>
        {description && <span className="lp-toggle-desc">{description}</span>}
      </span>
      <input type="checkbox" className="lp-toggle" checked={checked} onChange={(e) => onChange(e.target.checked)} />
    </label>
  );
}
