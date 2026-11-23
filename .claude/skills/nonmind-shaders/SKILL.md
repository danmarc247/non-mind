---
name: nonmind-shaders
description: Use when writing, changing or reviewing any NON-MIND shader or GPU visual. That includes GLSL in src/gfx/glsl (sky, sea, post stack), Shader Park unit, stressor and core sculptures in src/gfx/sculpt.js, adding a family form, changing how hybrids or link levels look, wiring uniforms from the mood object, adding a painterly effect, and tuning performance. Also use when verifying a visual change with headless screenshots. Colours and tokens come from nonmind-design-system; read that first for palette questions.
---

# NON-MIND shaders

Owner intent:
- "USE MANY, MANY amazing shaders" at Shadertoy-grade quality.
- "3D objects with shaders on them are very impressive, and people should always see new morphs, merges, and splits."
- "Change the palettes and shaders dynamically in the game with progress."
- The sea is **contained**: a sea held in a glass vessel. The scene and code stay compact.
- The look is acrylic paint (impasto swirls, rings with white outlines, magenta and ultramarine splashes on white). It is never neon sci-fi.

## 1. Map of the GPU code

| piece | files | what it does |
|---|---|---|
| Sky | `PainterSky.jsx`, `glsl/sky.{vert,frag}.glsl` | A painting on the inside of a sphere of radius 400, which follows the camera. Flow field, three palette-knife stroke layers, scratches, white-outlined rings, flecks, overwhelm splashes and drips, canvas weave, impasto lighting. |
| Sea | `Scene.jsx` `Sea()`, `glsl/sea.{vert,frag}.glsl` | A disc (R 12.5) and a cylinder cut face inside a glass rim and wall. Flow-warped bands of the stage palette, foam rings plus 10 spokes, strata on the cut face. |
| Units / stressors / core | `sculpt.js` | Shader Park SDF programs compiled per genome. Raymarched inside a BackSide sphere. |
| Post | `PainterPost.jsx`, `glsl/post.*.glsl` | Kuwahara, then Relief, Bloom, Grade, Overwhelm. |
| Fx | `Scene.jsx` `Fx()` | One instanced circle mesh (N=220) for stroke, splat and ring paint marks. |

Preferred stack (owner list): **Three.js + React Three Fiber + drei** for the scene, **Shader Park** for SDF sculptures, **lygia** for GLSL building blocks, **postprocessing** for the post chain, **OGL** (React Bits backgrounds) and **PixiJS v8** only for 2D or UI-side canvases. Do not add another 3D engine.

## 2. The mood contract (`src/gfx/mood.js`)

There is one plain mutable object. It is written once per frame by `Loop` in `Scene.jsx` and read by every shader and by audio. It never triggers a React render.

| field | range | written as | use it for |
|---|---|---|---|
| `time` | s | `+= dt * (1 + overwhelm*0.8)` | All animation. Never use `performance.now()` or `clock.elapsedTime`. |
| `complexity` | 0..1 | eased `G.complexity / G.capacity`, rate 1.5 | Density, number of strokes, warp, saturation. |
| `overwhelm` | 0..1 | eased `G.overwhelm`, rate 1.2 | Tearing, splashes, drips, wobble, whiteout. |
| `tension` | 0..1 | fight intensity, rate 2 | Relief depth, saturation, streaks, wave height. |
| `stage` | 0..17 float | eased `G.stage`, rate 0.8 | `mixStagePalette(mood.stage)`. |
| `depth` | int | prestige | Palette rotation. |
| `flash` | 0..1 | set by events, decays at 4 | White pulse, bloom pump, exposure. |
| `audio` | {low,mid,high,rms} | from `getLevels()` | Shimmer, ring pulse, flow speed. Keep it subtle (≤ 8-15%). |

Rules:
- Every uniform is refreshed from `mood` inside `useFrame` (or postprocessing `update()`).
- Allocate `ShaderMaterial`s and uniform objects once (`useMemo`), then mutate `.value`.
- If you need a speed-up that must not jump, integrate your own clock (as PainterSky does: `c.t += dt * (1 + overwhelm*2.5 + audio.low*0.4)`).
- Never write to `mood` from a shader component. The one exception is `Fx`, which sets `flash` on events.

## 3. Palette uniforms

- Pass colours as `vec3`. The naming convention:
  - `uPaper`, `uInk`, `uMagenta`, `uUltra`
  - stage slots as `uA/uB/uC` (primary, secondary, accent)
  - arrays as `uPal[8]`
