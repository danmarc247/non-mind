---
name: nonmind-verify
description: Use before reporting any NON-MIND lane as done, and whenever a visual, UI, shader, audio, engine or deployment change needs proof - running a private dev server, taking Playwright headless Chromium screenshots with software WebGL, capturing console errors, running vitest and the headless bot simulation, rendering/measuring audio offline, checking the GitHub Pages build, or debugging failures such as cacheDir clashes, lygia include errors, blank canvases and port collisions.
---

# NON-MIND verification

Every lane proves its work. "It should work" is not a report. The proof is: screenshots you LOOKED at, zero console errors, tests green, measurements printed. Specialists never run git or npm; they run `npx vite`, `npx vitest`, `node` only.

## 0. Lane checklist

- [ ] Own gallery page exists at repo root (galleries are development-only: `vite build` ships `index.html` alone, so never link to them from the game or the README) (`<lane>-gallery.html` -> `src/.../galleries/<lane>.jsx` or `src/ui/<lane>/gallery.jsx`)
- [ ] Dev server on YOUR port with YOUR cache dir
- [ ] Screenshots taken and opened (Read the PNG), described in the report
- [ ] Console errors: 0 (page errors and `console.error`)
- [ ] Engine change: `npx vitest run` green AND bot sim healthy
- [ ] Audio change: offline render + measurements, not "sounds fine"
- [ ] After a push (mediator): deployed Pages build checked

## 1. Dev server on a private port

vite has no `--cacheDir` flag; `vite.config.js` reads `NM_CACHE_DIR`. Two servers sharing `node_modules/.vite` clash (optimizer lock, stale deps, "outdated optimize dep" 504s).

```bash
cd /home/user/non-mind
NM_CACHE_DIR=/tmp/nm-cache-sky npx vite --port 5181 --strictPort > /tmp/nm-sky.log 2>&1 &
sleep 4; curl -s -o /dev/null -w '%{http_code}\n' http://localhost:5181/sky-gallery.html   # expect 200
```

`--strictPort` makes a collision fail loudly instead of silently moving to 5182. Pick a port from the lane's brief. Stop your server when done: `kill %1` or `pkill -f 'port 5181'`.

## 2. Screenshot script (copy-paste)

Save as `/tmp/claude-0/-home-user/bc92351f-c73a-5da5-a249-f7cf1432bb3b/scratchpad/shot.cjs` (any scratch path, not in the repo):

```js
// usage: NODE_PATH=/opt/node-tools/node_modules node shot.cjs <url> <out.png> [waitMs] [w] [h]
const { chromium } = require('playwright');
(async () => {
  const [url, out, wait = '10000', w = '1280', h = '800'] = process.argv.slice(2);
  const browser = await chromium.launch({
    headless: true,
    args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
           '--ignore-gpu-blocklist', '--enable-webgl'],
  });
  const page = await browser.newPage({ viewport: { width: +w, height: +h } });
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  page.on('requestfailed', (r) => errors.push('requestfailed: ' + r.url() + ' ' + (r.failure() || {}).errorText));
  page.on('response', (r) => { if (r.status() >= 400) errors.push('http ' + r.status() + ': ' + r.url()); });
  await page.goto(url, { waitUntil: 'load' });
  await page.waitForTimeout(+wait);            // software WebGL: ~10 s before the shot
  await page.screenshot({ path: out });
  const frames = await page.evaluate(() => window.__frames || null);
  console.log(JSON.stringify({ out, frames, errorCount: errors.length, errors: errors.slice(0, 10) }, null, 2));
  await browser.close();
  process.exit(errors.length ? 1 : 0);
})();
```

Run:

```bash
NODE_PATH=/opt/node-tools/node_modules node shot.cjs http://localhost:5181/sky-gallery.html /tmp/sky-1.png 10000
```

Then **Read the PNG** and say what you see (colours, shapes, what moved, what is blank). Galleries should expose `window.__frames` (increment in a `useFrame`) so frames > 0 proves the loop ran; `window.__mood` to drive state.

## 3. Driving state between shots

```js
// inside the script, after goto + first wait
for (const o of [0, 0.5, 1]) {
  await page.evaluate((v) => { window.__mood.overwhelm = v; }, o);
  await page.waitForTimeout(2500);
  await page.screenshot({ path: `/tmp/sky-overwhelm-${o}.png` });
}
```

Take at least three states that should look different; if two PNGs are identical, the control is not wired.

## 4. Console-error capture only (no picture)

Reuse the script with a short wait; the exit code is the signal (`0` clean, `1` errors). Known noise to NOT dismiss silently: GPU/swiftshader warnings are `warning`, not `error`. A WebGL "context lost", shader compile error, 404 or "Failed to resolve import" are real errors.

## 5. Tests and the bot simulation (engine changes)

