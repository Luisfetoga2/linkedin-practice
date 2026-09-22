/** Queen crown, drawn to sit centered in a square cell. Uses currentColor. */
export function Crown({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden focusable="false">
      <g fill="currentColor" stroke="currentColor" strokeWidth="1.1" strokeLinejoin="round">
        <path d="M3.3 8.9 7.5 12.6 12 6.2l4.5 6.4 4.2-3.7-1.6 8.3H4.9z" />
        <rect x="4.9" y="18.6" width="14.2" height="2.2" rx="0.9" />
      </g>
      <g fill="currentColor">
        <circle cx="3.2" cy="7.8" r="1.65" />
        <circle cx="12" cy="4.5" r="1.75" />
        <circle cx="20.8" cy="7.8" r="1.65" />
      </g>
    </svg>
  );
}

export function Cross({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden focusable="false">
      <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" fill="none" />
    </svg>
  );
}
