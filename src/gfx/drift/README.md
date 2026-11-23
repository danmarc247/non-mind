# Drift: things that belong to the picture but touch nothing

Four R3F components that suspend the arena inside a larger abstract composition. They add bodies that hang in the mid-distance, paint slices below the vessel, rising motes, and lines that almost connect. Nothing touches the vessel, the ground or anything else.

```jsx
import { Mobiles, Strata, Motes, Tethers } from './drift/index.js';
<Strata /><Mobiles /><Tethers /><Motes />
```

Each component:
- uses classic GLSL `ShaderMaterial`s that write display sRGB (the Canvas is `linear legacy flat`)
- takes its colours only from the eased stage palette (`mixStagePalette` → `linearToSrgb`, with slots rotated by `mood.depth`) and the paper and ink tokens
- reads `mood` every frame and never writes it
- allocates its materials once and does no per-frame allocation
- does not raycast, so clicks pass through

Gallery: `/drift-gallery.html?stage=&cx=&ow=&flash=1&az=<deg>&pol=&dist=&rot=0&post=1&only=mobiles,strata,motes,tethers&focus=<i>&instant=1&ui=0`. It exposes `window.__mood`, `__cam(azDeg, polar, dist)`, `__focus` and `__frames`.

## Props

| component | props (defaults) | reads |
|---|---|---|
| `<Mobiles />` | `count=14` (first N of `MOBILE_DEFS`), `scale=1` (positions and sizes), `clearCone=true`, `instant=false` (gallery: skips the appear easing) | stage (unlock, intricacy, paleness at stage 0-4), complexity (intricacy), overwhelm (crowd inward, tear, torn twins, faster drift), flash (a jump to above 0.6, which only a reset (flash 1) produces, scatters the bodies outward and fades them; they drift back over about 3 s), audio.low (breath), the live camera and the `controls.target` |
| `<Strata />` | `count=5`, `scale=1`, `instant=false` | stage (2 sheets at stage 0, 3 at 5, 4 at 9, 5 at 13), complexity (pattern density), overwhelm (spin, separation), flash, audio.low |
| `<Motes />` | `max=420`, `yMin=-32`, `yMax=24`, `rMin=15`, `rMax=62`, `size=0.32`, `instant=false` | complexity and stage (count, from 18% to 100%), flash (flare and scatter), audio.high (shimmer and size), overwhelm (speed) |
| `<Tethers />` | `width=1.4` (px, scaled by dpr), `instant=false` | the Mobiles registry (`driftState.mobiles`), `gatePos`, stage (unlock), overwhelm (wider gaps, fray), flash (the gaps snap open) |

`driftState.mobiles[i] = { pos, size, vis, kind }` is published by `Mobiles` each frame, and `Tethers` reads it. Mount `Mobiles` before `Tethers`.

## What each one draws

### Mobiles
Fourteen bodies, unlocked at stages 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 11, 12, 14 and 16. They are built from three programs.

**Solids** (`drift.solid.frag.glsl`) are raymarched inside a unit bounding icosphere and come in five SDF kinds:
- a kaleidoscopic sort-fold IFS of blades around an octahedral seed, with 2 to 4 levels
- a Möbius-like band with 1, 3 or 5 half twists, ladder windows and an inner counter-band
- a gyroid labyrinth cut by a disc (or by a ball when `alt` is set), with a paper rim
- a trefoil knot, which gains a second linked strand as detail rises
- up to 3 counter-rotating shells with polar windows around a seed

The shading:
- 3 cel bands, with shadows painted in the next palette colour
- palette-knife streaks loaded with a second colour
- an impasto highlight fleck
- cavity from the step count
- a paper fresnel rim and an ink contour
- a white cut-paper outline drawn from the ray's closest approach, so each body reads as a cut-out pinned in the air
- correct `gl_FragDepth`

Under overwhelm, the bodies are sliced into sheared bands with gaps, and a torn twin peels away from each solid.

**Cut-paper cards** (`drift.paper.frag.glsl`) have three interiors: a ring field (ref b), impasto stripes, or a knife swirl (ref a). The silhouette is a disc, a slab or a crescent. Each card has a white cut edge and an offset ink shadow, and is lit with derivative impasto plus a facing term. Its back is bare paper.

**Wire orbits** (`drift.wire.frag.glsl`) are dry-brushed, dashed rings around two of the solids, plus one pair of great rings around the whole arena far below.

**Clear view.** Every frame, each body is tested against a cone from the live camera to the arena: a sphere of radius 15 around `controls.target`. A body between the camera and the arena fades out and side-steps. A body beyond the middle of the arena is allowed, because the opaque sea hides it rather than it hiding the arena. This holds at every auto-rotate angle.

### Strata
Five horizontal discs, at y = -9, -15, -21, -26 and -30, with radii from 25 to 56. Each has its own pattern:
- flow-warped bands
- a ring field
- dry-brush hatching
- knife arcs
- a fleck-and-wash field

Each sheet fades to nothing at a ragged rim and counter-rotates against its neighbours. They are `depthWrite` off, with renderOrder -2 to -6. The top sheet catches the vessel's shadow: the cylinder is projected analytically along the light (three discs from the foot to the lip), with a penumbra that grows with the gap and a faint halo.

### Motes
One instanced quad draw, with the whole life of each mote computed in the vertex shader (no per-frame upload). Round dabs and short strokes, stretched along their motion, rise through a ring between radii 15 and 62 from y = -32 to y = 24. They fade near the lens.

### Tethers
Six lines in one draw call, each drawn as 2 pencil passes:
- core to gate 3
- body 0 to the vessel rim
- top stratum to the vessel underside
- body 3 to the vessel foot
- core to gate 7
- body 5 to body 8

Each line is a sagging chord with hand wobble, built as a screen-space ribbon. Its pressure lands light, swells, lifts, and ends in a small ink bulb, a gap short of its target. The gap is about 0.45 + 0.03·L plus a breathing term, so it never closes. It widens with overwhelm and snaps open on a reset.

## Cost (per covered pixel)

| piece | loops and taps | typical coverage at 1080p | notes |
|---|---|---|---|
| Mobiles: solids | at most **40** march steps, each one `map()` (the fold has at most 4 levels, the knot at most 4 strands, the shells at most 3); then 4 `map()` for the normal, 3 value-noise taps and 1 hash. The worst case is about 44 SDF evaluations. | 7 or 8 solids, each 0.5-3% of the screen (radii 4-6.5 at 30-60 units) | discard outside the bounding sphere; uniform branch on kind |
| Mobiles: cards | ring field: 9 cells (18 hashes) + 3 noise; stripes: 4 noise; swirl: 5 noise; edge: 1 noise | 4 cards, each about 1-3% | transparent edges |
| Mobiles: wires | 2 noise | about 1% in total | |
| Strata | 3-18 hash or noise taps (the ring field uses 9 cells), plus 3 analytic discs for the shadow on the top sheet | 20-35% of the screen, mostly behind the vessel | the vessel occludes the middle (early-z) |
| Motes | 2 noise | at most 420 quads of about 4-10 px | 1 draw |
| Tethers | 1 noise | 6 x 2 hairlines | 1 draw, 12 x 64 segments |

At stage 16 that is about 16 draw calls for Mobiles, plus 5 for Strata, 1 for Motes and 1 for Tethers. I estimate the four components together at about 1.0-1.4 ms on a mid laptop GPU at 1080p, `dpr` 1.5. The solids dominate this cost. I could not measure GPU time, because SwiftShader cannot time it. If the budget is short, `count={10}` drops the late bodies, and `uStepK`/the step count is the lever for the solids.
