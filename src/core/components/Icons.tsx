import type { SVGProps } from 'react';

type P = SVGProps<SVGSVGElement> & { size?: number };

function base({ size = 24, ...rest }: P) {
  return {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 2,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true,
    ...rest,
  };
}

export const ArrowLeft = (p: P) => (
  <svg {...base(p)}>
    <path d="M20 12H4M10 6l-6 6 6 6" />
  </svg>
);
export const Undo = (p: P) => (
  <svg {...base(p)}>
    <path d="M9 14L4 9l5-5" />
    <path d="M4 9h10.5a5.5 5.5 0 010 11H11" />
  </svg>
);
export const Bulb = (p: P) => (
  <svg {...base(p)}>
    <path d="M9 18h6M10 21h4" />
    <path d="M12 3a6 6 0 00-3.6 10.8c.6.5 1.1 1.3 1.1 2.2h5c0-.9.5-1.7 1.1-2.2A6 6 0 0012 3z" />
  </svg>
);
export const Eraser = (p: P) => (
  <svg {...base(p)}>
    <path d="M20 20H9L4.5 15.5a2 2 0 010-2.8l9-9a2 2 0 012.8 0l4.2 4.2a2 2 0 010 2.8L13 18" />
    <path d="M9 9l6 6" />
  </svg>
);
export const Reset = (p: P) => (
  <svg {...base(p)}>
    <path d="M3 12a9 9 0 109-9 9.7 9.7 0 00-6.7 2.8L3 8" />
    <path d="M3 3v5h5" />
  </svg>
);
export const Pencil = (p: P) => (
  <svg {...base(p)}>
    <path d="M17 3l4 4L8 20H4v-4L17 3z" />
  </svg>
);
export const Gear = (p: P) => (
  <svg {...base(p)}>
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.7 1.7 0 00.3 1.8l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.7 1.7 0 00-1.8-.3 1.7 1.7 0 00-1 1.5V21a2 2 0 01-4 0v-.1a1.7 1.7 0 00-1.1-1.5 1.7 1.7 0 00-1.8.3l-.1.1a2 2 0 11-2.8-2.8l.1-.1a1.7 1.7 0 00.3-1.8 1.7 1.7 0 00-1.5-1H3a2 2 0 010-4h.1a1.7 1.7 0 001.5-1.1 1.7 1.7 0 00-.3-1.8l-.1-.1a2 2 0 112.8-2.8l.1.1a1.7 1.7 0 001.8.3H9a1.7 1.7 0 001-1.5V3a2 2 0 014 0v.1a1.7 1.7 0 001 1.5 1.7 1.7 0 001.8-.3l.1-.1a2 2 0 112.8 2.8l-.1.1a1.7 1.7 0 00-.3 1.8V9a1.7 1.7 0 001.5 1H21a2 2 0 010 4h-.1a1.7 1.7 0 00-1.5 1z" />
  </svg>
);
export const Help = (p: P) => (
  <svg {...base(p)}>
    <circle cx="12" cy="12" r="10" />
    <path d="M9.1 9a3 3 0 015.8 1c0 2-3 3-3 3M12 17h.01" />
  </svg>
);
export const Chart = (p: P) => (
  <svg {...base(p)}>
    <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />
  </svg>
);
export const Pause = (p: P) => (
  <svg {...base(p)}>
    <path d="M9 5v14M15 5v14" />
  </svg>
);
export const Play = (p: P) => (
  <svg {...base(p)}>
    <path d="M7 4l13 8-13 8V4z" fill="currentColor" />
  </svg>
);
export const Share = (p: P) => (
  <svg {...base(p)}>
    <path d="M4 12v7a2 2 0 002 2h12a2 2 0 002-2v-7M16 6l-4-4-4 4M12 2v14" />
  </svg>
);
export const Close = (p: P) => (
  <svg {...base(p)}>
    <path d="M18 6L6 18M6 6l12 12" />
  </svg>
);
export const Clock = (p: P) => (
  <svg {...base(p)}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v5l3 2" />
  </svg>
);
export const Check = (p: P) => (
  <svg {...base(p)}>
    <path d="M5 12l5 5L20 7" />
  </svg>
);
export const Flame = ({ size = 24, ...rest }: P) => (
  <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden {...rest}>
    <path
      d="M12 2c.5 3.4-1.4 5-3 6.8C7.4 10.6 6 12.4 6 15a6 6 0 0012 0c0-2.3-1-4-2.2-5.4-.2 1.4-.9 2.5-2 3 .6-3.5-.2-7.7-1.8-10.6z"
      fill="currentColor"
    />
  </svg>
);
export const Trophy = (p: P) => (
  <svg {...base(p)}>
    <path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 01-10 0V4zM17 5h3v2a3 3 0 01-3 3M7 5H4v2a3 3 0 003 3" />
  </svg>
);
export const Shuffle = (p: P) => (
  <svg {...base(p)}>
    <path d="M16 3h5v5M4 20L21 3M21 16v5h-5M15 15l6 6M4 4l5 5" />
  </svg>
);
export const Backspace = (p: P) => (
  <svg {...base(p)}>
    <path d="M21 5H9l-6 7 6 7h12a1 1 0 001-1V6a1 1 0 00-1-1zM17 9l-6 6M11 9l6 6" />
  </svg>
);
