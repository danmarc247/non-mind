// NON-MIND stage palettes.
// Eighteen stages of living acrylic: colour grows, morphs, then collapses.
// Hue slots: primary, secondary, tertiary, accent, glow.
// Neighbouring stages change at most two hue slots. The 16 -> 17 collapse
// is the one deliberate exception: it changes three slots.
// Ground stays warm paper through stage 11 and tints from stage 12.

export const HUE_SLOTS = ['primary', 'secondary', 'tertiary', 'accent', 'glow'];
const COLOUR_FIELDS = ['ground', 'ink', ...HUE_SLOTS];
const SCALAR_FIELDS = ['saturation', 'contrast', 'strokeDensity'];

export const STAGE_PALETTES = [
  {
    id: '00-appear', name: 'Dry Rosewash',
    ground: '#fbf6ec', ink: '#1b1030',
    primary: '#ff9ecf', secondary: '#f1e6d2', tertiary: '#e6d6bb', accent: '#dccbb0', glow: '#fff3d6',
    saturation: 0.22, contrast: 0.8, strokeDensity: 0.05,
    note: 'Almost bare paper, a single rose breath touching the canvas before anything has decided to become a colour.',
  },
  {
    id: '01-explore', name: 'Thin Sky',
    ground: '#fbf6ec', ink: '#1b1030',
    primary: '#ff9ecf', secondary: '#8fd3ff', tertiary: '#e6d6bb', accent: '#dccbb0', glow: '#fff3d6',
    saturation: 0.3, contrast: 0.82, strokeDensity: 0.12,
    note: 'A thin sky wash arrives beside the rose, the first hint that the surface has more than one voice.',
  },
  {
    id: '02-grow', name: 'Magenta Breath',
    ground: '#fbf6ec', ink: '#1b1030',
    primary: '#ff2d7a', secondary: '#8fd3ff', tertiary: '#ffd21f', accent: '#dccbb0', glow: '#fff3d6',
    saturation: 0.4, contrast: 0.86, strokeDensity: 0.2,
    note: 'Magenta takes the lead and yolk flickers in, as if the paint has started to notice its own warmth.',
  },
  {
    id: '03-combine', name: 'Teal Hush',
    ground: '#fbf6ec', ink: '#1b1030',
    primary: '#ff2d7a', secondary: '#8fd3ff', tertiary: '#ffd21f', accent: '#17b5a6', glow: '#fff3d6',
    saturation: 0.5, contrast: 0.9, strokeDensity: 0.28,
    note: 'Teal creeps into the edges, cool and quiet, balancing the heat already on the surface.',
  },
  {
    id: '04-repurpose', name: 'Ultra Pulse',
    ground: '#fbf6ec', ink: '#1b1030',
    primary: '#ff2d7a', secondary: '#2a2bff', tertiary: '#ffd21f', accent: '#17b5a6', glow: '#fff1a8',
    saturation: 0.6, contrast: 0.94, strokeDensity: 0.35,
    note: 'Ultramarine deepens the sky and a yolk glow lifts from within, the first real pulse of light.',
  },
  {
    id: '05-increase', name: 'Tangerine Seep',
    ground: '#fbf6ec', ink: '#1b1030',
    primary: '#ff2d7a', secondary: '#2a2bff', tertiary: '#ff7a1a', accent: '#17b5a6', glow: '#fff1a8',
    saturation: 0.7, contrast: 0.98, strokeDensity: 0.42,
    note: 'Tangerine seeps into the yolk\'s place, and the whole field begins to hum like a struck bell.',
  },
  {
    id: '06-regroup', name: 'Violet Ember',
    ground: '#fbf6ec', ink: '#1b1030',
    primary: '#ff2d7a', secondary: '#2a2bff', tertiary: '#ff7a1a', accent: '#8a3ffc', glow: '#fff1a8',
    saturation: 0.78, contrast: 1.02, strokeDensity: 0.5,
    note: 'Violet ember settles into the accent slot, warm and bruised, colour now holding its own weight.',
  },
  {
    id: '07-expand', name: 'Blood Tide',
    ground: '#fbf6ec', ink: '#1b1030',
    primary: '#e3262f', secondary: '#2a2bff', tertiary: '#ff7a1a', accent: '#8a3ffc', glow: '#bff3ec',
    saturation: 0.86, contrast: 1.06, strokeDensity: 0.56,
    note: 'A blood tide rises beneath the magenta, a darker heat, while the glow cools toward teal.',
  },
  {
    id: '08-ingest', name: 'Leaf Rumour',
    ground: '#fbf6ec', ink: '#1b1030',
    primary: '#e3262f', secondary: '#2a2bff', tertiary: '#2fbf4a', accent: '#8a3ffc', glow: '#bff3ec',
    saturation: 0.94, contrast: 1.09, strokeDensity: 0.62,
    note: 'Green rumours through the tertiary slot, leaf arriving unannounced where orange used to sit.',
  },
  {
    id: '09-support', name: 'Sky Fracture',
    ground: '#fbf6ec', ink: '#1b1030',
    primary: '#e3262f', secondary: '#8fd3ff', tertiary: '#2fbf4a', accent: '#8a3ffc', glow: '#e3d2ff',
    saturation: 1.0, contrast: 1.12, strokeDensity: 0.68,
    note: 'Sky fractures back into the secondary slot, and the palette splits into a cool half and a hot half.',
  },
  {
    id: '10-evoke', name: 'Tangerine Bloom',
    ground: '#fbf6ec', ink: '#1b1030',
    primary: '#ff7a1a', secondary: '#8fd3ff', tertiary: '#2fbf4a', accent: '#8a3ffc', glow: '#e3d2ff',
    saturation: 1.06, contrast: 1.15, strokeDensity: 0.74,
    note: 'Tangerine blooms again at the front, a warmer lead over a cool sky and a green undertow.',
  },
  {
    id: '11-interchange', name: 'Yolk Drift',
    ground: '#fbf6ec', ink: '#1b1030',
    primary: '#ff7a1a', secondary: '#8fd3ff', tertiary: '#ffd21f', accent: '#8a3ffc', glow: '#ffd6ea',
    saturation: 1.1, contrast: 1.18, strokeDensity: 0.78,
    note: 'Yolk drifts into the tertiary and rose glows faintly, the palette loosening into softness.',
  },
  {
    id: '12-evoke-2', name: 'Rose Veil',
    ground: '#f8e6de', ink: '#1b1030',
    primary: '#ff2d7a', secondary: '#8fd3ff', tertiary: '#ffd21f', accent: '#2fbf4a', glow: '#ffd6ea',
    saturation: 1.14, contrast: 1.2, strokeDensity: 0.82,
    note: 'The paper finally takes a rose tint, and the accent turns to leaf green beneath the veil.',
  },
  {
    id: '13-inhabit', name: 'Leaf Current',
    ground: '#f8e6de', ink: '#1b1030',
    primary: '#ff2d7a', secondary: '#2a2bff', tertiary: '#ffd21f', accent: '#2fbf4a', glow: '#c9f5d2',
    saturation: 1.18, contrast: 1.22, strokeDensity: 0.86,
    note: 'Ultramarine returns to the secondary and the glow turns green, a deep and faintly electric mix.',
  },
  {
    id: '14-sustain', name: 'Violet Wound',
    ground: '#f8e6de', ink: '#1b1030',
    primary: '#ff2d7a', secondary: '#2a2bff', tertiary: '#8a3ffc', accent: '#e3262f', glow: '#c9f5d2',
    saturation: 1.22, contrast: 1.24, strokeDensity: 0.9,
    note: 'Violet and blood enter the tertiary and accent, and the palette starts to bruise and ring at once.',
  },
  {
    id: '15-penetrate', name: 'Teal Sprawl',
    ground: '#f6e2da', ink: '#1b1030',
    primary: '#ff2d7a', secondary: '#2a2bff', tertiary: '#2fbf4a', accent: '#e3262f', glow: '#17b5a6',
    saturation: 1.26, contrast: 1.26, strokeDensity: 0.94,
    note: 'Teal sprawls into the glow while leaf takes the tertiary, a crowd of hues pressing outward.',
  },
  {
    id: '16-embrace', name: 'Full Chord',
    ground: '#f6e2da', ink: '#1b1030',
    primary: '#ff2d7a', secondary: '#2a2bff', tertiary: '#2fbf4a', accent: '#ffd21f', glow: '#17b5a6',
    saturation: 1.3, contrast: 1.28, strokeDensity: 0.98,
    note: 'Full chord: magenta, ultramarine, leaf, yolk and teal all sounding at maximum saturation.',
  },
  {
    id: '17-overwhelm', name: 'Collapse Splash',
    ground: '#ffffff', ink: '#1b1030',
    primary: '#ff2d7a', secondary: '#2a2bff', tertiary: '#ffe3f0', accent: '#c7c8ff', glow: '#ffffff',
    saturation: 1.0, contrast: 1.0, strokeDensity: 0.3,
    note: 'Everything collapses back to white, leaving magenta and ultramarine splashes that drip across the blank.',
  },
];

