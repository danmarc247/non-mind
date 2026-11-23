// Palette mirror of the @theme tokens in src/index.css, for places that need raw
// hex values (three.js uniforms, glyph text colors). DOM components prefer the CSS vars.
export const TONES = {
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

/** Tone name -> hex. Anything that is not a tone name is passed through as a CSS color. */
export function toneHex(tone, fallback = TONES.magenta) {
  if (!tone) return fallback;
  return TONES[tone] ?? tone;
}

/** Tone name -> `var(--color-x)` (falls back to the hex / raw CSS color). */
export function toneCss(tone, fallback = 'magenta') {
  const name = tone || fallback;
  return TONES[name] ? `var(--color-${name}, ${TONES[name]})` : name;
}
