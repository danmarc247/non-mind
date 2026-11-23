---
name: nonmind-audio
description: Use when adding, changing or reviewing any NON-MIND sound or music in src/audio. That includes the generative score (Eno-style Airports loops, Glass-style Floe arpeggios), mood-to-music mapping, instruments, SFX recipes and names, mapping game events to sounds in src/App.jsx, HRTF spatialisation, loudness and voice budgets, the reset collapse, and offline-render measurement in tests/audio.
---

# NON-MIND audio

Owner intent:
- All audio is procedural Web Audio and spatial, with no samples, no libraries and no network.
- The simple state sounds like early Brian Eno (*Music for Airports*: asynchronous loops of different lengths).
- As complexity rises it turns into Philip Glass's *Floe*: interlocking arpeggios and horn swells.
- "The sounds should fit, the music should be great."

Every SFX is pitched to the current mode, so the whole game is one harmony.

## 1. Files and graph

| file | role |
|---|---|
| `engine.js` | `createAudioEngine(ctx, {seed})`: graph, mood smoothing, lookahead scheduler, `reset()`, `getLevels()`, `at()`. `getAudio()` is the lazy singleton with `unlock()`. |
| `music.js` | `createMusic(E)`: Airports loops, Floe voices and horns, drone, breath, heartbeat, Shepard. `schedule(tEnd, now)` and `control(T, dt)`. |
| `instruments.js` | `createKit`, `makeImpulse`, and the instruments `piano, voice, horn, pluck, thump`. |
| `sfx.js` | `SFX_NAMES`, `createSfx(E)` with the `begin()` helper (`X.tone`, `X.noise`, `X.hz`), `HIT`/`CAST_TINT` aspect flavours, `resetGesture`. |
| `util.js` | `mulberry32`, `approach`, `MODES`, `VOWELS`, per-depth `PALETTES`, `makeScale`, `degHz`, `VoiceBudget`. |
| `lab.js` + `/audio-lab.html` | Manual test bench: sliders for every mood field, every SFX, a spectrum, debug output. |

The signal flow (from the header of engine.js):
- Music voices go through per-voice HRTF panners into `airDry/airRev` or `floeDry/floeRev`, then into the convolver (5.6 s impulse).
- Drone, breath and Shepard go to `musicDry`. The relational ping-pong delay feeds back into the music sum.
- The music sum then runs: clean or tanh drive → tilt shelves (220 Hz / 3.2 kHz) → collapse lowpass → duck → `musicGain`.
- SFX go through an optional HRTF panner into `sfxDry` plus their own 2.4 s reverb, then `sfxGain`. SFX are never ducked by the music collapse.
- The master runs: mute → DynamicsCompressor (-20 dB, 3.5:1) → makeup 1.15 → soft-clip WaveShaper (linear below 0.6, endpoints < 0.9) → Analyser → out.

## 2. Mood contract (from `Scene.jsx` `Loop`, every frame)

```js
a.setListener({ position: cam.position.toArray(), forward: f.toArray(), up: cam.up.toArray() });
a.setMood({ complexity: mood.complexity, overwhelm: mood.overwhelm, tension: mood.tension, depth: G.depth, stance: G.stance });
Object.assign(mood.audio, a.getLevels());   // low/mid/high/rms feed back into shaders
```
`setMood` also accepts `aspects: {vagal..mythic: 0..1}`. The engine smooths everything:
- complexity, τ 2 s
- overwhelm, τ 1.2 s rising and 0.8 s falling
- stance and aspects, τ 3 s

Before `start()`, values snap, which keeps offline renders deterministic. A **depth** change rebuilds `E.scale = makeScale(depth)`.

## 3. Mood → layers (the musical mapping)

