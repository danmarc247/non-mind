# Team log

Format: `[time] from -> to: message`. Newest last.

- [t0] mediator -> all: palette + fonts fixed in `src/index.css`; render mood contract in `src/gfx/mood.js`.
- [t1] research(underlords, realm-grinder, cultist, avatamsaka-structure) -> mediator: digests delivered.
- [t2] backgrounds -> mediator: 14 React Bits backgrounds ported, no console errors. License note in its README.
- [t3] type -> mediator: `@pmndrs/glyph` needs WebGPURenderer; will isolate it in a lazy canvas with DOM fallback.
- [t4] mediator -> all: game API contract lands in `src/game/index.js` next; HUD, scene and tests build against it.
- [t5] mediator -> all: game API landed (src/game/index.js, src/game/store.js). HUD and tests lanes opened. Palettes lane (Haiku x2) delivered src/gfx/palettes/.
- [t6] mediator -> all: vite has no --cacheDir flag; use env NM_CACHE_DIR=<private dir> npx vite --port <yours> (vite.config.js reads it).
- [tests] tests -> mediator: possible gap, src/game/game.js:222 `actions.nonMind` is not stage-gated (every other action checks `unlocked`); calling it at stage 0 resets the run and grants mu. Repro: `actions.nonMind(createGame(1))` returns a depth-1 game. Skipped test in tests/game/progression.test.js; ignore if the UI gate is intended to be the only guard. src/game/index.js also does not re-export startWave/stepBattle (tests import battle.js directly).
- [t7] mediator -> all: units now carry heritable mutations (u.muts, displayName(u), MUTATION map); stressors have affixes and names (enemy.name); engine exports ALL_STRESSORS/ANY_STRESSOR. Canvas runs 'linear legacy flat': shaders write display sRGB.
- [hud] hud -> mediator: `src/ui/Hud.jsx` (default export `Hud`) is ready to mount over the canvas in App.jsx; it reads `game.started` and shows the title itself. Gallery: /hud-gallery.html. Note: vite has no `--cacheDir` CLI flag; use `NM_CACHE_DIR`.
- [t8] hud -> mediator: HUD delivered; mediator mounted it via App.jsx. post + sky lanes re-delivered (depth-aware post, stage-driven sky).
- [hud] hud -> gfx/mediator: please publish the projected core position each frame as `mood.coreScreen = { x, y, r }` (CSS px, from the live camera) so the tutorial spotlight/arrow can follow the core when the camera orbits or the Director zooms. HUD already reads it if present; until then it uses the home-camera projection (x 50%, y 36.6%).
