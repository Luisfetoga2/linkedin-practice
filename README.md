# Games Practice

Endless practice rounds of LinkedIn-style daily puzzle games — **Queens, Tango, Zip, Mini Sudoku, Patches, Wend, Crossclimb, Pinpoint** — plus **Wordle** and **Nonogram**.
Every round is freshly generated, with the same hints the originals offer, a timer, and local streaks and statistics. No login; everything is stored in your browser.

Live site: https://luisfetoga2.github.io/linkedin-practice/

> Unofficial fan project for practice. Not affiliated with or endorsed by LinkedIn or The New York Times.

## Features

- Unlimited, seeded puzzles. Every puzzle has a code, so you can replay or share it (`#/queens?s=K3F9A&size=8`).
- LinkedIn-style layout on desktop and mobile, with light and dark themes.
- English and Latin American Spanish interface (Settings → Language). Wordle and Wend also have Spanish word lists.
- The same hints as the originals, plus undo and clear. Hint usage is tracked.
- A timer that pauses automatically when you switch tabs, with a manual pause.
- Per-game and overall daily streaks, win streaks, and best, average, median, and last-10 times.
- A solve-time chart, time and guess distributions, and an activity heatmap.
- Export and import your stats as JSON to move them between devices.

## Development

```bash
npm install
npm run dev        # http://localhost:5173/linkedin-practice/
npm test           # generator and logic tests (vitest)
npm run build      # typecheck + production build into dist/
```

## Architecture

```
src/
  core/        GameShell (intro → play → results), timer, modals, shared controls, types
  lib/         seeded RNG, localStorage store, stats/streaks, hash router, settings
  pages/       Home and Stats
  games/<id>/  meta.tsx (name, colors, rules, options) + Game.tsx (lazy-loaded) + generator/solver
```

- **Hosting**: static build deployed to GitHub Pages by `.github/workflows/deploy.yml` on every push to `main`. Vite's `base` is `/linkedin-practice/`, and routing uses the URL hash, so deep links and refreshes work without a server.
- **Game contract** (`src/core/types.ts`): each game gets `seed` and `options`, and calls `onReady()`, `onHint()`, and `onComplete(result)`. The shell owns the timer, stats, streaks, and results screen, so adding a game means adding a folder and one line in `src/games/registry.ts`.
- **Determinism**: generators use only the seeded RNG, so the same seed always produces the same puzzle.
- **Code splitting**: each game, including its word lists, loads only when you open it.

## Credits

- Wordle word lists are derived from [SCOWL](http://wordlist.aspell.net/) (Kevin Atkinson, MIT-like license).
- Wend word lists are derived from [hermitdave/FrequencyWords](https://github.com/hermitdave/FrequencyWords) (CC BY-SA 4.0), filtered against the public-domain Webster's 2nd dictionary (`/usr/share/dict/words`).
- Spanish word lists (Wordle and Wend) are derived from [hermitdave/FrequencyWords](https://github.com/hermitdave/FrequencyWords) `es` (CC BY-SA 4.0) and the LibreOffice / RLA-ES Spanish spell-check dictionaries (used under MPL 1.1).
- The Crossclimb clues, Pinpoint categories and Nonogram pictures were written for this project.
