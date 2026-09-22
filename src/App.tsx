import { useEffect } from 'react';
import { useRoute } from './lib/router';
import { useAppSettings, useApplyTheme } from './lib/settings';
import { findGame } from './games/registry';
import { GameShell } from './core/GameShell';
import { ToastHost } from './core/components/Toast';
import { Home } from './pages/Home';
import { StatsPage } from './pages/Stats';

export function App() {
  const route = useRoute();
  const [settings] = useAppSettings();
  useApplyTheme(settings.theme);
  const [first, second] = route.parts;
  const game = findGame(first);

  useEffect(() => {
    window.scrollTo(0, 0);
    document.title = game ? `${game.meta.name} · Games Practice` : first === 'stats' ? 'Stats · Games Practice' : 'Games Practice';
  }, [first, game]);

  return (
    <>
      {game ? <GameShell key={game.meta.id} entry={game} /> : first === 'stats' ? <StatsPage gameId={second} /> : <Home />}
      <ToastHost />
    </>
  );
}
