const KEY = 'lp:chunk-reload';

/**
 * Each deploy replaces the hashed JS chunks, so a page opened before a deploy can fail to load a
 * game it hasn't opened yet (a blank screen until you reload). Reload once to pick up the new
 * build; returns false if we already tried in the last few seconds, so a real outage can't loop.
 */
export function reloadForNewBuild(): boolean {
  try {
    const last = Number(sessionStorage.getItem(KEY) ?? 0);
    if (Date.now() - last < 15_000) return false;
    sessionStorage.setItem(KEY, String(Date.now()));
  } catch {
    return false;
  }
  window.location.reload();
  return true;
}
