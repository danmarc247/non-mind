---
name: nonmind-design-system
description: Use for any NON-MIND visual or UI change. That covers picking a colour, writing Tailwind classes or HUD components, choosing a font, adding or tuning an animation or transition, styling a panel, button, meter, tooltip or card, putting text in 3D, and changing how palettes morph with stage, depth, link or family. Also use when reviewing a visual change for consistency. Do NOT use it for raw GLSL technique (see nonmind-shaders) or game rules (see nonmind-game-structure).
---

# NON-MIND design system

NON-MIND looks like a vivid abstract acrylic painting that you can play. There are three reference paintings, and they are the only visual source:
- **ref a**: impasto swirls of yolk, tangerine, magenta, teal and violet, laid down with palette-knife strokes.
- **ref b**: rings with white outlines on flat colour, in clusters.
- **ref c**: magenta and ultramarine splashes and drips on white.

Owner rules (verbatim intent): "BE VERY CONSISTENT WITH COLORS AND A PROPER DESIGN SYSTEM." "Slowly increasing and morphing color palettes that are a great visual language never seen before." "Change the palettes and shaders dynamically in the game with progress." "Make all animations soft, but relatively quick and satisfying." "Don't be boring." The ground is paper, the line is ink, and the accents are saturated acrylic. It is never a dark sci-fi UI.

## 1. Tokens (the only colours that exist)

Source of truth: `src/index.css` `@theme`. Mirrors of it: `src/gfx/mood.js` `PALETTE` (0..1 triples, for shaders) and `src/ui/type/tones.js` `TONES` (hex, for three.js and glyph text).

| token | hex | role |
|---|---|---|
| paper | #fbf6ec | ground, panel face, rims, halos, foam, flash target |
| paper-2 | #f3ead9 | second panel tone, wells, disabled face |
| ink | #1b1030 | outlines (3px), text, offset shadows, sea floor, stressor bodies |
| ink-2 | #3a2a5c | secondary text, muted labels |
| magenta | #ff2d7a | primary accent, selection ring, overwhelm splash A |
| ultra | #2a2bff | ultramarine, insight, XP, overwhelm splash B |
| yolk | #ffd21f | attention/coins, primary buttons, core glow, tier 5 |
| tangerine | #ff7a1a | somatic, repurpose |
| teal | #17b5a6 | vagal, integrate, healthy meters |
| violet | #8a3ffc | shadow, split, tier 4 |
| blood | #e3262f | limbic, subtract, danger |
| leaf | #2fbf4a | late-stage accent only |
| rose | #ff9ecf | relational, first breath of stage 0 |
| sky | #8fd3ff | thin washes, avoidance |

These colours are derived from the tokens and live in palette data, so they are allowed:
- mud `#5a4a52`, used only for low-link grading inside `families.js`
- the stage-palette tints in `stages.js` (`#f1e6d2`, `#fff3d6`, `#bff3ec`, ...)
- the post crimson `[0.55,0.04,0.18]`

**Rule:** never type a new hex literal in a component or shader. Use a token name (`tone="teal"`, `bg-yolk`, `PALETTE.magenta`, `toneHex('violet')`). If a colour you need does not exist, the answer is a mix of tokens (`color-mix(in srgb, var(--color-ink) 35%, transparent)`, `mix(uPaper, uA, k)`), not a new hex.

Semantic maps that already exist. Reuse them and never reinvent them:
- **Aspect tones** (`ASPECT_TONES` in `src/gfx/palettes/families.js`, and `ASPECTS[*].tone` in `data.js`):

  | aspect | tone |
  |---|---|
  | vagal | teal |
  | limbic | blood |
  | cortical | ultra |
  | somatic | tangerine |
  | shadow | violet |
  | relational | rose |
  | void | ink |
  | mythic | yolk |

