import { useState } from 'react';
import { href } from '../lib/router';
import { Gear } from '../core/components/Icons';
import { Modal } from '../core/components/Modal';
import { SettingsPanel } from '../core/GameShell';

export function BrandMark({ size = 34 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden>
      <rect width="32" height="32" rx="6" fill="var(--brand)" />
      <rect x="7" y="7" width="8" height="8" rx="2" fill="var(--surface)" />
      <rect x="17" y="7" width="8" height="8" rx="2" fill="var(--surface)" opacity=".6" />
      <rect x="7" y="17" width="8" height="8" rx="2" fill="var(--surface)" opacity=".6" />
      <rect x="17" y="17" width="8" height="8" rx="2" fill="var(--surface)" />
    </svg>
  );
}

export function SiteHeader({ active }: { active: 'games' | 'stats' }) {
  const [open, setOpen] = useState(false);
  return (
    <header className="lp-topbar">
      <div className="lp-topbar-inner">
        <a className="site-brand" href={href('')} aria-label="Games Practice home">
          <BrandMark />
          <span className="site-brand-name">Games Practice</span>
        </a>
        <nav className="site-nav" aria-label="Main">
          <a className={`site-nav-item${active === 'games' ? ' is-active' : ''}`} href={href('')} aria-current={active === 'games' ? 'page' : undefined}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
              <path d="M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z" opacity=".9" />
            </svg>
            <span>Games</span>
          </a>
          <a className={`site-nav-item${active === 'stats' ? ' is-active' : ''}`} href={href('stats')} aria-current={active === 'stats' ? 'page' : undefined}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
              <path d="M4 20V11h4v9zM10 20V4h4v16zM16 20v-6h4v6z" />
            </svg>
            <span>Stats</span>
          </a>
          <button className="site-nav-item" onClick={() => setOpen(true)}>
            <Gear size={24} />
            <span>Settings</span>
          </button>
        </nav>
      </div>
      <Modal open={open} onClose={() => setOpen(false)} title="Settings">
        <SettingsPanel defs={[]} />
      </Modal>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <p>
        Unofficial fan-made practice site. Not affiliated with or endorsed by LinkedIn. Game names belong to their owners. Your progress is stored only in
        this browser.
      </p>
    </footer>
  );
}
