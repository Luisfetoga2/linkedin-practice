import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

const MARGIN = 8;

/**
 * Chart tooltip rendered on top of the page (not inside the chart), so a scrolling or clipped
 * container can't cut it off. It sits above `anchor`, flips below near the top of the screen,
 * and stays inside the viewport horizontally.
 */
export function ChartTip({ anchor, children }: { anchor: Element; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);

  useLayoutEffect(() => {
    const place = () => {
      const el = ref.current;
      if (!el) return;
      const a = anchor.getBoundingClientRect();
      const w = el.offsetWidth;
      const h = el.offsetHeight;
      const vw = document.documentElement.clientWidth;
      const left = Math.max(MARGIN, Math.min(vw - MARGIN - w, a.left + a.width / 2 - w / 2));
      let top = a.top - h - MARGIN;
      if (top < MARGIN) top = a.bottom + MARGIN;
      setPos({ left, top });
    };
    place();
    // Follow the anchor if the page or the heatmap scrolls while hovering.
    window.addEventListener('scroll', place, true);
    window.addEventListener('resize', place);
    return () => {
      window.removeEventListener('scroll', place, true);
      window.removeEventListener('resize', place);
    };
  }, [anchor, children]);

  return createPortal(
    <div ref={ref} className="chart-tip chart-tip-fixed" style={pos ? { left: pos.left, top: pos.top } : { left: 0, top: 0, visibility: 'hidden' }}>
      {children}
    </div>,
    document.body,
  );
}
