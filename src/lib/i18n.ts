import { useEffect } from 'react';
import { useAppSettings, type LanguagePref } from './settings';

/** Supported interface languages. 'es' is Latin American Spanish (es-419). */
export type Lang = 'en' | 'es';
export const LANGS: Lang[] = ['en', 'es'];

/** BCP 47 locale used for dates and numbers. */
export const LOCALE: Record<Lang, string> = { en: 'en-US', es: 'es-419' };

export function resolveLang(pref: LanguagePref): Lang {
  if (pref === 'en' || pref === 'es') return pref;
  const nav = typeof navigator !== 'undefined' ? navigator.languages?.[0] ?? navigator.language : 'en';
  return nav?.toLowerCase().startsWith('es') ? 'es' : 'en';
}

export function useLang(): Lang {
  const [settings] = useAppSettings();
  return resolveLang(settings.language);
}

/** Keep <html lang> in sync so screen readers and hyphenation use the right language. */
export function useApplyLang(lang: Lang): void {
  useEffect(() => {
    document.documentElement.lang = lang === 'es' ? 'es-419' : 'en';
  }, [lang]);
}

/** A value given per language; plain values are language-neutral. */
export type Localized<T> = T | { en: T; es: T };

function isLocalized<T>(v: Localized<T>): v is { en: T; es: T } {
  return typeof v === 'object' && v !== null && 'en' in (v as object) && 'es' in (v as object) && !('$$typeof' in (v as object));
}

export function pick<T>(v: Localized<T>, lang: Lang): T {
  return isLocalized(v) ? v[lang] : v;
}

/**
 * Per-module string tables. Spanish must provide exactly the same keys (and function signatures)
 * as English, so a missing translation is a type error.
 */
export function defineStrings<T extends Record<string, unknown>>(en: T, es: NoInfer<T>): Record<Lang, T> {
  return { en, es };
}

/** "1 hint" / "2 hints" helper: pass the singular and plural forms. */
export function plural(n: number, one: string, many: string): string {
  return n === 1 ? one : many;
}

export function formatDate(ts: number | Date, lang: Lang, opts: Intl.DateTimeFormatOptions): string {
  return new Date(ts).toLocaleDateString(LOCALE[lang], opts);
}

export function formatClock(ts: number | Date, lang: Lang): string {
  return new Date(ts).toLocaleTimeString(LOCALE[lang], { hour: 'numeric', minute: '2-digit' });
}