| parameter | effect (in `music.control` / `schedule`) |
|---|---|
| complexity 0 | **Airports only**. 8 loops with incommensurate periods `17.3 … 33.7 s` (±3% jitter, × `periodScale`). Each holds 1-3 piano notes or 1-2 voice notes from `FAVOURED` degrees. Each orbits the listener on its own 45-135 s period, at radius 6-14. |
| complexity ↑ | Airports gain `1 - 0.5·smoothstep(.3,1,c) - .25·o` fades. Floe bus `smoothstep(.05,.3,c)`. **Horns** enter at c > 0.06-0.28 on each chord start. **5 arpeggio voices** enter at thresholds `0.22, 0.36, 0.5, 0.64, 0.78`, with pattern lengths 6/8/5/7/9 (+0..3 additive process every M cycles), so they phase against each other. |
| overwhelm | Tempo `30/(132+36·o)` s per eighth (132 to 168 bpm). Detune and doubled plucks. Filter cut `2400+5200·o`. Saturation mix `0.6·o²`. Two **extra 16th voices** (11 and 13 notes) at o > 0.22/0.5 when c > 0.4. **Shepard-Risset rise** (6 sines, gain `0.06·o^1.4`), killed after 4 s at o ≈ 0. The heartbeat speeds up. Horn cutoff and spread grow. |
| tension | Drone (root + fifth, -1 oct) gain `0.045·ten`, LP `300+500·ten`. |
| depth | `PALETTES[depth % 8]`: F dorian, Db lydian, Ab mixolydian, C aeolian, Eb ionian, G phrygian, E lydian, D aeolian. Each sets vowel, brightness, inharmonicity, pluck wave, 4-chord `prog` and `beats`. After 8 depths it transposes by fifths, gets brighter and more detuned. |
| stance toward | Loops pulled to triad tones, "oh" vowel, darker high shelf, +lo shelf. |
| stance away | Sparser (30% skip), more reverb, wider orbits, slower voice attack. |
| stance against | Brighter (+4 dB high shelf), pulse waves, harder attack, less reverb. |
| aspect vagal | 7 s breath noise swell |
| aspect limbic | Piano sub-octave, +low shelf |
| aspect cortical | Bell partial on plucks, brighter filters |
| aspect somatic | Heartbeat thumps at `54+30·o` bpm |
| aspect shadow | Drone fifth bends toward a tritone, darker |
| aspect relational | Ping-pong delay send `0.35·w` (0.43 / 0.61 s) |
| aspect void | Sparser, more reverb, wider |
| aspect mythic | Choir companion a fifth up, added 7th in the horns |

**Reset** (`engine.reset()`, the "non-mind" collapse):
- Duck to -70 dB (τ 0.42), and the collapse LP falls to 160 Hz by 1.7 s.
- `resetGesture`: a 6 kHz → 150 Hz whoosh, a sub implosion at 70 → 38 Hz, then **one pure sine** at the tonic.
- At 4.2 s the duck recovers. Airports regrow from a single piano loop at +4.4 s, then the others one by one (every 5.5 s plus jitter). The Floe is silenced and its additive state reset.

## 4. Instrument recipes (`instruments.js`)

Each instrument schedules at absolute time `t`, requests oscillators from the budget (and returns `false` when denied), and disconnects its nodes `onended`.
- **piano** (felt): 2-op FM (ratio 1, decaying index), a slightly inharmonic 2nd partial, an optional sub (limbic), and a filtered-noise hammer.
- **voice** (wordless): 3 detuned saws → 3 parallel formant bandpasses from `VOWELS` (a/o/u/e), a slow attack and fade-in vibrato.
- **horn**: 2 saws at ±spread cents → a lowpass that sweeps 160 → cutoff → 180 Hz with the swell (attack 45% of dur), peak `0.13·vel`.
- **pluck**: triangle or soft `pulse` PeriodicWave (duty 0.3, rolled-off harmonics), with an optional detuned double and a ×4.01 bell partial.
- **thump**: a sine falling f0 → f1. Used for the heartbeat.

