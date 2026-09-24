import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './styles/global.css';
import './styles/core.css';
import './styles/pages.css';
import { App } from './App';
import { reloadForNewBuild } from './lib/chunks';

// A chunk from an older deploy is gone: reload into the new build instead of failing.
window.addEventListener('vite:preloadError', (e) => {
  if (reloadForNewBuild()) e.preventDefault();
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
