import { useEffect } from 'react';
import { useRoute } from './lib/router';
import { useAppSettings, useApplyTheme } from './lib/settings';
import { pick, resolveLang, useApplyLang } from './lib/i18n';
import { CORE } from './i18n/core';
import { findGame } from './games/registry';
import { GameShell } from './core/GameShell';
import { ToastHost } from './core/components/Toast';
import { Home } from './pages/Home';
import { StatsPage } from './pages/Stats';

export function App() {
  const route = useRoute();
  const [settings] = useAppSettings();
  useApplyTheme(settings.theme);
  const lang = resolveLang(settings.language);
  useApplyLang(lang);
  const t = CORE[lang];
  const [first, second] = route.parts;
  const game = findGame(first);

  useEffect(() => {
    window.scrollTo(0, 0);
    document.title = game ? `${pick(game.meta.name, lang)} · ${t.brand}` : first === 'stats' ? `${t.statsTitle} · ${t.brand}` : t.brand;
  }, [first, game, lang, t]);

  return (
    <>
      {game ? <GameShell key={game.meta.id} entry={game} /> : first === 'stats' ? <StatsPage gameId={second} /> : <Home />}
      <ToastHost />
    </>
  );
}
