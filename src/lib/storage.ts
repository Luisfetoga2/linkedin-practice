import { useCallback, useSyncExternalStore } from 'react';

const PREFIX = 'lp:v1:';
const listeners = new Map<string, Set<() => void>>();
const cache = new Map<string, unknown>();

export function readJSON<T>(key: string, fallback: T): T {
  const full = PREFIX + key;
  if (cache.has(full)) return cache.get(full) as T;
  let value = fallback;
  try {
    const raw = localStorage.getItem(full);
    if (raw != null) value = JSON.parse(raw) as T;
  } catch {
    // storage unavailable (private mode) or corrupt: use fallback
  }
  cache.set(full, value);
  return value;
}

export function writeJSON<T>(key: string, value: T): void {
  const full = PREFIX + key;
  cache.set(full, value);
  try {
    localStorage.setItem(full, JSON.stringify(value));
  } catch {
    // quota or disabled storage: keep the in-memory value
  }
  listeners.get(full)?.forEach((fn) => fn());
}

export function removeKey(key: string): void {
  const full = PREFIX + key;
  cache.delete(full);
  try {
    localStorage.removeItem(full);
  } catch {
    // ignore
  }
  listeners.get(full)?.forEach((fn) => fn());
}

export function subscribeKey(key: string, fn: () => void): () => void {
  const full = PREFIX + key;
  let set = listeners.get(full);
  if (!set) listeners.set(full, (set = new Set()));
  set.add(fn);
  return () => set!.delete(fn);
}

/** All keys this app owns (without prefix), for export/import. */
export function allKeys(): string[] {
  const keys: string[] = [];
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k?.startsWith(PREFIX)) keys.push(k.slice(PREFIX.length));
    }
  } catch {
    // ignore
  }
  return keys;
}

/** React state persisted to localStorage and shared across components. */
export function useStoredState<T>(key: string, fallback: T): [T, (value: T) => void] {
  const value = useSyncExternalStore(
    (fn) => subscribeKey(key, fn),
    () => readJSON(key, fallback),
    () => fallback,
  );
  const set = useCallback((v: T) => writeJSON(key, v), [key]);
  return [value, set];
}

if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (!e.key?.startsWith(PREFIX)) return;
    cache.delete(e.key);
    listeners.get(e.key)?.forEach((fn) => fn());
  });
}