A new instrument follows the same signature, `(kit, dest, t, freq, o) → boolean`. Build it from `kit.osc / kit.gain / kit.filter / kit.noiseSrc`, call `kit.cleanup(src, nodes)`, and pass `o.limit`.

## 5. SFX: names, recipes, event map

`SFX_NAMES`: attend, buy, sell, reroll, pickup, place, merge, integrate, subtract, split, repurpose, hit, cast, death, enemyDeath, waveStart, waveWin, waveLose, upgrade, verbStart, verbDone, decay, unlock, error, hover, overwhelmPulse, stanceChoose, reset.

Naming: camelCase verbs or events, named after **what happened in the game**, not after the sound ("merge", not "chime2"). Adding one means:
1. Add it to `SFX_NAMES`.
2. Add the recipe to the `S` object in `sfx.js`.
3. Map the event to it in `App.jsx`.
4. Add a button in the lab, which happens automatically from `SFX_NAMES`.

Recipe idioms (pitched via `X.hz(degree, octave)` so they sit in the current mode):
- **attend**: a marimba tone whose degree walks up with rapid clicks (`attend.step` up to 14, relaxing after 0.15 s). This is the auto-clicker's rising scale.
- **merge** (link up): three detuned tones gliding into unison, then an octave.
- **integrate**: two tones beating into near-unison, then locking.
- **subtract**: a saw through two sweeping notches. Something is removed from the sound.
- **split**: one tone forks a fourth up and a fifth down.
- **repurpose**: a tone glides down a 12th into a square-wave ticking (becoming a habit).
- **hit**: an aspect flavour from `HIT[aspect]`.
  - vagal: soft low thud
  - limbic: hot triangle
  - cortical: glassy high partials
  - somatic: kick
  - shadow: filtered square
  - relational: a double tap
  - void: a noise swell with big reverb
  - mythic: a bell
- **cast**: a noise riser plus an arpeggio from `CAST_TINT[aspect]`.
- **waveWin**: arpeggiated tonic, 9 cents detuned.
- **waveLose**: a falling minor triad.
- **unlock/upgrade**: rising fifths.
- **error**: a low tritone dyad, kept dry.

Event map (`src/App.jsx`). Game events come from `G.events`, delivered through `onEvent`:
```js
const SFX = { attend:'attend', waveStart:'waveStart', waveWin:'waveWin', waveLose:'waveLose', link:'merge', integrate:'integrate',
  subtract:'subtract', split:'split', repurpose:'repurpose', death:'death', enemyDeath:'enemyDeath', cast:'cast', stage:'unlock',
  level:'upgrade', verbStart:'verbStart', verbDone:'verbDone', mood:'decay', stance:'stanceChoose', ending:'unlock', mirror:'unlock', spell:'cast' };
```
Special cases:
- `reset` calls `a.reset()`.
- `{type:'sfx', name}` (emitted by the engine for buy/reroll/place/upgrade/error/decay) plays that name directly.
- `hit` is throttled to one per **45 ms** with `intensity = min(1, 0.3 + amt·2)` plus the aspect.

Unmapped today, and candidates if a sound would help:
- `strike`, `beat`, `miss`, `coreHit`, `unitNew`, `unitGone`
- the HUD-only names `sell`, `pickup`, `hover`, `overwhelmPulse`

Every call is wrapped in `try`, because sound must never break the game.

## 6. Spatialisation rules

- The listener is the camera, updated every frame.
- Positional SFX pass `position: [e.x, 0.75, e.z]` (sim x/z, fixed unit height). Only events that carry `x` are spatial. UI and economy sounds stay non-positional, centred.
- SFX panner: HRTF, inverse distance, refDistance 4, rolloff 0.8.
- Music panner: refDistance 6, maxDistance 200.
- Airports loops orbit the listener slowly, each on its own period.
- Floe voices sit on a ring of radius 5.5 (0.8× for the extra voices) and drift. Height follows octave.
- The two horns sit left-front and right-front at radius 7, breathing ±0.15 rad.
- Away and void widen every orbit (`rMul`).
- Never hard-pan with StereoPanner for world sounds. Use `PannerNode` so it follows the camera orbit.

