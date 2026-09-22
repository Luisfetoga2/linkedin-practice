import { useEffect, useState } from 'react';

type Listener = (msg: { id: number; text: string; ms: number }) => void;
const listeners = new Set<Listener>();
let nextId = 1;

/** Show a short dark toast at the top of the board area (e.g. "Not in word list"). */
export function toast(text: string, ms = 1800): void {
  const msg = { id: nextId++, text, ms };
  listeners.forEach((fn) => fn(msg));
}

export function ToastHost() {
  const [items, setItems] = useState<{ id: number; text: string }[]>([]);
  useEffect(() => {
    const fn: Listener = (m) => {
      setItems((cur) => [...cur.slice(-2), m]);
      setTimeout(() => setItems((cur) => cur.filter((x) => x.id !== m.id)), m.ms);
    };
    listeners.add(fn);
    return () => {
      listeners.delete(fn);
    };
  }, []);
  return (
    <div className="lp-toasts" aria-live="polite">
      {items.map((t) => (
        <div key={t.id} className="lp-toast">
          {t.text}
        </div>
      ))}
    </div>
  );
}