- Get colours from `PALETTE` (sRGB 0..1), from `mixStagePalette(...)` plus `linearToSrgb` (the sea), or from `unitColors()`.
- Colour space:
  - The R3F/postprocessing *input* is linear, so post effects convert with `toLinear` (`pow(c, 2.2)`; see `PainterPost.jsx`).
  - Raw `ShaderMaterial`s on scene meshes write sRGB-ish values directly. Sky and sea do this.
  - Match whatever the neighbouring code does. Do not mix conventions inside a file.
- Never hardcode a colour literal in GLSL. The existing exceptions are `vec3(1.0)` for white flash, the sea's overwhelm magenta (which should become `uMagenta` if touched), and the sky's dark splash core (`vec3(0.42,0.04,0.16)`, crimson family). New code adds a uniform.

## 4. lygia include style

`vite-plugin-glsl` is configured with `root: '/node_modules/'`, so includes are absolute from node_modules:
```glsl
#include "/lygia/generative/snoise.glsl"
#include "/lygia/generative/psrdnoise.glsl"   // gradient for free: psrdnoise(p, period, rot, out vec3 g)
#include "/lygia/generative/random.glsl"      // random(), random4(vec3)
```
- Prefer lygia for noise, SDFs, colour (`/lygia/color/...`), blending and filters, rather than pasting your own.
- Prefix any local helper (`pp_` in post, `hash1/vnoise1` in sky) so it does not clash with lygia or three's `<common>` (`luminance`, `PI`, `saturate`).
- Import GLSL as a string: `import frag from './glsl/x.frag.glsl'`. Post effects get `post.common.glsl` prepended by `frag()`.

## 5. Shader Park genome pipeline (`src/gfx/sculpt.js`)

A unit's genome tree (`src/game/genome.js`) becomes a Shader Park program, which becomes GLSL. A hybrid is literally the CSG of its parents, so every new combination is a new form.

1. **Leaf**:
   - The family's `form` (from `FAMILY[f].form` in `data.js`) is looked up in `FORMS`.
   - Its colours come from `unitColors(f, grade)`, and the pole tints them.
   - It is wrapped in `shape(()=>{ ... })();`.
   - A crown marks the pole: a paper sphere on top for +1, an ink slab under it for -1.
2. **Node**:
   - `op` maps to Shader Park as `blend` → `blend(k)`, `carve` → `difference()`, `mix` → `mixGeo(k)`.
   - The second child is offset by `OFF[i]` (×1.1 for carve) and rotated `rotateY(i*1.3)`.
   - `k` is `0.2 + rng*0.3`, set in `combine()`.
3. **Link refinement** (`unitSource`):
   - Low links are *knotted*: a domain warp `displace(noise(sp*5+time*0.5)*W, ...)` with `W = max(0, 1-(link-1)/5)*0.06 + 0.01*min(4, leaves)`. Bigger hybrids stay a bit restless.
   - High links gain `floor(link/3)` paper halo tori that orbit at incommensurate speeds.
   - The colour grade comes from `LINK_GRADE`, remapped to 4..12.
4. **MAIN** (shared fragment epilogue). It replaces Shader Park's `main()`:
   - Reinhard and gamma
   - **quantised light bands** (`floor(l*3+1.5)/3`), which give the painterly cel look
   - a paper fresnel rim scaled by `uGlow`
   - `uFlash` to white
   - a hash-dither `discard` for `uFade` (dissolve)
   - correct `gl_FragDepth`, so the SDFs intersect the sea and each other
5. **Caching**: there is one compiled material per key, `u|${key(g)}|${link}`, `s|id` or `core|stage`, and each instance gets a `.clone()`. `Bodies` rebuilds a mesh when `${id}|${link}|${leaves}` changes, which is when a merge or split visibly re-forms. On a compile error it falls back to `sphere(0.35)`; check the console for `sculpt error`.

### Add a family form
1. Add `FORMS.myform = (A, B) => \`...\`` in `sculpt.js`. A and B are `vec3(...)` strings. Rules for the form:
   - Stay inside radius ~0.5. The bounding sphere discards at `length(p) > 1.02` after scale.
   - Use `time` for at least one living motion (rotate, breathe or flicker).
   - Use both colours.
   - Keep it under about 6 primitives, because hybrids multiply them.
2. Set `form: 'myform'` on the family in `data.js` (mediator lane), plus `FAMILY_PALETTES` in `families.js` and `ASPECT_TONES` if it needs a new aspect.
3. Check it alone, then as a hybrid with each op (blend, carve, mix) against `lens` and `knot`. Carve must leave a readable silhouette.

