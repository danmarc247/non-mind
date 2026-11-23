// NON-MIND family palettes, link grading and aspect tones.
// Colours are sRGB hex strings. Pure data and pure functions, no imports.

// Each family: a = body, b = second colour, c = highlight.
export const FAMILY_PALETTES = {
  reappraisal:  { a: '#17b5a6', b: '#8fd3ff', c: '#fbf6ec' }, // clear cool glass
  suppression:  { a: '#1b1030', b: '#8a3ffc', c: '#2a2bff' }, // heavy dark
  rumination:   { a: '#e3262f', b: '#ff7a1a', c: '#ffd21f' }, // hot circular
  avoidance:    { a: '#8fd3ff', b: '#fbf6ec', c: '#ffffff' }, // pale distant
  attunement:   { a: '#ff9ecf', b: '#ffd21f', c: '#fbf6ec' }, // warm tender
  projection:   { a: '#8a3ffc', b: '#ff2d7a', c: '#fbf6ec' }, // sharp accusing
  dissociation: { a: '#fbf6ec', b: '#2a2bff', c: '#8fd3ff' }, // foggy absent
  sublimation:  { a: '#ffd21f', b: '#ff2d7a', c: '#fbf6ec' }, // kiln fire
  containment:  { a: '#ff7a1a', b: '#17b5a6', c: '#fbf6ec' }, // earthen bowl
  equanimity:   { a: '#2a2bff', b: '#ffd21f', c: '#8fd3ff' }, // open sky
};

// Morph from link 1 (raw, muddy, heavy, knotted) through the saturated middle
// (bright, clean) to link 12 (pale, luminous, nearly transparent, simple).
//   saturation   multiplier on HSL S
//   lightness    additive on HSL L (-0.2..0.4)
//   mud          0..1 mix toward MUD (#5a4a52)
//   glow         0..1
//   translucency 0..1
export const LINK_GRADE = [
  { n: 1,  saturation: 0.45, lightness: -0.20, mud: 0.75, glow: 0.00, translucency: 0.00, note: 'raw, muddy, heavy, knotted' },
  { n: 2,  saturation: 0.55, lightness: -0.15, mud: 0.60, glow: 0.02, translucency: 0.00, note: 'first press, still dull' },
  { n: 3,  saturation: 0.70, lightness: -0.10, mud: 0.45, glow: 0.05, translucency: 0.02, note: 'knots begin to loosen' },
  { n: 4,  saturation: 0.90, lightness: -0.05, mud: 0.30, glow: 0.10, translucency: 0.05, note: 'colour wakes' },
  { n: 5,  saturation: 1.10, lightness: 0.00,  mud: 0.18, glow: 0.20, translucency: 0.08, note: 'bright, forming' },
  { n: 6,  saturation: 1.30, lightness: 0.02,  mud: 0.10, glow: 0.35, translucency: 0.12, note: 'saturated peak begins' },
  { n: 7,  saturation: 1.40, lightness: 0.05,  mud: 0.05, glow: 0.50, translucency: 0.18, note: 'full chroma' },
  { n: 8,  saturation: 1.30, lightness: 0.10,  mud: 0.03, glow: 0.60, translucency: 0.30, note: 'lifting, lightening' },
  { n: 9,  saturation: 1.10, lightness: 0.18,  mud: 0.02, glow: 0.70, translucency: 0.45, note: 'pale begins, light passes through' },
  { n: 10, saturation: 0.90, lightness: 0.26,  mud: 0.00, glow: 0.80, translucency: 0.60, note: 'luminous, thinning' },
  { n: 11, saturation: 0.70, lightness: 0.34,  mud: 0.00, glow: 0.90, translucency: 0.75, note: 'nearly transparent' },
  { n: 12, saturation: 0.55, lightness: 0.40,  mud: 0.00, glow: 1.00, translucency: 0.90, note: 'simple, pale, luminous' },
];

export const ASPECT_TONES = {
  vagal:      '#17b5a6',
  limbic:     '#e3262f',
  cortical:   '#2a2bff',
  somatic:    '#ff7a1a',
  shadow:     '#8a3ffc',
  relational: '#ff9ecf',
  void:       '#1b1030',
  mythic:     '#ffd21f',
};

// ---- helpers (internal) ----

const MUD = [0x5a / 255, 0x4a / 255, 0x52 / 255];

const clamp = (x, lo, hi) => Math.min(hi, Math.max(lo, x));
const lerp = (a, b, t) => a + (b - a) * t;

function hexToRgb(hex) {
  let h = hex.replace('#', '');
  if (h.length === 3) h = h.split('').map((ch) => ch + ch).join('');
  const n = parseInt(h, 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

function rgbToHsl([r, g, b]) {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  let h = 0;
  let s = 0;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h /= 6;
  }
  return [h, s, l];
}

function hslToRgb([h, s, l]) {
  if (s === 0) return [l, l, l];
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const hue2 = (t) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  return [hue2(h + 1 / 3), hue2(h), hue2(h - 1 / 3)];
}

function shadeHex(hex, grade) {
  const [h, s0, l0] = rgbToHsl(hexToRgb(hex));
  const s = clamp(s0 * grade.saturation, 0, 1);
  const l = clamp(l0 + grade.lightness, 0, 1);
  const rgb = hslToRgb([h, s, l]);
  return rgb.map((v, i) => clamp(lerp(v, MUD[i], grade.mud), 0, 1));
}

// ---- public API ----

// Returns { a, b, c } as [r,g,b] arrays in 0..1 (sRGB), plus glow and translucency.
export function unitColors(familyId, link) {
  const palette = FAMILY_PALETTES[familyId];
  if (!palette) throw new RangeError(`unknown family: ${familyId}`);
  const n = Math.round(Number(link));
  if (!Number.isFinite(n)) throw new RangeError(`invalid link: ${link}`);
  const grade = LINK_GRADE[clamp(n, 1, LINK_GRADE.length) - 1];
  return {
    a: shadeHex(palette.a, grade),
    b: shadeHex(palette.b, grade),
    c: shadeHex(palette.c, grade),
    glow: grade.glow,
    translucency: grade.translucency,
  };
}
