// Shared palette helpers for the NON-MIND HUD bits.
// Hex values mirror the @theme tokens in src/index.css (needed for WebGL / canvas).

export const TONE_HEX = {
  paper: '#fbf6ec',
  'paper-2': '#f3ead9',
  ink: '#1b1030',
  'ink-2': '#3a2a5c',
  magenta: '#ff2d7a',
  ultra: '#2a2bff',
  yolk: '#ffd21f',
  tangerine: '#ff7a1a',
  teal: '#17b5a6',
  violet: '#8a3ffc',
  blood: '#e3262f',
  leaf: '#2fbf4a',
  rose: '#ff9ecf',
  sky: '#8fd3ff',
};

export const TONES = Object.keys(TONE_HEX);

/** CSS value for a tone (theme variable with a hex fallback). */
export function toneVar(tone, fallback = 'ink') {
  const t = TONE_HEX[tone] ? tone : fallback;
  return `var(--color-${t}, ${TONE_HEX[t]})`;
}

/** Hex for a tone (for canvas / WebGL). */
export function toneHex(tone, fallback = 'ink') {
  return TONE_HEX[tone] || TONE_HEX[fallback];
}

/** [r, g, b] 0..255 for a tone. */
export function toneRgb(tone, fallback = 'ink') {
  const h = toneHex(tone, fallback).slice(1);
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
}

/** rgba() string for a tone at a given alpha. */
export function toneRgba(tone, alpha = 1, fallback = 'ink') {
  const [r, g, b] = toneRgb(tone, fallback);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

// Tones that need dark ink text on top of them; the rest take paper text.
const LIGHT_TONES = new Set(['paper', 'paper-2', 'yolk', 'tangerine', 'teal', 'leaf', 'rose', 'sky']);

/** Readable text color (CSS value) to place on a solid tone. */
export function inkOn(tone) {
  return LIGHT_TONES.has(tone) ? toneVar('ink') : toneVar('paper');
}

/** Tier (1..5) to tone, used by UnitCard borders. */
export const TIER_TONE = { 1: 'ink', 2: 'teal', 3: 'ultra', 4: 'violet', 5: 'yolk' };
