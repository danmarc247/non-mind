# NON-MIND HUD bits

A small HUD kit for the paper-and-ink acrylic look: warm paper panels, 3px ink outlines,
offset ink shadows, saturated accents. Everything is plain JSX + Tailwind v4 theme tokens
from `src/index.css`. Import from `src/ui/bits` (the `backgrounds/` folder is separate).

```jsx
import { Panel, InkButton, StatChip, Meter, Cryptic, UnitCard, Tooltip } from './ui/bits';
```

`tone` everywhere is one of the theme colour names:
`paper, paper-2, ink, ink-2, magenta, ultra, yolk, tangerine, teal, violet, blood, leaf, rose, sky`.

Gallery: `npx vite`, then open `/bits-gallery.html`.

## Kit wrappers (`kit.jsx`)

### `Panel`
TextureCard paper panel with a brush-stroke heading and an optional pointer-tracking glow border.

| prop | type | default | notes |
|---|---|---|---|
| `title` | node | – | heading in `font-head`; omit for a headless panel |
| `tone` | tone | `'magenta'` | heading dot, brush stroke and glow colour |
| `glow` | bool | `false` | mounts `GlowingEffect` (one body `pointermove` listener; use on a few panels, not every card) |
| `children` | node | – | body |
| `className` | string | – | outer wrapper (size / placement) |
| `bodyClassName` | string | – | body padding / layout |
| `actions` | node | – | right-aligned nodes in the heading row |

### `InkButton`
Chunky painted key (TextureButton `paint` variant).

| prop | type | default | notes |
|---|---|---|---|
| `tone` | tone | `'yolk'` | face colour; text switches ink/paper for contrast |
| `size` | `'sm' \| 'md' \| 'lg'` | `'md'` | |
| `disabled` | bool | `false` | hatched, faded, no press, `onClick` suppressed |
| `pressed` | bool | `false` | latched "held down" look + `aria-pressed` |
| `onClick` | fn | – | |
| `hotkey` | string | – | small badge on the top-right corner (rendered lowercase, `font-stat`) |
| `children` | node | – | label (rendered uppercase) |
| `className` | string | – | applied to the wrapper span |
| `...rest` | | | forwarded to the `<button>` |

### `StatChip`
| prop | type | default | notes |
|---|---|---|---|
| `label` | node | – | tiny uppercase label |
| `value` | node | – | `font-stat` value (lowercase-only face) |
| `tone` | tone | `'ultra'` | colour swatch on the left edge |
| `hint` | node | – | wraps the chip in a `Tooltip` |
| `className` | string | – | |

### `Meter`
Horizontal meter with a wobbly SVG outline (`feTurbulence` + `feDisplacementMap`); the fill springs to
new values and a darker ghost bar trails behind to show what was just lost.

| prop | type | default | notes |
|---|---|---|---|
| `value` | number 0..1 | `0` | clamped |
| `tone` | tone | `'teal'` | fill colour |
| `label` | node | – | |
| `danger` | bool | `false` | blood fill, pulsing hatch, red label |
| `showValue` | bool | `true` | percentage on the right |
| `format` | `(v) => node` | – | custom value text |
| `className` | string | – | |

### `Cryptic`
EncryptedText reveal for flavour text; re-scrambles whenever `text` changes.

| prop | type | default |
|---|---|---|
| `text` | string | – |
| `className` | string | – |
| `tone` | tone | `'magenta'` (colour of the scrambled glyphs) |
| `revealDelayMs` | number | `28` |
| `flipDelayMs` | number | `60` |

### `UnitCard`
Shop / bench card built on CardSpotlight. The WebGL dot-matrix reveal mounts **only while hovered**
(one context at a time); at rest a card costs no GL context.

