import { useEffect, useId, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Close } from './Icons';

interface Props {
  open: boolean;
  onClose(): void;
  title?: ReactNode;
  children: ReactNode;
  /** Footer area (buttons). */
  footer?: ReactNode;
  wide?: boolean;
}

/** Centered dialog on desktop, bottom sheet on phones. */
export function Modal({ open, onClose, title, children, footer, wide }: Props) {
  const id = useId();
  const panel = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement as HTMLElement | null;
    panel.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        closeRef.current();
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => {
      window.removeEventListener('keydown', onKey, true);
      prev?.focus?.();
    };
  }, [open]);

  if (!open) return null;
  return createPortal(
    <div className="lp-modal-backdrop" onPointerDown={(e) => e.target === e.currentTarget && onClose()}>
      <div
        ref={panel}
        className={`lp-modal${wide ? ' lp-modal-wide' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? id : undefined}
        tabIndex={-1}
      >
        <div className="lp-modal-head">
          {title ? (
            <h2 id={id} className="lp-modal-title">
              {title}
            </h2>
          ) : (
            <span />
          )}
          <button className="icon-btn" onClick={onClose} aria-label="Close">
            <Close size={22} />
          </button>
        </div>
        <div className="lp-modal-body">{children}</div>
        {footer && <div className="lp-modal-foot">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}