```js
// example: a "spiral" form (two counter-rotating ribbons around a seed)
spiral: (A, B) => `color(${A}); sphere(0.14); rotateY(time*0.9); color(${B}); torus(0.3,0.03); rotateX(1.2); torus(0.38,0.022); rotateZ(time*0.6); color(${A}); torus(0.45,0.015);`,
```

### Hybrid composition rules
- Depth is the visual complexity. `MAX_LEAVES = 6`: anything beyond that gets pruned into `ghosts` (stat residue, with no geometry).
- Carve offsets are larger, so the hole shows.
- If you change `OFF` or the rotation you change *every existing hybrid's look*. That is acceptable, but do it on purpose.
- `setMaxIterations` budgets: units 48 (step 0.8), stressors 36 (0.85), core 56 (0.8). Raise them only with a performance check.

### Core (`coreMaterial(stage)`)
- The core gains one element per stage, cycling through torus ring, blended satellite sphere and box spoke, in token colours (`cols`).
- It is rebuilt when `G.stage` changes, with `pop = 1.5`. So the centre is a visible record of progress.

## 6. Painterly technique catalogue (real code, adapt it and do not reinvent)

**Flow-warped strokes**: the stroke direction comes from the iso-lines of a gradient noise (sky):
```glsl
vec3 g; float n0 = psrdnoise(d * 1.35 + vec3(0.0, t*0.015, 0.0), vec3(0.0), t*(0.12 + O*0.35), g);
vec3 T = normalize(cross(d, g)); vec3 B = cross(d, T);   // stroke frame: along T, across B
vec3 p = d * 3.0 + g * (0.06 + 0.1*O);                   // warped painting space
```
**Domain-warped bands** (sea):
```glsl
vec2 warp = vec2(snoise(vec3(q, t)), snoise(vec3(q + 5.2, t + 3.0)));
q += warp * (0.35 + 0.5*uComplexity);
float bands = sin((n*3.0 + length(p)*0.55 - uTime*0.35) * 3.14159);
```
**Palette-knife stroke**: a blunt loaded start, a dry bristled tail, and ragged edges. See `strokeLayer` in `sky.frag.glsl`:
```glsl
float taper = 1.0 - 0.55*smoothstep(0.1, 1.0, u);                 // u: -1 start .. 1 tail
float m = smoothstep(aaw, -aaw, abs(v) - taper - rag);
float bristle = vnoise1(across*38.0)*0.6 + vnoise1(across*95.0)*0.4;
m *= smoothstep(dry - 0.08, dry + 0.08, bristle + 0.12);           // dry brush breakup
```
**Impasto relief**: accumulate a scalar `height`, then light it from screen derivatives:
```glsl
vec2 slope = clamp(vec2(dFdx(height), dFdy(height)) * 2.2, -0.6, 0.6);
vec3 nrm = normalize(vec3(-slope, 1.0));
col *= mix(1.0, dot(nrm, L) / L.z, 0.55);
col += pow(max(dot(nrm, normalize(L + vec3(0,0,1))), 0.0), 40.0) * 0.18 * smoothstep(0.05, 0.3, height);
```
In post, the same idea runs as palette-knife dabs plus bristle LIC (`post.relief.glsl`, `LIC_TAPS`).

**Ring motif (ref b)**: a wobbly white outline band, an optional flat fill and a dry streak:
```glsl
float rr = R * (1.0 + 0.06*sin(dot(rd, vec3(1.3,0.7,1.1))*2.0/R));
float band = smoothstep(th + px, th - px, abs(dist - rr));
col = mix(col, fillCol, smoothstep(rr - th + px, rr - th - px, dist) * fillA);
col = mix(col, uPaper*1.02, band*0.95);  height = max(height, band*0.3);
```
Ring counts grow with complexity (`visible = 1 + complexity*5` in PainterSky). Procedural ring cells appear from `C > 0.2`.

**Splashes and drips (ref c, overwhelm)**: a noise threshold that drops with O, plus hashed vertical runs with a bulb at the tip:
```glsl
float thr = 1.15 - O*0.95; float splash = smoothstep(thr, thr + 0.06, sp + br);
vec3 sc = mix(uMagenta, uUltra, smoothstep(-0.25, 0.25, m1n + br));
// drip: columns hashed on direction; length grows with phase*O; bulb = circle at (y0 - len)
```
**Kuwahara** (`post.kuwahara.glsl`): an anisotropic generalised Kuwahara with 4 sectors, oriented by a Sobel structure tensor. In flat regions it blends toward `pp_flowDir`, so even empty paper gets strokes. The radius grows with complexity and overwhelm.

**Quantised cel bands and paper rim**: see `MAIN` in sculpt.js. Use it on any new 3D object so it matches the units.