- **Tier border** (UnitCard): 1 ink, 2 teal, 3 ultra, 4 violet, 5 yolk.
- **Operation buttons** (Inspector): integrate teal, subtract blood, split violet, repurpose tangerine.
- **Resources** (TopBar): attention yolk, insight ultra.

## 2. Palettes that morph

There are three layers. Each one is pure data plus pure functions.

### 2a. Stage palette: `src/gfx/palettes/stages.js`
- `STAGE_PALETTES` has 18 entries, one per stage (`00-appear` .. `17-overwhelm`). Each entry has:
  - `ground` and `ink`
  - five hue slots: `primary, secondary, tertiary, accent, glow`
  - scalars: `saturation` (0.22 to 1.3), `contrast` (0.8 to 1.28), `strokeDensity` (0.05 to 0.98)
  - `name` and `note`
- Invariants:
  - Neighbouring stages change **at most two hue slots**. 16 to 17 (the collapse to white) is the one allowed exception, at three slots.
  - The ground stays `#fbf6ec` through stage 11 and tints rose from stage 12 (`#f8e6de`, then `#f6e2da`). It goes pure white at 17.
  - Saturation and stroke density rise almost monotonically, and then collapse at 17.
- `mixStagePalette(t)`:
  - `t` is fractional, 0..17, and gets clamped.
  - Colours are lerped in **linear RGB** and returned as linear `[r,g,b]`.
  - Scalars are lerped too.
  - `id/name/note` come from the nearer stage.
  - `from`/`to` are the integer neighbours.
- Reading it for display: `p.primary.map(linearToSrgb)`. Scene does exactly this:
  ```js
  const p = mixStagePalette(Math.min(17, mood.stage + mood.overwhelm * 0.999 * (mood.stage >= 16 ? 1 : 0)));
  const s = (c) => c.map(linearToSrgb);
  u.uA.value.set(...s(p.primary)); u.uB.value.set(...s(p.secondary)); u.uC.value.set(...s(p.accent));
  ```
