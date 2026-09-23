import { useEffect } from 'react';
import { useStoredState } from './storage';

export type Theme = 'system' | 'light' | 'dark';
export type LanguagePref = 'auto' | 'en' | 'es';

export interface AppSettings {
  theme: Theme;
  showTimer: boolean;
  /** Pause the clock automatically when the tab is hidden. */
  autoPause: boolean;
  /** Skip the intro card when pressing "Play again". */
  skipIntro: boolean;
  /** Interface language; 'auto' follows the browser. */
  language: LanguagePref;
}

export const defaultSettings: AppSettings = {
  theme: 'system',
  showTimer: true,
  autoPause: true,
  skipIntro: true,
  language: 'auto',
};

export function useAppSettings(): [AppSettings, (patch: Partial<AppSettings>) => void] {
  const [stored, set] = useStoredState<Partial<AppSettings>>('settings', {});
  const settings = { ...defaultSettings, ...stored };
  return [settings, (patch) => set({ ...stored, ...patch })];
}

export function useApplyTheme(theme: Theme): void {
  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'system') delete root.dataset.theme;
    else root.dataset.theme = theme;
    try {
      localStorage.setItem('lp:v1:theme', JSON.stringify(theme));
    } catch {
      // ignore
    }
  }, [theme]);
}

/**
 * Per-game boolean/string setting (e.g. Queens "auto-place X").
 * Declared in the game's meta `settings` so the shell can render the toggle.
 */
export function useGameSetting<T extends boolean | string>(gameId: string, key: string, fallback: T): [T, (v: T) => void] {
  const [stored, set] = useStoredState<Record<string, boolean | string>>(`game-settings:${gameId}`, {});
  const value = (key in stored ? stored[key] : fallback) as T;
  return [value, (v) => set({ ...stored, [key]: v })];
}
