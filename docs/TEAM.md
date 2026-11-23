# NON-MIND build team

## Org

- **Fable (boss, mediator)**: architecture, contracts, the hardest code (engine, genome-to-shader pipeline, arena), integration, playtesting.
- **Opus**: complex coding lanes (shaders, audio engine, HUD, UI kit).
- **Sonnet**: supportive tasks (tests, balance reports, content tables, mechanical ports).
- **Haiku**: mini things (palettes, single sound effects, small data).

One mediator, many specialists. Nobody edits outside their lane; everything crosses lanes through the mediator and the log.

## Roles and lanes

| Agent | Model | Owns (may edit) | Status |
|---|---|---|---|
| Mediator | Fable | `src/game/**`, `src/gfx/units*`, `src/gfx/Scene*`, `src/App.jsx`, config, integration | active |
| Sky | Opus | `src/gfx/PainterSky.jsx`, `src/gfx/glsl/sky.*` | done |
| Post | Opus | `src/gfx/PainterPost.jsx`, `src/gfx/glsl/post.*` | done |
| HUD kit | Opus | `src/ui/bits/*` (not `backgrounds/`) | done |
| Backgrounds | Sonnet | `src/ui/bits/backgrounds/**` | done |
| Audio | Opus | `src/audio/**`, `tests/audio/**` | running |
| Type | Fable | `src/ui/type/**`, `public/fonts/**` | done |
| HUD | Opus | `src/ui/Hud.jsx`, `src/ui/hud/**` | running |
| Tests + balance | Sonnet | `tests/game/**`, `vitest.config.js` | running |
| Content x2 | Sonnet | `src/game/content/**` | done |
| Palettes x2 | Haiku | `src/gfx/palettes/**` | done |
| Research x4 | Opus | none (reports only) | done |

## Shared contracts (the only coupling points)

- `src/gfx/mood.js`: mutable render mood, written by the game loop, read by every shader and by audio.
- `src/game/index.js`: game API (state shape, `actions`, `step`). UI and gfx read state, call actions, never mutate.
- `src/index.css`: palette and font tokens.

## Protocol

1. **Brief**: mediator sends goal, lane, contracts, verification steps, report format.
2. **Work**: agent verifies its own output (headless screenshots, offline audio renders, tests).
3. **Hand-back**: short report: what exists, exact exports, what it needs from another lane.
4. **Cross-lane request**: agent appends a line to `docs/team-log.md` (`from -> to: need`), mediator routes it to the owner. No agent edits another lane.
5. **Integrate**: mediator wires it in, runs the game headless, commits, pushes.

## Rules

- No `npm install`, no git, no config edits by specialists. Mediator only.
- Each lane has its own gallery page and dev-server port, so parallel verification never collides.
- Contracts change only through the mediator, announced in the log.
