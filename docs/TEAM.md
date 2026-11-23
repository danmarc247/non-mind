# NON-MIND build team

## Org

- **Fable (lead, mediator)**: architecture, contracts, the hardest code (engine, genome-to-shader pipeline, arena), integration, playtesting.
- **Opus**: complex coding lanes (shaders, audio engine, HUD, UI kit).
- **Sonnet**: supportive tasks (tests, balance reports, content tables, mechanical ports).
- **Haiku**: mini things (palettes, single sound effects, small data).

One mediator, many specialists. Nobody edits outside their lane; everything crosses lanes through the mediator and the log.

## Roles and lanes

| Agent | Model | Owns (may edit) | Status |
|---|---|---|---|
| Mediator | Fable | `src/game/**`, `src/gfx/units*`, `src/gfx/Scene*`, `src/App.jsx`, config, integration | active |
| Sky | Opus | `src/gfx/PainterSky.jsx`, `src/gfx/glsl/sky.*` (ten per-wave compositions) | done |
| Post | Opus | `src/gfx/PainterPost.jsx`, `src/gfx/glsl/post.*` (five passes, detachment stage inside Relief) | done |
| HUD kit | Opus | `src/ui/bits/*` (not `backgrounds/`) | done |
| Backgrounds | Sonnet | `src/ui/bits/backgrounds/**` | done |
| Audio | Opus | `src/audio/**`, `tests/audio/**` | done |
| Type | Fable | `src/ui/type/**`, `public/fonts/**` | done |
| HUD | Opus | `src/ui/Hud.jsx`, `src/ui/hud/**` (includes idle nudges and the question button) | running |
| Tests + balance | Sonnet | `tests/game/**` | running |
| Content x2 | Sonnet | `src/game/content/**` (mutations, stressor affixes, ambient line pools, cards) | done |
| Arena | Opus | `src/gfx/arena/**`, `src/gfx/glsl/arena.*` (portals, seat rings, core aura, caustics, glass vessel) | done |
| Fx | Opus | `src/gfx/fx/**`, `src/gfx/glsl/fx.*` (paint fx, ten arc veils) | done |
| Drift | Opus | `src/gfx/drift/**`, `src/gfx/glsl/drift.*` (mobiles, strata, motes, tethers) | done |
| Sea | Opus | `src/gfx/sea/**`, `src/gfx/glsl/sea2.*` (seven-movement contained sea) | done |
| Forms | Opus | `src/gfx/sculpt.js` (three growth stages per family, siblings, mutation deformation) | done |
| Lineage | Opus | `src/ui/Lineage.jsx`, `src/ui/lineage/**`, `src/ui/Ceremony.jsx` (PixiJS map; the Ceremony is mounted in `src/App.jsx`, lazily loaded) | done |
| Book | Opus | `src/ui/Book.jsx`, `src/ui/book/**` (the book that keeps what drifted in) | done |
| Drifting keepsake | Opus | `src/gfx/cards/**`, `src/gfx/glsl/card.*`, `cards-gallery.html` (what drifts in over the sea) | done |
| Surprise ring | Opus | `src/ui/hud/Surprise.jsx` (the rare ring above Attend) | done |
| Question button | Fable | `src/ui/hud/Ask.jsx` (asks the advisor for the next hint) | done |
| Save | Sonnet | `src/ui/SaveMenu.jsx`, `src/game/savecode.js` (export, import) | done |
| Advisor | Fable | `src/game/advisor.js` (idle suggestions; the HUD side is in `hud/Nudge.jsx`) | done |
| Palettes x2 | Haiku | `src/gfx/palettes/**` | done |
| Research x4 | Opus | none (reports only) | done |

## Shared contracts (the only coupling points)

- `src/gfx/mood.js`: mutable render mood, written by the game loop, read by every shader and by audio. Nothing but the loop (and PaintFx for `flash`) writes it.
- Rendering: the Canvas is `linear legacy flat`, so shaders write display sRGB. R3F copies a `uniforms` prop into new objects: write to `material.uniforms` on the live material, not to the object you passed in.
- `src/game/index.js`: game API (state shape, `actions`, `step`, `advisor`). UI and gfx read state, call actions, never mutate. The prestige currency is `G.mu` in code and **residue** on screen; links carry English names only.
- `src/index.css`: palette and font tokens.

## Protocol

1. **Brief**: mediator sends goal, lane, contracts, verification steps, report format.
2. **Work**: agent verifies its own output (headless screenshots, offline audio renders, tests).
3. **Hand-back**: short report: what exists, exact exports, what it needs from another lane.
4. **Cross-lane request**: agent appends a line to `docs/team-log.md` (`from -> to: need`), mediator routes it to the owner. No agent edits another lane.
5. **Integrate**: mediator wires it in, runs the game headless, commits, pushes.

## Rules

- No `npm install`, no git, no config edits by specialists. Mediator only.
- Each lane has its own gallery page and dev-server port, so parallel verification never collides. Galleries are development-only (`npm run dev`, then `/<lane>-gallery.html`); the production build ships `index.html` alone.
- Gallery naming exceptions: `bits-backgrounds.html` (the backgrounds of the HUD kit) and `audio-lab.html` (the audio bench) do not follow `<lane>-gallery.html`.
- Nothing in the repo names the games, music or traditions that inspired the work. Describe the system instead (see `nonmind-team`).
- Contracts change only through the mediator, announced in the log.
