# Arena shader components

These are drop-in R3F components that replace the plain-material parts of `Scene.jsx`. Each one uses a classic GLSL `ShaderMaterial` that writes display sRGB, takes colours only from the palette tokens, `FAMILY_PALETTES` and the eased stage palette, and reads `mood` every frame. Each allocates its materials once. Easing is exponential and frame-rate independent (`ease()`), with responses in the 150-300 ms range.

```jsx
import { GatePortals, SeatRings, GlassVessel, CoreAura, SeaCaustics } from './arena/index.js';
```

Gallery: `/arena-gallery.html?ff=200&post=0&q=low&cx=&ow=&tension=&stage=&sel=1&cam=x,y,z&bot=0`.
The gallery exposes `window.__mood`, `__pin` (pinned mood fields), `__beat(gate)`, `__attend()`, `__select()` and `__frames`.

| component | props (defaults) | reads | events |
|---|---|---|---|
| `<GatePortals />` | `radiusScale=1.08` (x `gatePos`, same as the old Gates), `y=SEA_Y-0.05`, `scale=1.3` | `mood.time/tension/overwhelm/complexity`, `FAMILY_PALETTES` | `beat` (`e.gate`): flare (~150 ms attack, soft release), threshold ripple, scale pop |
| `<SeatRings />` | `y=SEA_Y+0.12` | `game.G` units/battle, `game.selected`, `ringsOpen`, `ASPECT_TONES`, stage ground | click/hover: same handlers as Scene `Seats`, keyed by `instanceId` |
| `<GlassVessel />` | `radius=SEA_R+0.12`, `top=SEA_Y+0.5`, `depth=5` (down from SEA_Y), `taper=0.96`, `lip=0.15` | stage palette slots (depth-rotated), complexity, overwhelm, flash | none |
| `<CoreAura />` | `position=[0,1.7,0]`, `radius=4.5`, `inner=1.25` (opaque core cut-off), `steps=12` | `mood.stage` (shell count 1 + 0.62·stage, up to 12), complexity, tension, overwhelm, flash | `attend`: a yolk shell races outward |
| `<SeaCaustics />` | `radius=12.4`, `y=-0.3`, `iters=4` | complexity (thickness), tension (speed), stage accent and glow | none |

## What each one draws

- **GatePortals**: an arch-shaped portal quad and a cel-banded tube frame for each of the ten gates. All ten share one program, and `uMode` (`WEATHER_MODE`) picks the look: 0 glass ripples, 1 lead strata, 2 wheel spiral, 3 door slit, 4 plucked strings, 5 mirror shards, 6 fog, 7 kiln fire, 8 bowl arcs, 9 open sky with a sun. Each portal has a white dry-brushed inner outline, an ink edge and impasto lighting. The portals are opaque and alpha-tested, so they need no sorting.
- **SeatRings**: one instanced disc with 30 instances.
  - The ring is a wobbling white brush ring with a loaded start, a dry tail with bristle gaps, and an offset ink shadow underneath.
  - The fill is the occupant's aspect tone. An empty seat shows bare paper.
  - The inner paper arc shows tolerance: `hp/max` in fights, and tol relative to the strongest seated unit otherwise.
  - The outer yolk arc shows charge during fights and flickers when full.
  - While `game.selected` is set, empty seats show a magenta invite with an outward ripple.
  - A hover makes the ring thicker and the fill lighter. The selected unit's own ring turns magenta.
- **GlassVessel**: the wall is drawn twice, back side first (renderOrder 1) and then front side (renderOrder 8), and neither pass writes depth, so the sea's cut face shows through. The wall has a fresnel rim, vertical thickness streaks that get denser toward the base, sliding palette-knife reflections of the stage colours, faint caustic lines under the waterline and a meniscus. A thick paper lip and a foot torus are opaque and cel-banded.
- **CoreAura**: premultiplied blending (ONE, ONE_MINUS_SRC_ALPHA), so it reads as additive while staying on palette. It has four layers:
  - analytic painted shells: an exact chord through each shell, which gives crisp wobbly rings with dry-brush gaps
  - ten analytic filaments to the gates in the family colours, with flowing pulses
  - a raymarched noise haze
  - the attend pulse

  Overwhelm reddens it toward blood and magenta and tears the rings, filaments and haze. The mesh does not raycast, so clicks on the core still go through.
- **SeaCaustics**: uses `sea.vert.glsl`, so it rides the sea's own waves. Iterated domain caustic threads, broken by a dry brush, faded at the rim and near the core. It does not raycast.

## Cost (per covered pixel)

| piece | loops and taps | typical coverage at 1080p | notes |
|---|---|---|---|
| GatePortals | 2-4 value-noise taps (the mirror mode adds a 3x3 hash voronoi) | 10 small quads, about 1-2% of the screen | opaque |
| SeatRings | 5 value-noise taps | at most 30 discs, about 3% | one draw call |
| GlassVessel | 4 value-noise taps | wall about 10-15% | 2 transparent passes |
| CoreAura | 12 shells (analytic, 1 noise each), 10 filaments (analytic), 12 haze steps (1 noise3 each), 1 noise3 for wobble | about 6-10% | the most expensive piece |
| SeaCaustics | 4 sin/cos iterations and 1 value-noise tap | sea top, about 30-40% | discards empty pixels |

I estimate the five pieces together at under about 1.2 ms on a mid laptop GPU at 1080p, `dpr` 1.5. Swiftshader cannot measure GPU time, so this figure was not measured.

None of them use lygia; all the noise is the hash/value noise in `glsl/arena.common.glsl`. No component allocates anything per frame.
