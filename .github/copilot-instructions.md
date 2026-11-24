# Copilot instructions – GOW

Single-screen pixel-art platformer modelled on the classic Prince of Persia (1989), set in an original space-knight setting (energy blades, blaster troopers, a red-blade boss). Polish docs in `README.md`.

## Run / test

- No build, no dependencies: open `index.html` directly (works from `file://`).
- Syntax check: `node --check game.js`.
- Headless test from the browser console via `window.GOW` (`newGame()`, `loadLevel(i)`, `update(dt)`, `K`/`PR` input maps, `P` player, `FOES`, `BOLTS`). Step with `update(GOW.STEP)` and clear `PR` after each step.

## Architecture

- `game.js` – one plain script (no modules): `LEVELS` (5 maps, 3 rows × 10 tiles + foes; tiles `_ # L S W H M P G D` plus interactive `B` crate, `O` crystal, `T` terminal, `K` console, `E` pulsing barrier), `BLADES` (hero blade colours, never red), state (`game`, `P`, `FOES`, `BOLTS`, `DEBRIS`, `gate`, `used`), updates (`updPlayer`, `updTrooper` with patrol/awareness `aw`, `updLord` with hop/fury, `hitFoe` → foe state `fin` then `fdead`/`gone`, `startFinisher` + player state `fin` with slow-mo `game.slowT` and letterbox `game.bars`, `boltHitsPlayer`), drawing (`buildBG` per-level prerender with `THEMES`, `drawFig` + `STY`, `slashPose`/`finPose`, `lighting`, `drawEmissive`), WebAudio, fixed 1/60 s loop.
- Controls: A = draw blade + strike / pick up / use, S (`PR.sheathe`) = sheathe, ↑ in fight = block. Foes take 3–5 hits, the Lord 10. No blood: hits and finishers use sparks, debris and embers only.
- Game coordinates 320×200 (`TW=32`, `RH=60`), HUD at y 180–200. The canvas is supersampled: `draw()` sets `ctx.setTransform(RS,…)` with `RS` 2–4 from `fit()`; offscreen canvases (`buildBG`, `vignette`) are built at `SW*RS` and rebuilt when `RS` changes. Draw smooth shapes (`seg` strokes, `dot`, `rrect`), not pixel-snapped `Math.round` rects.
- All text goes through `txt()` (drawn on the full-resolution overlay canvas `#txt`); never `fillText` on the pixel canvas.

## Conventions

- No external assets or dependencies; all art is drawn in code. Do not copy original Prince of Persia assets or use trademarked franchise names (no "Jedi", "Sith", "lightsaber").
- After changing `game.js`, bump `?v=N` in `index.html`.
- Comments, UI text and docs in Polish. Files UTF-8 without BOM, LF.
- Keep `README.md` (controls, levels, rules) in sync with code.
