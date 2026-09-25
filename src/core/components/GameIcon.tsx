import type { ReactNode } from 'react';

/**
 * Shared frame for the game icons, so every icon has the same outer size (2.5–45.5 in a 48 grid),
 * corner radius and border. The face inside the border spans 5.5–42.5; tiles usually sit 3 in
 * from it (8.5–39.5) with 3 between them, and use a 2.5 radius (concentric with the frame).
 */
export const INK = '#1f1f1f';
export const FONT = "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif";

export function IconFrame({ size = 48, dark, children }: { size?: number; dark?: boolean; children: ReactNode }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden>
      {dark ? <rect x="2.5" y="2.5" width="43" height="43" rx="8.5" fill={INK} /> : <rect x="4" y="4" width="40" height="40" rx="7" fill="#fff" />}
      {children}
      {/* The border goes on top, so nothing inside can poke over it or leave a seam. */}
      {!dark && <rect x="4" y="4" width="40" height="40" rx="7" fill="none" stroke={INK} strokeWidth="3" />}
    </svg>
  );
}

/** Text centered on (x, y), cap height included. */
export function IconText({ x, y, size, fill = INK, children }: { x: number; y: number; size: number; fill?: string; children: ReactNode }) {
  return (
    <text x={x} y={y + size * 0.355} textAnchor="middle" fontSize={size} fontWeight="800" fill={fill} fontFamily={FONT}>
      {children}
    </text>
  );
}

/**
 * A square inside a dark frame. Corners that sit in the frame's corners get the concentric
 * radius (5.5), so the dark border stays the same width all the way around; the rest use `r`.
 */
export function FaceCell({ x, y, w, h, r = 2.5, fill }: { x: number; y: number; w: number; h: number; r?: number; fill: string }) {
  const lo = 5.5;
  const hi = 42.5;
  const e = 0.01;
  const left = x <= lo + e;
  const top = y <= lo + e;
  const right = x + w >= hi - e;
  const bottom = y + h >= hi - e;
  const rad = (edgeA: boolean, edgeB: boolean) => (edgeA && edgeB ? Math.min(5.5, w / 2, h / 2) : r);
  const [tl, tr, br, bl] = [rad(top, left), rad(top, right), rad(bottom, right), rad(bottom, left)];
  const d = [
    `M${x + tl} ${y}`,
    `H${x + w - tr}A${tr} ${tr} 0 0 1 ${x + w} ${y + tr}`,
    `V${y + h - br}A${br} ${br} 0 0 1 ${x + w - br} ${y + h}`,
    `H${x + bl}A${bl} ${bl} 0 0 1 ${x} ${y + h - bl}`,
    `V${y + tl}A${tl} ${tl} 0 0 1 ${x + tl} ${y}Z`,
  ].join('');
  return <path d={d} fill={fill} />;
}