- Always drive it with the **eased** `mood.stage` (Scene's `Loop` eases at rate 0.8/s), never with the integer `G.stage`. The morph has to be slow and continuous; integer jumps are forbidden. Overwhelm pushes stage 16 toward 17 (the white collapse).

### 2b. Family palette and link grade: `src/gfx/palettes/families.js`
- `FAMILY_PALETTES[family] = { a: body, b: second, c: highlight }`. Each family's `colors` in `data.js` names the same tokens, for example reappraisal is teal + sky ("clear cool glass") and sublimation is yolk + magenta ("kiln fire").
- `LINK_GRADE[1..12]` is the ladder's visual arc:
  - link 1: raw, muddy, heavy, knotted (sat 0.45, mud 0.75)
  - links 6-7: saturated peak (sat 1.3-1.4, mud ~0)
  - link 12: simple, pale, luminous, nearly transparent (lightness +0.4, glow 1, translucency 0.9)
- `unitColors(familyId, link)` returns `{a,b,c}` (sRGB 0..1) plus `glow` and `translucency`. `sculpt.js` remaps the game link into a grade with `Math.round(4 + (link-1)*8/11)`, so a unit on the board never looks fully mud.
- Poles tint the colour: idealized (+1) lifts toward white by 45%, devalued (-1) darkens to 45%.

### 2c. Depth rotation (prestige)
- `PainterSky` rotates `STROKE_KEYS` (`yolk, tangerine, magenta, teal, violet, sky, rose, blood`) by `depth*3`, and the ring fills by `depth*2`. Each reset therefore leads with different colours that are still on-token.
- Audio does the same with key/mode (see nonmind-audio).

**When you add a visual element**, colour it from one of these sources:
1. the stage palette (for environmental things)
2. the family/link (for units)
3. aspect tones (for battle feedback)
4. fixed tokens (for UI chrome)

It should also respond to at least one of `mood.complexity`, `mood.stage` or `mood.depth`. A static element is a boring element.

## 3. Typography

| role | font | token / class | rules |
|---|---|---|---|
| title / logo / huge moments | Kablammo | `font-title` | Only for the title screen, stage-name flashes and endings. Uses a stacked offset text-shadow in magenta and ultra (`Title.jsx`). Never for body text. |
| headings, labels, buttons | Londrina Solid (400/900) | `font-head` | Uppercase button labels (InkButton does this for you). |
| outlined display | Londrina Outline | `font-outline` | Ghost numbers and the echo of a heading layered behind a solid one. |
| stats, numbers, costs, hotkeys | Hypermonosaturation | `font-stat` | **Lowercase only.** The face has no capitals: `.font-stat` forces `text-transform: lowercase`. Write `x1.7`, `tol 520`, `lat 1.0s`, never `TOL`. In Type3D pass `font="hyper"` (it lowercases). |
| body, flavour, koans, tooltips | Fraunces 400/400i/600 | `font-body` (default) | Italic for koans and the hints from `STAGES[].hint`. |

Typography libraries, already wired in `src/ui/type/` (import from `src/ui/type/index.js`):
- `PretextFlow` / `usePretextLines` (@chenglou/pretext): text layout that flows around shapes. Use it for long flavour text that wraps around a unit thumbnail.
- `Type3D` (three-text + harfbuzz, lazily loaded): extruded 3D words inside the R3F scene, for stage names and floating numbers.
- `GlyphTicker` (@pmndrs/glyph, MSDF, WebGPU canvas with a DOM fallback): ticking glyph numbers.
- `KoanFlash` (@andyed/kinetic-type-engine): RSVP-style kinetic flashes of koans, chunked at the ORP (`orp.js`).

Copy is confusing on purpose, but the type is always legible: the minimum size is 11px for `font-stat` and 13px for `font-head`. Overwhelm scrambles the *letters* (`Scr`), never the layout grid.

## 4. Motion

The rule is soft, quick and satisfying, with a little overshoot. The canonical constants are in `src/ui/hud/shared.jsx`:
```js
export const POP  = { type: 'spring', stiffness: 520, damping: 26, mass: 0.7 };   // default for everything that appears/moves
export const EASE = { duration: 0.22, ease: [0.2, 0.9, 0.3, 1.15] };              // tween with ~15% overshoot
```

| motion | duration | how |
|---|---|---|
| enter | 0.18-0.3 s | `Appear` (opacity 0 to 1, scale 0.94 to 1, 14px offset), using POP |
| exit | 0.14-0.15 s | `easeIn`. Exits are faster than entries. |
| press | 0.26 s | keyframes `scale: [1, 0.86, 1.07, 1]` at `times [0, .25, .65, 1]` (Bottom.jsx) |
| meter fill | spring | POP, with a darker ghost bar trailing to show what was lost |
| big reveal or title exit | 0.32 s max | ease `[0.4, 0, 0.2, 1]` |
| slow drift | 0.85 s | only for ambient, non-blocking movement (`[0.15, 0.8, 0.3, 1]`) |

3D motion (Scene.jsx) uses a frame-rate-independent exponential ease, never lerp-by-constant:
```js
const ease = (cur, tgt, dt, rate = 10) => cur + (tgt - cur) * (1 - Math.exp(-rate * dt));
```
- Positions use rate 16 and scale uses 12.
- `pop` decays at 7 and `flash` at 9.
- Fade-in uses 12 and fade-out uses 5.
- `mood.stage` eases at 0.8 and `mood.complexity` at 1.5. These two are slow on purpose, because they are the palette morph.

Born units start at scale 0.01 with `pop = 1` and `flash = 0.6`. Link, integrate and subtract set `pop = 1.4, flash = 0.9`, so the player *sees* the merge every time. Something should always be morphing, merging or splitting on screen.

Do not:
- run any UI transition longer than 0.35 s
- use linear easing on UI
- bounce more than about 15% overshoot
- run an infinite attention-seeking pulse on chrome (pulses are for the selected unit and for danger only)
- run CSS transitions on layout properties at 60 Hz

## 5. HUD components (`src/ui/bits`, documented in its README)

```jsx
import { Panel, InkButton, StatChip, Meter, Cryptic, UnitCard, Tooltip } from '../bits';
<Panel title="Habits" tone="teal">...</Panel>
<InkButton tone="yolk" size="md" hotkey="r" onClick={() => act('reroll')}>Reroll <span className="font-stat">2</span></InkButton>
<StatChip label="Insight" value={Math.floor(G.insight)} tone="ultra" hint="Spent on splits and spells." />
<Meter value={G.composure / G.composureMax} tone="teal" danger={G.composure < 30} label="composure" />
<Cryptic text={FAMILY[id].text} tone="magenta" />
<UnitCard name={nameOf(g)} tier={tierOf(g)} aspects={aspectsOf(g).map((a) => ({ name: ASPECTS[a].name, tone: ASPECTS[a].tone }))} cost={TIER_COST[t-1]} />
```
- The chrome look comes from three things: paper face, 3px ink border, and an offset ink shadow (`shadow-[1px_2px_0_0_var(--color-ink)]`, larger for panels). Rounded corners are 6-8px on chips and larger on panels.
- `GlowingEffect` (via `Panel glow`), `CanvasRevealEffect` and `ShaderLensBlur` each cost a listener or a GL context. Use one or two on screen at most.
- Wrap every region that should degrade under overwhelm in `<Shake seed=n>`, and wrap its text in `<Scr k=n>`. Both read `DegradeCtx`.
- Show a control only once its system is unlocked: `unlocked(G, 'split')` etc. Progressive reveal *is* the design. A locked feature is absent, not greyed out.
- Backgrounds (`src/ui/bits/backgrounds`, React Bits ports) are allowed only re-tinted to tokens, and only behind menus. Never behind the arena.

## 6. Contrast

- Text on paper or yolk/sky/rose/teal/tangerine faces is ink. Text on ink/ultra/violet/blood/magenta faces is paper. InkButton switches automatically; copy its rule for custom pieces.
- Never put magenta text on ultra or the reverse (it vibrates). Those two only meet as *paint* (splashes), not as type.
- Never put text below about 4.5:1. `ink-2` on `paper-2` is the lowest pair allowed.
- In 3D, a unit always has a paper rim (`uRim = PALETTE.paper`, fresnel) so it separates from the painted sea. Stressors use ink as their rim.

## 7. Forbidden

- New hex values, CSS named colours, or greys like `#888`, `zinc-*`, `slate-*`, `gray-*`, or `neutral-*`.
- Dark sci-fi UI: black backgrounds, neon-on-black, glassmorphism blur panels, HUD scanlines, cyan terminal text. (The audio-lab dev page is exempt; the game is not.)
- Slow animation: anything over 0.35 s on UI, spinners, or long fades that block input.
- Uppercase in `font-stat`, Kablammo in body text, and system fonts showing through.
- Static, unmorphing colour on a world element, and jumping palettes on integer stage changes.
- Using names, art or text from the reference games (Cultist Simulator, Dota Underlords, Realm Grinder, Book of Hours). Only their systems are remixed.

## 8. Review checklist

1. Is every colour a token, or a mix of tokens? `grep -n "#[0-9a-fA-F]\{6\}"` on your diff should only hit palette data files.
2. Does the element's colour come from stage, family/link, aspect or chrome tokens, and does it morph with `mood`?
3. Fonts in their roles, and stats in lowercase?
4. Do motions use POP/EASE or the exp `ease()`, with UI at 0.35 s or under?
5. Is it gated by `unlocked()` where it belongs to a system?
6. Does it survive overwhelm (wrapped in `Shake`/`Scr`, still readable)?
7. Would a screenshot of it look like part of the painting, rather than a web app on top of one?
