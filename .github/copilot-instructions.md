# Copilot instructions – GOW

Single-screen pixel-art platformer modelled on the classic Prince of Persia (1989), set in an original space-knight setting (energy blades, blaster troopers, a red-blade boss). Polish docs in `README.md`.

## Run / test

- No build, no dependencies: open `index.html` directly (works from `file://`).
- Syntax check: `node --check game.js`, `node --check levels.js`, `node --check ship.js`.
- Headless test from the browser console via `window.GOW` (`loadLevel(i)`, `enterRoom(k)`, `update(dt)`, `K`/`PR` input maps, `P` player, `FOES`, `BOLTS`, `ROOMS`/`ri`/`RD`, `SHIP`). Set `window.requestAnimationFrame = () => {}`, step with `update(GOW.STEP)` and clear `PR` after each step. Load every level and run updates/draws to check for exceptions.

## Architecture

- Scripts load in order `levels.js → game.js → ship.js` (plain scripts, shared global scope, no modules).
- `levels.js` – `LEVELS` (35 levels: 6 chapters × 5 platform levels + 5 ship levels). A level has `rooms: [{ map, foes, plats, wl, lore }]` (or top-level `map`/`foes` for level 0); each room is 3 rows × 10 tiles. Tiles `_ # L S W H M P G D B O T K E` plus `Q` quicksand, `U` air vent, `N` mine, `I` ice, `J` mushroom launch pad, `F` fire vent (`ventOn`), `V` lava (death). `wl` = water level in px (125 bottom row flooded, -100 whole room). Ship levels have `ship: { diff, from, to }`. Exits are `D`; walking off the screen edge enters the neighbouring room (`roomCheck`). Keep every exit reachable.
- `game.js` – input (keyboard, touch joystick `#stick` + `button[data-k]`, fullscreen `toggleFull`), `fit()` scaling, state (`game`, `P`, `FOES`, `BOLTS`, room globals swapped by `enterRoom`), updates (`updPlayer`, `updTrooper`, `updLord`, drones, `auraPull`/`auraPush` + QTE `game.qte`/`updQte`, swimming `startSwim`/`updO2`, `updPlats`, `updMines`, finishers), drawing (`buildBG` cached in `BGS[lvl:room]` with `THEMES` 0–11, `drawFig` + `STY`, `gait` IK walk/run, `drawWater`, `drawAuraFx`, `lighting`, `drawEmissive`, `drawWin`), WebAudio, fixed 1/60 s loop.
- `ship.js` – ship shooter (`startShip`, `updShip`, `drawShip`, `shipHint`, `SHIP`); `update`/`draw` delegate to it when `LV.ship`.
- Controls: A = draw blade + strike (combo 2–5 hits) / pick up / use, S = sheathe, Z/X = the two power slots (`game.slots`, max 2 powers), U = skill tree, ↑ in fight = block, ↑+direction in fight = jump with drawn blade, F = fullscreen. Foes take 3–5 hits, Lords 10. No blood.
- Skill tree `SKILLS` (3 branches, 11 nodes, 4 levels each, `skl(id)`): 10 crystals = 1 point. Powers: pull (QTE, Lord −2 HP), push, shield, trick, heal, throw, choke, bolt. Crystals: drone +1, trooper +2, Lord +10, ship kill bonus.
- Game coordinates 320×200 (`TW=32`, `RH=60`), HUD at y 180–200. The canvas is supersampled (`RS` 2–4); draw smooth shapes, not pixel-snapped rects.
- All text goes through `txt()` (drawn on the full-resolution overlay canvas `#txt`); never `fillText` on the pixel canvas.

## Conventions

- No external assets or dependencies; all art is drawn in code. Do not copy original Prince of Persia assets or use trademarked franchise names (no "Jedi", "Sith", "lightsaber", "Force" – the power is called "aura").
- After changing any script, bump `?v=N` on all `<script>` tags in `index.html` (same number).
- Comments, UI text and docs in Polish. Files UTF-8 without BOM, LF.
- Keep `README.md` (controls, levels, rules) in sync with code.
