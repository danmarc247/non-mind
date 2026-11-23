---
name: nonmind-stack
description: Use when writing or reviewing NON-MIND code that touches a library or rendering approach - React 19, React Three Fiber, drei, Three.js ShaderMaterial, Shader Park, lygia, postprocessing, React Bits backgrounds, PixiJS v8, GSAP, marked, Motion, Tailwind v4, Pretext, three-text, @pmndrs/glyph, kinetic-type-engine, Web Audio - or when deciding whether and how to add a new dependency. Lists what each library is for here, file pointers, how to add one, and gotchas. Web technologies only.
---

# NON-MIND stack

Web technologies only (browser, no native, no server). Game logic is pure JS in `src/game/**` (no React, no three); rendering, UI and audio read state and call `actions`. Hosting is GitHub Pages under a sub-path with `base: './'`.

## Install rule

Only the **mediator** installs packages or edits `package.json`, `vite.config.js`, `vitest.config.js`. Install command: `npm i --legacy-peer-deps` (React 19 vs peer ranges). Specialists who need a package log `[tag] <lane> -> mediator: need <pkg>@<ver> for <reason>` and keep going with a stub.

## Library map

| Library | Used for | Where |
|---|---|---|
| React 19, react-dom | all UI | `src/App.jsx`, `src/main.jsx` |
| @react-three/fiber (R3F) v9 | the 3D scene and gallery canvases, `useFrame` loop | `src/gfx/Scene.jsx`, `src/gfx/galleries/*.jsx` |
| @react-three/drei | `OrbitControls`, helpers in galleries and scene | `src/gfx/galleries/sky.jsx` |
| three (classic WebGLRenderer) | geometry, `ShaderMaterial`, units' genome-to-shader pipeline | `src/gfx/PainterSky.jsx`, `src/gfx/sculpt.js` |
| Shader Park (`shader-park-core`) | SDF sculpting of unit bodies | `src/gfx/sculpt.js` |
| lygia | GLSL noise/colour/math library | `src/gfx/glsl/*.glsl` (`sky.frag.glsl`, `sea.frag.glsl`) |
| postprocessing + @react-three/postprocessing | post stack (kuwahara, grade, overwhelm, relief) | `src/gfx/PainterPost.jsx`, `src/gfx/glsl/post.*` |
| React Bits backgrounds (raw WebGL2, no OGL dependency) | shader backgrounds, one tiny GL context each | `src/ui/bits/backgrounds/**` |
| PixiJS v8 | the Lineage map, one lazy Application only while the modal is open | `src/ui/lineage/scene.js`, `src/ui/Lineage.jsx` |
| GSAP | timelines for the Ceremony overlays (built, not yet mounted) | `src/ui/Ceremony.jsx` |
| marked | renders `README.md` as the in-game Manual | `src/ui/Manual.jsx` |
| Motion (`motion`) | React component transitions, presence, layout animation | `src/ui/hud/Inspector.jsx`, `Title.jsx`, `TopBar.jsx` |
| Tailwind v4 (`@tailwindcss/vite`) | utility classes; tokens live in `src/index.css` | `src/index.css`, HUD components |
| Pretext (`@chenglou/pretext`) | measure and flow text around shapes without DOM reflow | `src/ui/type/PretextFlow.jsx` |
| three-text | real 3D extruded text in the scene | `src/ui/type/Type3D.jsx`, `type3dEngine.js` |
| @pmndrs/glyph | GPU glyph ticker | `src/ui/type/GlyphTicker.jsx`, `glyphTickerRuntime.js` |
| kinetic-type-engine | rhythmic text reveal (ORP timing) | `src/ui/type/KoanFlash.jsx` (component name kept), `orp.js` |
| Web Audio API | adaptive music, SFX, offline renders | `src/audio/{engine,instruments,music,sfx,lab,util}.js` |
| simplex-noise | cheap CPU noise | `src/ui/bits/WavyBackground.jsx` |
| `useSyncExternalStore` (React) | game store: a plain mutable `game` object plus a version counter, no store library | `src/game/store.js` |
| harfbuzzjs, woff-lib, @fontsource/* | font baking and self-hosted fonts | `scripts/bake-fonts.mjs`, `public/fonts/` |
| vite-plugin-glsl | `#include` resolution for `.glsl` imports | `vite.config.js` |

## Contracts you must respect

- `src/gfx/mood.js`: mutable object, written by the game loop each frame, read inside `useFrame` / audio ticks. Never put it in React state; never replace the object, mutate fields.
- `src/game/index.js`: game API. UI reads state, calls `actions.*`, never mutates state.
- `src/index.css`: palette tokens and fonts. Do not hard-code hex in components when a token exists.

## Gotchas

**Three / R3F**
- The Canvas is `linear legacy flat`: every shader writes display sRGB itself (convert palettes with `linearToSrgb`).
- R3F 9 `applyProps` copies a `uniforms` prop into new uniform objects, so writing `u.uTime.value` on the object you passed never reaches the GPU. Write to `material.uniforms.*.value` on the live material (keep a ref, or build the `ShaderMaterial` yourself and pass `material={...}`).
- Use `ShaderMaterial` on the classic WebGLRenderer. Do not move the main scene to WebGPU.
- Per-frame work goes in `useFrame` and mutates uniforms (`mat.uniforms.uTime.value = ...`); React state per frame will tank the frame rate.
- Dispose geometries, materials and render targets on unmount; galleries get remounted by HMR.
- Colour: set `uniforms` in the colour space the shader expects; `#include <colorspace_fragment>` is used in `Type3D.jsx`, keep one pattern per material.

**lygia**
- Include as `#include "/lygia/generative/snoise.glsl"` (leading slash). vite-plugin-glsl is configured with `root: '/node_modules/'`, so this resolves to `node_modules/lygia/...`. Relative paths and angle brackets fail.
- Include each file once; lygia functions are guarded but your own duplicates are not. Prefer small includes (`generative/`, `math/`, `color/`) over the whole library to keep compile time down.

**Shader Park**
- It generates GLSL from a JS function. Keep the sculpt function pure and cache the compiled result per genome; recompiling every frame stalls.

**postprocessing**
- The chain is one `EffectPass` per effect with `mergeMode="none"` (Kuwahara, Relief with the detachment stage inside it, Bloom, Grade, Overwhelm); custom effects need unique uniform names. Test with the post gallery (`post-gallery.html`).

**React Bits backgrounds**
- Each background owns a raw WebGL2 context. Mount at most one or two at a time; unmount on route change. Respect `src/ui/bits/backgrounds/README.md` (license note).

**PixiJS v8**
- Async init (`await app.init({...})`); create the app in an effect, destroy on cleanup (`app.destroy(true)`), and guard the double-mount in React StrictMode. The Lineage scene is imported lazily (about 600 kB raw, 180 kB gzip) so it never enters the entry chunk.

**GSAP / Motion**
- GSAP for imperative timelines, Motion for declarative React transitions; do not animate the same property with both. Kill timelines on unmount.

**Pretext / three-text**
- Pretext needs fonts loaded first (`document.fonts.ready`) or measurements are wrong. three-text needs the baked font files under `public/fonts/`; reference them relatively.

**@pmndrs/glyph**
- Needs its OWN `WebGPURenderer` created with `forceWebGL: true`, in its own canvas, never sharing the main R3F renderer. Load with dynamic `import()` (lazy), wrap in try/catch, and soft-fail to a DOM fallback. See `GlyphTicker.jsx`. A failure here must never break the game.

**kinetic-type-engine**
- Feed it plain strings from `src/game/content/**`; timing helpers in `orp.js`.

**Web Audio**
- Create the `AudioContext` only after a user gesture (autoplay policy); resume on first click. Everything must be renderable through `OfflineAudioContext` for the measurement harness (no reliance on `AudioWorklet` files with absolute URLs).
- Keep SFX one-shots cheap: build nodes, schedule, let them garbage-collect; avoid per-frame node creation.

**Tailwind v4**
- No `tailwind.config.js`; theme tokens come from CSS (`@theme` in `src/index.css`). Use `cn()` (clsx + tailwind-merge) for conditional classes.

**Vite**
- `base: './'`: no leading-slash asset URLs in JS, CSS or HTML. `public/` files are referenced relatively.
- Multi-page galleries are plain root HTML files served by the dev server (`npm run dev`, then open `/<name>-gallery.html`). `vite build` uses only `index.html`, so the galleries are development-only and absent from the deployed site.
- `vite-plugin-singlefile` is installed but not enabled in `vite.config.js`.
- `server.host: true`, default port 5173; lanes override with `--port <n> --strictPort` and `NM_CACHE_DIR`.

## How to add a library (mediator checklist)

1. Need logged by the lane. Check it is a web technology, maintained, compatible with React 19 and three 0.187.
2. `npm i --legacy-peer-deps <pkg>`; commit `package.json` and `package-lock.json` alone.
3. If it has WASM/workers/fonts, confirm assets resolve relatively under `base: './'`.
4. Smoke test in a gallery page (see `nonmind-verify` sections 1-2); if it can fail on a device, lazy-load it and soft-fail.
5. Add a row to the Library map above and tell the lane in the log: `[tN] mediator -> <lane>: <pkg> installed; import as ...`.
6. Run `npx vite build` once and check bundle size and the Pages sub-path build.

## Choosing the tool

- 3D object with its own shading: R3F mesh + `ShaderMaterial` (+ lygia).
- Full-screen look: postprocessing pass, not a CSS filter.
- Decorative moving backdrop behind UI: a background from `src/ui/bits/backgrounds`.
- 2D graph or dense particles over the HUD: a lazy PixiJS layer (see Lineage).
- Text that must read: DOM + Pretext. Text that is a spectacle: three-text or glyph, with DOM fallback.
- UI enter/exit: Motion. Multi-step choreography: GSAP.
- Anything audible: Web Audio through `src/audio/engine.js`; add instruments in `instruments.js`, one-shots in `sfx.js`.

## Gallery pages (one per lane, for isolated proof)

| Page (repo root) | Entry | Shows |
|---|---|---|
| `sky-gallery.html` | `src/gfx/galleries/sky.jsx` | PainterSky + mood sliders + test spheres |
| `post-gallery.html` | `src/gfx/galleries/post.jsx` | PainterPost passes |
| `scene-gallery.html` | `src/gfx/galleries/scene.jsx` | arena and unit forms |
| `type-gallery.html` | `src/ui/type/gallery.jsx` | Pretext, three-text, glyph, kinetic type |
| `bits-gallery.html`, `bits-backgrounds.html` | `src/ui/bits/gallery.jsx` | HUD kit and React Bits backgrounds |
| `audio-lab.html` | `src/audio/lab.js` | audio lab and offline render page |
| `arena-`, `fx-`, `drift-`, `sea-`, `sculpt-gallery.html` | `src/gfx/galleries/*.jsx` | arena parts, paint fx, floating bodies, the contained sea, every sculpture form |
| `lineage-gallery.html`, `save-gallery.html`, `hud-gallery.html` | `src/ui/galleries/*.jsx`, `src/ui/hud/gallery.jsx` | Lineage map, save menu, HUD panels |

New lane: copy `sky-gallery.html` (it is 10 lines: root div + one module script), point it at `src/<area>/galleries/<lane>.jsx`, and in the entry expose `window.__frames` and any state object you want the screenshot script to drive.

## Typical code patterns

Uniform update without React state:

```jsx
useFrame((_, dt) => {
  mat.current.uniforms.uTime.value += dt;
  mat.current.uniforms.uOverwhelm.value = mood.overwhelm;   // mood is a plain mutable object
});
```

Lazy, soft-failing optional renderer (shape used for glyph):

```jsx
const [Comp, setComp] = useState(null);
useEffect(() => { import('./GlyphTicker.jsx').then((m) => setComp(() => m.default)).catch(() => setComp(false)); }, []);
return Comp ? <Comp text={t} /> : <span>{t}</span>;   // DOM fallback when it fails or is loading
```

GLSL include header:

```glsl
#include "/lygia/generative/snoise.glsl"
#include "/lygia/generative/random.glsl"
```

## Review questions for any stack change

- Does it run with software WebGL (swiftshader)? If not, does it fail soft?
- Does anything use an absolute URL?
- Does it add a per-frame allocation or a React state update per frame?
- Is a second WebGL context created, and is it disposed?
- Did it add a dependency without the mediator?