**Overwhelm post** (`post.overwhelm.glsl`): wobble, chroma smear along strokes, tension streaks, posterise, splashes creeping in from the edges, whiteout. Any new "it's too much" effect belongs here, scaled by `uOverwhelm`.

Ideas that are welcome, if they stay on-palette and on-mood:
- curl-noise paint advection on the sea
- SDF metaball merges for `integrate`
- a crack-and-shard split shader
- reaction-diffusion habit textures
- MatCap impasto on the glass rim
- Shader Park `mirrorN` for the "same assembly in every direction" mirror upgrade

## 7. Progress must change the shaders

| driver | already does | when adding, map to |
|---|---|---|
| complexity | stroke density/size/saturation, rings, scratch count, warp, sea band strength, Kuwahara radius | more structure |
| stage | sea colours (mixStagePalette), core geometry | palette and structural additions |
| link | knot warp down, halos up, grade mud to luminous | refinement |
| overwhelm | tears, splashes, drips, time speed-up, sea magenta, post wobble/whiteout, palette 16→17 | breakdown into white plus magenta/ultra |
| depth | sky palette rotation, audio key | a new "dialect" per run |
| flash | white burst, bloom, exposure | event punctuation |

## 8. Performance budgets

- Target 60 fps at `dpr [1, 1.5]` on integrated GPUs, with post at `quality='med'`. Fill rate is the cost; the vertex count is irrelevant.
- Sky noise per pixel: 1 psrdnoise + 3 snoise, +1 only when O > 0. Everything else is hash or analytic. Keep that header comment true.
- Post taps per quality preset are in `PAINTER_QUALITY`; Kuwahara taps = 4·RINGS·ANGLES + 1. Never add a full-screen pass that is not in that chain. Extend an existing effect instead.
- SDF units: 48 iterations, up to about 30 seated units plus stressors (14 per beat cap). Do not raise iterations globally.
- Caps: Fx is one instanced mesh with 220 slots. Avoid per-frame allocation in `useFrame` (reuse `Vector3`/`Color`, as `tmpV` and `dummy` do).
- `CanvasRevealEffect`/`ShaderLensBlur` each own a GL context. Keep that to two at most.

## 9. Headless screenshot loop (always run it before handing back)

Galleries: `sky-gallery.html`, `post-gallery.html` (`?bypass=1&q=low|med|high&ow=&tension=&flash=&cx=&ui=0`), and `scene-gallery.html` (`?ff=<seconds>` fast-forwards the bot; exposes `window.__ff`, `__act`, `__tick`, `__mood`). The full recipe (private port, `NM_CACHE_DIR`, software WebGL flags, console capture) is in the **nonmind-verify** skill. In short:
```bash
NM_CACHE_DIR=$SCRATCH/vite-shaders npx vite --port 5191 --strictPort &   # your own port
```
```js
// playwright (chromium, --use-gl=swiftshader --enable-unsafe-swiftshader)
await page.goto('http://localhost:5191/scene-gallery.html?ff=240');
await page.waitForFunction(() => (window.__frames || 0) > 30 || document.querySelector('canvas'));
for (const ow of [0, 0.5, 1]) { await page.evaluate((o) => { window.__mood && (window.__mood.overwhelm = o); }, ow); await page.waitForTimeout(600); await page.screenshot({ path: `$SCRATCH/shot-ow${ow}.png` }); }
```
- Capture at least three points: simple (stage 0, cx 0), mid (cx 0.5), and overwhelmed (ow 1).
- Read the PNGs back and look at them.
- Fail on any console error, GLSL compile log, `sculpt error`, or a blank or black canvas.

## 10. "Is it impressive and on-palette?" checklist

1. Every colour comes from a uniform fed by tokens, the stage palette or unitColors. There are no stray literals.
2. It reads as **paint**: strokes, impasto, rings or splashes. It does not read as smooth CG gradients, chrome or neon glow on black.
3. It moves all the time (`mood.time`), softly, and nothing strobes. Flash is the only instant change.
4. It changes visibly between cx 0, cx 0.5 and ow 1 screenshots, and with stage and depth.
5. Merges, splits and link-ups produce a visible re-form (pop, flash, new SDF), not a silent swap.
6. Contained: nothing spills past the glass vessel or sky sphere, and the arena stays compact.
7. It stays within the noise and tap budgets, with no new full-screen passes and no per-frame allocations.
8. The screenshots were taken, opened and checked, and the console is clean.
9. It is surprising. If it looks like a stock Shadertoy, push it further: layer, warp, quantise, outline.