## 7. Loudness and budget targets (enforced by `tests/audio/render.cjs`)

- Music renders: **peak < 1.0**, **RMS between -32 and -10 dBFS**, |DC| < 0.01, no NaN.
- Oscillators at most **48** in total (`VoiceBudget(48)`). Music may use 40 (`MUSIC_LIMIT`), and SFX get the rest. Persistent oscillators (drone 2, Shepard 6) count via `budget.persistent`.
- The full render must have clearly more onsets (×2) and a higher spectral centroid (×1.2) than simple. Mid must have more onsets than simple.
- Reset: post-collapse RMS below 0.5× of pre, and at most 3 onsets during the collapse.
- Same seed gives an identical render, and a different seed gives a different one.
- SFX:
  - audible: peak > 0.005
  - peak < 1
  - must end: tail RMS < 1e-3
  - duration ≤ 1.6 s (reset ≤ 8 s)
- Soak: the live node count does not grow, and fewer than 20 nodes remain connected after `dispose()`.
- Taste: SFX sit about 6 dB under the music in busy moments. Hits are short (≤ 0.4 s) and never harsh above 6 kHz for long. Nothing is a pure beep without an envelope (minimum attack 3-4 ms, setTargetAtTime decays).

## 8. Offline render workflow

```bash
cd /home/user/non-mind
NM_CACHE_DIR=$SCRATCH/vite-audio npx vite --port 5183 --strictPort &     # private port + cache (see nonmind-verify)
node tests/audio/render.cjs http://localhost:5183 $SCRATCH/audio        # prints table, writes WAVs, exit 1 on failure
```
- This launches headless Chromium (Playwright, `--autoplay-policy=no-user-gesture-required`) and opens `tests/audio/render.html`, which exposes `window.__audioTest`.
- It renders 6 moods × 40 s through `OfflineAudioContext(2, 44100·40, 44100)`: `simple`, `mid`, `full`, `reset@20`, `depth3-away`, `against+asp`.
- It prints peak / rms / rmsDb / dc / silent% / centroid / onsets / notes / NaN / maxOsc for each, then renders every SFX and a soak.
- Offline mode steps with `ctx.suspend()` every 0.1 s. For a scripted change, use `engine.at(time, fn)`, for example `[{t:20, reset:true}, {t:20.1, mood:{complexity:0}}]`.
- Add a render case to `RENDERS` when you add a layer, and add an assertion when you add a rule.
- **Listen** to the WAVs (simple 0-30 s, full 0-30 s, reset 10-40 s), or at least inspect the numbers, before handing back.
- For quick manual checks use `/audio-lab.html`: the sliders, a spectrum, and `debug()` showing scale, osc count and smoothed c/o.

## 9. Do / don't

Do:
- Pitch everything through `X.hz` / `degHz(E.scale, …)`.
- Schedule on `ctx.currentTime` plus lookahead, never against wall-clock time in music.
- Use `G.rng`-style seeded `rng` (`mulberry32`), never `Math.random`.
- Clean up every node.
- Keep layers additive and slow-crossfaded (linearRamp to T in `control`).
- Make complexity *audible as structure* (more voices and interlocking), not just louder.

Don't:
- Use samples, audio libraries, or a fetch.
- Use `setInterval` timing inside music beyond the engine's scheduler.
- Exceed the budget, or bypass `budget.request` (only the reset tone is exempt).
- Duck SFX with the music.
- Use abrupt gain jumps (always ramp or setTarget).
- Use loud stingers on frequent events.
- Copy recognisable melodies from Eno or Glass. Remix the *process* (loop phasing, additive arpeggios), never the notes.
