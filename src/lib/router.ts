import { useSyncExternalStore } from 'react';

export interface Route {
  /** Path segments after "#/", e.g. ["queens"] or ["stats", "zip"]. */
  parts: string[];
  params: URLSearchParams;
}

function parse(): Route {
  const hash = window.location.hash.replace(/^#\/?/, '');
  const [path, query = ''] = hash.split('?');
  return { parts: path.split('/').filter(Boolean), params: new URLSearchParams(query) };
}

let current = parse();
const subs = new Set<() => void>();
window.addEventListener('hashchange', () => {
  current = parse();
  subs.forEach((fn) => fn());
});

export function useRoute(): Route {
  return useSyncExternalStore(
    (fn) => {
      subs.add(fn);
      return () => subs.delete(fn);
    },
    () => current,
  );
}

export function href(path: string, params?: Record<string, string | number | undefined>): string {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params ?? {})) if (v !== undefined && v !== '') q.set(k, String(v));
  const qs = q.toString();
  return `#/${path.replace(/^\//, '')}${qs ? `?${qs}` : ''}`;
}

export function navigate(path: string, params?: Record<string, string | number | undefined>, replace = false): void {
  const target = href(path, params);
  if (replace) {
    history.replaceState(null, '', target);
    current = parse();
    subs.forEach((fn) => fn());
  } else {
    window.location.hash = target;
  }
}
