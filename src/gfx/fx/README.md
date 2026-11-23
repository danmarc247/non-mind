# src/gfx/fx: paint fx

`<PaintFx />` is a drop-in replacement for Scene's `<Fx />`. It subscribes to `onEvent` itself and writes `mood.flash` on the same events the old Fx did: waveWin, stage, reset, link, plus boss death, ending and burst_affect. `<ArcVeil />` adds one subtle paint layer per wave-arc modifier.

```jsx
import { PaintFx, ArcVeil } from './fx/index.js';
<ArcVeil />   {/* before PaintFx; renderOrder 3 */}
<PaintFx />   {/* renderOrder 4-7 */}
```

Exports: `PaintFx`, `ArcVeil`, `ARC_IDS`, `FX_CAPS`, `FX_ARENA`, `fxClock`, `dispatchFx(e)` (fires an event at the mounted fx without the game; galleries use it), `fxStats()`.

## How it works

There are four fixed `InstancedBufferGeometry` pools and one GLSL program (`glsl/fx.vert.glsl`, `glsl/fx.frag.glsl`).
- A slot is written once at spawn with t0, life, kind, seed, colours and motion.
- The vertex shader animates it from `uTime`: ballistic with gravity, homing to the core, spiral, ribbon A to B with arc and braid, or a column.
- Live slots cost no CPU, and nothing is allocated per frame.
- Dead slots collapse to degenerate triangles, and `instanceCount` is set to the high-water mark.
- When every slot is still alive, `emit()` returns -1 and the mark is dropped. Drops are counted in `fxStats()`.
- Shading is wet acrylic: height-field impasto lit from screen derivatives, a wet specular highlight, paper outlines and bristle breakup.
- Colours come only from tokens: `PALETTE`, `ASPECT_TONES`, `FAMILY_PALETTES`/`unitColors`, `STAGE_PALETTES`. The output is display sRGB, with `depthWrite` false.

`window.__fxTime = <number>` freezes or overrides the fx clock, which is used for screenshots. ArcVeil uses the same clock.

| pool | cap (slots) | geometry | blend |
|---|---|---|---|
| ground (decals on the sea / arena planes) | 192 | quad | normal |
| invert (colour-flip discs) | 16 | quad | 1-dst inverting blend, dst alpha kept |
| ribbon (strokes, braids, swooshes) | 64 | 24-segment strip | normal |
| air (particles, billboards, columns) | 640 | quad | normal |

Cost: 4 draw calls, plus 1 for ArcVeil. The fragment work is hash and value noise only, at most about 3 taps per kind. The veil does 1 or 2 veils per pixel (2 only while it cross-fades), with a 24-point loop for analogy and same only. A heavy fight (auto mode: about 18 events/s) holds around 50 air slots and 10 ground slots live.

## Event to effect

| event | effect | life |
|---|---|---|
| strike | brush ribbon attacker to target, loaded head, dry bristled tail, slight arc, aspect tone | 0.26 s |
| hit | billboard splash with satellites and a drip, sized by `amt`, plus flying droplets (ink/blood when a regulator is hit) | 0.42-0.67 s |
| miss | pale dry scuff | 0.32 s |
| cast invert | disc that inverts colours under it, white-outlined ring | 0.55 s |
| cast store | three rings contracting into an ink lid | 0.45 s |
| cast flurry | five quick strokes radiating, staggered | 0.2 s each |
| cast retreat | big arcing swoosh to the far rim, ink hole left behind | 0.34 s |
| cast heal | rosette of petals on the ground, 8 petals rising | 0.75 s |
| cast transfer | two crescents (tone and blood) orbiting and trading places | 0.5 s |
| cast blink | ink hole closing with its rim flying out, sparks | 0.45 s |
| cast burst_affect | kiln flare with yolk/tangerine rays, yolk sparks homing to the core | 0.95 s |
| cast taunt | ink star pulsing twice, tone ring | 0.55 s |
| cast equalize | level line sweeping the whole arena, flattened wash behind it | 0.8 s |
| cast echo:true | same gesture at 50% alpha, 80% size, offset and 80 ms late | |
| death | 22 paint motes rise, then drift into the core, paper ring | 1.1-1.45 s |
| enemyDeath | magenta/ultra ground splash, splat, ring shockwave, droplets; boss ×2.4 with 3 shockwaves and a flash | 0.6-0.95 s |
| link | two family-colour swirls spiral into the unit, stroke from the consumed twin's seat, ring with 12 ticks (lit = link) | 0.55 s + 0.75 s |
| integrate | two braided ribbons (family colours over teal) from the parents into the new unit, teal ring | 0.62 s |
| subtract | blood wedge carved out, tumbling and falling away, droplets | 0.85 s |
| split | blob tears in two along a white seam, paper droplets, violet ring | 0.75 s |
| repurpose | form flattens to a stamp, the stamp sinks into the sea with ripples | 0.5 s + 1.05 s |
| mutation | glitch shell (misregistered magenta/ultra rows), brief colour-flip | 0.42 s |
| ending | slow white column with rising motes and a ticked ring (the only slow effect) | 2.0 s |
| waveStart | ten spokes stroke inward from the gates (ink and stage primary) | 0.5 s |
| waveWin | 60 paint flecks tumble and fall inward | 1.5-2.0 s |
| waveLose | ink bleeds in from the rim | 1.4 s |
| stage | five rings in the new stage's palette expand from the core | 0.95 s |
| reset | all pools wiped, white bloom wave from the centre, 0.6 s of silence | 1.3 s |
| attend | yolk ripple on the core plus two sparks (spam-safe: 60 at once is fine) | 0.42 s |
| coreHit | ink/blood splat on the core | 0.45 s |
| beat | small ink ring at the gate | 0.5 s |

Positions for genetic events come from the unit's seat (`seatPos`). Seats are cached every 0.25 s, so merged, split and repurposed units, which the engine removes before it emits the event, still have a position. If no seat is known, the core is used.

## ArcVeil (`game.G.battle.arc.id`, while `phase === 'fight'`)

It is a disc just above the units (y 1.75). It fades in at rate 2.5, fades out at 1.6, and cross-fades between arcs at 2.2.

| arc | veil |
|---|---|
| negation | drifting ordered-dither paper fog that half-hides things |
| ineffable | lines of unreadable script, written and erased |
| analogy | every stressor drags a faint ink likeness |
| onemany | magenta cell net that keeps dividing |
| counting | ink tallies by the rim, recounted every beat |
| placeless | slow rotating moire of two ultramarine gratings |
| same | your own regulators mirrored through the core, ten spokes |
| observer | rings around the core, quickened by `attend` |
| cancel | desaturating paper wash and a quiet grid |
| return | warm yolk light and rays from the core |

Gallery: `/fx-gallery.html` (`?near=1`, `?arc=<id>`, `?auto=1`, `?ui=0`). It provides `window.__fire(type, payload)`, `__freeze(dt)`, `__unfreeze()`, `__arc(id)`, `__auto(on)` and `__fxStats()`.

Gotcha: R3F 9 copies a `uniforms` prop into its own uniform objects, so numeric `.value` writes to your memo object never reach the GPU. Build the `ShaderMaterial` imperatively, as this folder does.