// Helpers. hexToRgb returns sRGB-encoded channels in 0..1.
export function hexToRgb(hex) {
  const s = hex.replace('#', '');
  const full = s.length === 3 ? s.split('').map((c) => c + c).join('') : s;
  const n = parseInt(full, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => v / 255);
}

export function srgbToLinear(c) {
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

export function linearToSrgb(c) {
  return c <= 0.0031308 ? c * 12.92 : 1.055 * Math.pow(c, 1 / 2.4) - 0.055;
}

function hexToLinear(hex) {
  return hexToRgb(hex).map(srgbToLinear);
}

function lerp(a, b, f) {
  return a + (b - a) * f;
}

// Returns the palette at fractional stage t (0..17). Colours are interpolated
// in linear RGB and returned as linear [r,g,b] arrays in 0..1; apply
// linearToSrgb per channel for display. Text fields come from the nearer stage.
export function mixStagePalette(t) {
  const last = STAGE_PALETTES.length - 1;
  const x = Math.min(last, Math.max(0, Number.isFinite(t) ? t : 0));
  const i0 = Math.floor(x);
  const i1 = Math.ceil(x);
  const f = x - i0;
  const a = STAGE_PALETTES[i0];
  const b = STAGE_PALETTES[i1];
  const nearest = f < 0.5 ? a : b;

  const out = { t: x, from: i0, to: i1, id: nearest.id, name: nearest.name, note: nearest.note };
  for (const key of COLOUR_FIELDS) {
    const A = hexToLinear(a[key]);
    const B = hexToLinear(b[key]);
    out[key] = A.map((v, k) => lerp(v, B[k], f));
  }
  for (const key of SCALAR_FIELDS) {
    out[key] = lerp(a[key], b[key], f);
  }
  return out;
}
