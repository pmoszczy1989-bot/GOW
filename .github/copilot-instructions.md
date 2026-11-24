# Copilot instructions – GOW

Single-screen pixel-art platformer in the style of the classic Prince of Persia (1989). Polish docs in `README.md`.

## Run / test

- No build, no dependencies: open `index.html` directly (works from `file://`).
- Syntax check: `node --check game.js`.
- Headless test from the browser console via `window.GOW` (`start()`, `update(dt)`, `K`/`PR` input maps, `P` player, `G` guard). Step with `update(GOW.STEP)` and clear `PR` after each step.

## Architecture

- `game.js` – one plain script (no modules): constants, level `LEVEL0`, state (`P`, `GD`, `loose`, `gate`, `spikes`), state-machine updates (`updPlayer`, `updGuard`, `updLoose`, `updGate`), drawing (`buildBG` prerender, `drawDynamic`, `drawFig` + `POSE` joint tables), WebAudio `SND`, fixed 1/60 s loop.
- Internal resolution 320×200, 3 rows × 10 tiles (`TW=32`, `RH=60`), `floorY(r)=(r+1)*60-5`, HUD at y 180–200.
- All text goes through `txt()` (queued, drawn by `drawText()` on the full-resolution overlay canvas `#txt`, sized in `fit()`); never `fillText` on the pixel canvas.

## Conventions

- No external assets or dependencies; all art is drawn in code. Do not copy original Prince of Persia assets.
- After changing `game.js`, bump `?v=N` in `index.html`.
- Comments, UI text and docs in Polish. Files UTF-8 without BOM, LF.
- Keep `README.md` (controls, legend, rules) in sync with code.
