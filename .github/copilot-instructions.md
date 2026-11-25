# Copilot instructions – GOW

Single-screen pixel-art platformer modelled on the classic Prince of Persia (1989), set in an original space-knight setting (energy blades, blaster troopers, a red-blade boss). Polish docs in `README.md`.

## Run / test

- No build, no dependencies: open `index.html` directly (works from `file://`).
- Syntax check: `node --check meta.js`, `node --check game.js`, `node --check levels.js`, `node --check ship.js`.
- Headless test from the browser console via `window.GOW` (`loadLevel(i)`, `enterRoom(k)`, `update(dt)`, `K`/`PR` input maps, `P` player, `FOES`, `BOLTS`, `ROOMS`/`ri`/`RD`, `SHIP`). Set `window.requestAnimationFrame = () => {}`, step with `update(GOW.STEP)` and clear `PR` after each step. Load every level and run updates/draws to check for exceptions.

## Architecture

- Scripts load in order `meta.js → levels.js → game.js → ship.js` (plain scripts, shared global scope, no modules).
- `levels.js` – `LEVELS` (35 levels: 6 chapters × 5 platform levels + 5 ship levels). A level has `rooms: [{ map, foes, plats, wl, lore }]` (or top-level `map`/`foes` for level 0); each room is 3 rows × 10 tiles. Tiles `_ # L S W H M P G D B O C T K E` (`C` = hidden blade crystal, one per chapter) plus `Q` quicksand, `U` air vent, `N` mine, `I` ice, `J` mushroom launch pad, `F` fire vent (`ventOn`), `V` lava (death), `X` aura block (converted to `_` + entry in room `blocks`/global `BLOCKS`; `moveBlock` slides it, it falls into gaps and becomes a bridge, holds `P` plates via `plateDown`), `Y` lever (`flipLever`, sets global `lever` → gate stays open). Foe kinds: `blaster`, `rifle`, `shield` (`shieldUp` blocks frontal strikes/bolts), `sniper`, `jet` (flying, `updJet`, counts as `isDrone`), `drone`, `lord`. `wl` = water level in px (125 bottom row flooded, -100 whole room). Ship levels have `ship: { diff, from, to, speeder? }` (`speeder: true` = forest speeder-bike chase: `SHIP.sp`, foes `bike`/`tree`, lane `SP_Y0..SP_Y1`, ends after `SHIP.D` s without a boss). Exits are `D`; walking off the screen edge enters the neighbouring room (`roomCheck`). Keep every exit reachable.
- `game.js` – input (keyboard, touch joystick `#stick` + `button[data-k]`, fullscreen `toggleFull`), `fit()` scaling, state (`game`, `P`, `FOES`, `BOLTS`, room globals swapped by `enterRoom`), updates (`updPlayer`, `updTrooper`, `updLord`, drones, `auraPull`/`auraPush` + QTE `game.qte`/`updQte`, swimming `startSwim`/`updO2`, `updPlats`, `updMines`, finishers), drawing (`buildBG` cached in `BGS[lvl:room]` with `THEMES` 0–11, `drawFig` + `STY`, `gait` IK walk/run, `drawWater`, `drawAuraFx`, `lighting`, `drawEmissive`, `drawWin`), WebAudio, fixed 1/60 s loop.
- `meta.js` – meta systems (top level only reads `localStorage`): run save `gow_save` (written at each `loadLevel` via `saveRun`, only while `game.live`), persistent `META` in `gow_meta` (achievements, owned blades, best), title menu `buildMenu`/`titleKey`, blade collection `XBLADES` + gear screen (mode `gear`, key O), achievements `ACHV`/`achv`/toasts, story pages `STORY`/`showStory` (mode `story`) with light/dark ending (`game.dark`).
- `ship.js` – ship shooter (`startShip`, `updShip`, `drawShip`, `shipHint`, `SHIP`); `update`/`draw` delegate to it when `LV.ship`.
- Controls: A = draw blade + strike (combo 2–5 hits) / pick up / use, S = sheathe, D (hold) = aura dash (`P.dash`: run ×1.9, drains aura instead of regenerating, `jump(130)` while dashing is 35% longer for 10 aura), Z/X = the two power slots (`game.slots`, max 2 powers), U = skill tree, ↑ in fight = block, ↑+direction in fight = jump with drawn blade, F = fullscreen. Input buffer: ↑/A pressed in `BUSYST` states is stored in `P.bup`/`P.bact` and injected into `PR` once the player reaches a `READYST` state. Foes take 3–5 hits, Lords 10. Lord phases (`updLord`): `p1` (hp ≤ 7) blade throw state `lthrow` → returning bolt `b.lb` (reflect = −2 to its Lord), `fury` (hp ≤ 5) summons 2 drones, `p3` (hp ≤ 3) falling rubble `f.rub` (`updRubble`). No blood. Powers work without the blade (except throw). Stealth: a strike on an unaware foe (`!aw`, sleeping or idle with its back turned) kills instantly (`game.cause = 'stealth'`, `game.stealth`). Companion droid `game.bot` (`updBot`, levels ≥ `BOT_LVL`) zaps nearby aware foes and pings `C` crystals.
- Blade lock with Lords (`startLock`/`updLock`/`lockWin`/`lockFail`, state `game.lock`, cooldown `game.lockCd`): triggered by block vs Lord strike, Lord parry, or Lord charge; world runs at 0.15× while the player presses the sequence (`LKEY`: A/↑/Z/X). Powers used (`LNAME`) set the finisher name, damage (2 + powers, max 4) and effect.
- Audio helpers `tone`, `noise`, `buzz`, `crackle`; persistent blade hum `updHum()`; all sounds synthesized, never copied.
- Skill tree `SKILLS` (3 branches, 12 nodes, 4 levels each, `skl(id)`; `free: true` node `vital` has no prerequisite and adds +1 max HP per level – `hpMax()` = `game.maxHp` (base, saved, big potions) + `skl('vital')`): 10 crystals = 1 point. Powers: pull (QTE, Lord −2 HP), push, shield, trick, heal, throw, choke, bolt. Crystals: drone +1, trooper +2, Lord +10, ship kill bonus.
- Game coordinates 320×200 (`TW=32`, `RH=60`), HUD at y 180–200. The canvas is supersampled (`RS` 2–4); draw smooth shapes, not pixel-snapped rects.
- All text goes through `txt()` (drawn on the full-resolution overlay canvas `#txt`); never `fillText` on the pixel canvas.

## Conventions

- No external assets or dependencies; all art is drawn in code. Do not copy original Prince of Persia assets or use trademarked franchise names (no "Jedi", "Sith", "lightsaber", "Force" – the power is called "aura").
- After changing any script, bump `?v=N` on all `<script>` tags in `index.html` (same number).
- Comments, UI text and docs in Polish. Files UTF-8 without BOM, LF.
- Keep `README.md` (controls, levels, rules) in sync with code.
