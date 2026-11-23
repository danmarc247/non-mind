# NON-MIND build team

One mediator, many specialists. Nobody edits outside their lane; everything crosses lanes through the mediator and the log.

## Roles and lanes

| Agent | Model | Owns (may edit) | Status |
|---|---|---|---|
| Mediator | Fable | `src/game/**`, `src/gfx/units*`, `src/gfx/Scene*`, `src/App.jsx`, config, integration | active |
| Sky | Opus | `src/gfx/PainterSky.jsx`, `src/gfx/glsl/sky.*` | running |
| Post | Opus | `src/gfx/PainterPost.jsx`, `src/gfx/glsl/post.*` | running |
| HUD kit | Opus | `src/ui/bits/*` (not `backgrounds/`) | running |
| Backgrounds | Sonnet | `src/ui/bits/backgrounds/**` | done |
| Audio | Opus | `src/audio/**`, `tests/audio/**` | running |
| Type | Fable | `src/ui/type/**`, `public/fonts/**` | running |
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