```bash
cd /home/user/non-mind && npx vitest run                     # tests/**/*.test.js, node env, must be green
node tests/game/balance.mjs | tail -40                       # 10 seeds x 5400 s balance probe
node -e "
import('./src/game/game.js').then(({ simulate }) => {
  for (const seed of [1,2,3]) {
    const G = simulate(1800, seed);
    const bad = Object.entries(G).filter(([k,v]) => typeof v === 'number' && !Number.isFinite(v));
    console.log({ seed, stage: G.stage, cycle: G.cycle, wave: G.wave, level: G.level,
                  affect: G.affect, units: G.units.length, nonFinite: bad.map(b=>b[0]) });
  }
})"
```

Healthy means: no exception, no NaN/Infinity (`nonFinite: []`), `stage` and `wave` advance with time, `units.length` is bounded, `affect` grows but not to `1e300` in 30 minutes. Compare against the numbers before your change; report the diff. A skipped test needs a log line, not silence (see the `[tests]` entry in `docs/team-log.md`).

## 6. Audio (offline renders and measurements)

Audio is verified by numbers, not listening. The harness renders through `OfflineAudioContext` in headless Chromium and asserts peak, RMS, DC offset, silence, spectral centroid, NaN and onset count.

```bash
cd /home/user/non-mind
NM_CACHE_DIR=/tmp/nm-cache-audio npx vite --port 5183 --strictPort > /tmp/nm-audio.log 2>&1 &
sleep 4
NODE_PATH=/opt/node-tools/node_modules node tests/audio/render.cjs http://localhost:5183 /tmp/nm-wavs
echo exit=$?     # 1 on any failed assertion
```

New SFX or instrument: add it to the renders, print its measurements (peak below 1.0, no DC, not silent, finite), and report the numbers. Moods used: `complexity`, `overwhelm`, `tension`, `stance`, `aspects`, `depth` (see `src/gfx/mood.js`).

## 7. Deployed build (GitHub Pages)

Pages serves under a sub-path (`/non-mind/`). `base: './'` makes assets relative, so **no absolute asset URLs** (`/fonts/x.woff2`, `url(/img.png)`, `fetch('/data.json')`). Use `import.meta.env.BASE_URL`-relative or `new URL('./x', import.meta.url)`.

Local check of the production build under a sub-path:

```bash
cd /home/user/non-mind && npx vite build && mkdir -p /tmp/nm-pages && rm -rf /tmp/nm-pages/non-mind && cp -r dist /tmp/nm-pages/non-mind
(cd /tmp/nm-pages && python3 -m http.server 5190 >/dev/null 2>&1 &) ; sleep 1
NODE_PATH=/opt/node-tools/node_modules node shot.cjs http://localhost:5190/non-mind/ /tmp/pages-local.png 12000
```

Live check after a push (mediator; allow a minute for the workflow):

```bash
gh run list --limit 3                       # latest Pages workflow succeeded?
NODE_PATH=/opt/node-tools/node_modules node shot.cjs https://danmarc247.github.io/non-mind/ /tmp/pages-live.png 15000
```

The script reports 4xx responses, which is exactly how absolute URLs show up (`http 404: https://danmarc247.github.io/fonts/...`). Look at the PNG: title visible, canvas not black.

## 8. Common failures and fixes

| Symptom | Cause | Fix |
|---|---|---|
| `504 Outdated Optimize Dep`, random import 404s, two servers misbehave | shared `node_modules/.vite` cacheDir | each server `NM_CACHE_DIR=/tmp/nm-cache-<lane>`; delete that dir if stale |
| `Port 5181 is in use` | someone holds it | `--strictPort` is correct; choose your assigned port, do not drift |
| Shader error "could not resolve lygia/..." or `#include` unresolved | wrong include path | use `#include "/lygia/generative/snoise.glsl"` (leading slash, glsl plugin `root: '/node_modules/'`); never `../lygia`, never `<lygia/...>` |
| lygia function undefined / redefined | missing or duplicate include; ES1 vs ES3 | include once per shader; check `src/gfx/glsl/sky.frag.glsl` header for the pattern |
| Black canvas, no error | not enough wait; or WebGL flags missing | wait ~10 s; use the swiftshader flags in section 2 |
| `Error creating WebGL context` | launch without flags | add `--use-gl=angle --use-angle=swiftshader --enable-unsafe-swiftshader --ignore-gpu-blocklist` |
| Frames stay 0 | Canvas `frameloop="demand"` or render error | check page errors; ensure a `useFrame` runs |
| `Cannot find module 'playwright'` | NODE_PATH missing | `NODE_PATH=/opt/node-tools/node_modules node script.cjs`; file must be `.cjs` |
| Works in dev, 404 in Pages | absolute asset URL | see section 7 |
| `@pmndrs/glyph` crashes the page | WebGPURenderer without fallback | must be lazy, own renderer with `forceWebGL`, soft-fail to DOM; see `nonmind-stack` |
| Peer-dependency install errors | React 19 vs older peers | mediator runs `npm i --legacy-peer-deps` |
| Tests import fails on `.glsl` | vitest config has no glsl plugin | engine tests import only `src/game/**`, never gfx |

## 9. What to put in the report

`Proved: shots /tmp/sky-overwhelm-{0,0.5,1}.png (opened: calm wash, banded, shredded), console errors 0, frames 212.` One line per proof; say what you SAW, not that a file exists.