| prop | type | default | notes |
|---|---|---|---|
| `name` | string | – | `font-head`, truncated |
| `tier` | 1..5 | `1` | border colour: 1 ink, 2 teal, 3 ultra, 4 violet, 5 yolk |
| `aspects` | `{ name, tone }[]` | `[]` | coloured dots with labels |
| `cost` | node | – | yolk coin, bottom-right, `font-stat` |
| `stars` | 0..5 | `0` | painted yolk dots, bottom-left |
| `selected` | bool | `false` | lifted, magenta ring |
| `dim` | bool | `false` | faded / desaturated, click disabled |
| `onClick` | fn | – | makes the card a focusable `role="button"` (Enter / Space) |
| `children` | node | – | mounted in the square thumbnail slot (e.g. a live WebGL thumbnail) |
| `reveal` | bool | `true` | set `false` to skip the hover dot matrix |
| `className` | string | – | |

### `Tooltip`
Lightweight hover/focus tooltip (no Radix). Rendered in a portal with `position: fixed`, so it is not
clipped by scrolling parents. Paper card, max-width 320px, `pointer-events: none`.

| prop | type | default | notes |
|---|---|---|---|
| `content` | node | – | nothing renders when `null`/`false` |
| `children` | node | – | trigger (wrapped in an inline-flex span) |
| `side` | `'top' \| 'bottom' \| 'left' \| 'right'` | `'top'` | |
| `open` | bool | – | force open/closed (controlled); omit for hover |
| `className` | string | – | tooltip card |

## Ports

Each source component is ported to its own file with TypeScript and `"use client"` removed, props APIs
kept, and the default styling moved from dark/zinc to paper/ink. Additions and changes:

- `GlowingEffect`: `tone` prop (single-colour glow); default gradient uses the palette; `variant="white"` / `"ink"` draw ink.
- `EncryptedText`: default classes ink; scrambled glyphs repaint on every flip.
- `TextGenerateEffect`: re-runs when `words` changes; `staggerDelay` prop.
- `MovingBorder` / `MovingBorderButton` (exported from the file as `Button` too): `tone` prop.
- `NoiseBackground`: the remote `noise.webp` is replaced by an inline SVG grain (`GRAIN_URL`); size is cached instead of measured each frame.
- `CardSpotlight`: `tone`, `revealColors`, `reveal` props; dot matrix mounts only on hover.
- `CanvasRevealEffect`: `tone` and `dpr` props; capped DPR, low-power context.
- `WavyBackground`: sized to its container via `ResizeObserver` (no `window.onresize` override); `waveCount` prop.
- `TextureCard` (+ Header/Title/Description/Content/Footer/Separator/Styled): `tone` tints the outline.
- `TextureButton`: `tone` prop for `accent`, new `paint` variant, `innerClassName`.
- `MinimalCard` (+ Image/Title/Description/Content/Footer): `next/image` replaced by `<img>`; `MinimalCardImage` accepts children when no `src`.
- `NeumorphButton`: new `intent="tone"` + `tone` prop.
- `ShaderLensBlur`: jotai atom and next-themes removed; config is props (`variation, color1..4, enableHover, invertMouse, isDarkMode, width, height, showHint`). Guarded a zero-width `smoothstep` edge (undefined in GLSL) and starts the lens at the centre.

Performance notes: `CanvasRevealEffect` and `ShaderLensBlur` each own a WebGL context; keep them to one
or two on screen. `GlowingEffect` adds a body-level pointer listener per instance.

## Attribution

- **Aceternity UI** (https://ui.aceternity.com), by Manu Arora: GlowingEffect, EncryptedText,
  TextGenerateEffect, MovingBorder, NoiseBackground, CardSpotlight, CanvasRevealEffect, WavyBackground.
  The registry files carry no licence header; the site describes the free components as "Free for any
  React or Next.js project". Its licence page (https://ui.aceternity.com/licence) sets out the
  "Aceternity License": end products are permitted, but the items or their source files may not be
  redistributed as such or sold on a marketplace, even when modified.
- **Cult UI** (https://www.cult-ui.com), source https://github.com/nolly-studio/cult-ui: TextureCard,
  TextureButton, MinimalCard, NeumorphButton, ShaderLensBlur. MIT License, Copyright (c) 2023 Jordan-Gilliam.
