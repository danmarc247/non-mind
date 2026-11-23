// NON-MIND audio — small shared helpers: seeded RNG, math, music theory,
// per-depth palettes, and an oscillator budget used to cap polyphony.

/** Deterministic PRNG (mulberry32). Returns a function -> [0,1). */
export function mulberry32(seed) {
  let a = (seed >>> 0) || 0x9e3779b9;
  return function rng() {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const clamp = (x, a = 0, b = 1) => (x < a ? a : x > b ? b : x);
export const lerp = (a, b, t) => a + (b - a) * t;
export function smoothstep(e0, e1, x) {
  const t = clamp((x - e0) / (e1 - e0));
  return t * t * (3 - 2 * t);
}
export const midiToHz = (m) => 440 * Math.pow(2, (m - 69) / 12);
export const pick = (rng, arr) => arr[Math.floor(rng() * arr.length) % arr.length];

/** Exponential approach factor for a smoother with time constant tau over dt. */
export const approach = (dt, tau) => 1 - Math.exp(-Math.max(0, dt) / Math.max(1e-4, tau));

export const MODES = {
  ionian: [0, 2, 4, 5, 7, 9, 11],
  dorian: [0, 2, 3, 5, 7, 9, 10],
  phrygian: [0, 1, 3, 5, 7, 8, 10],
  lydian: [0, 2, 4, 6, 7, 9, 11],
  mixolydian: [0, 2, 4, 5, 7, 9, 10],
  aeolian: [0, 2, 3, 5, 7, 8, 10],
};

// Vowel formants (F1, F2, F3 in Hz) for the wordless voice.
export const VOWELS = {
  a: [800, 1150, 2900], // "aah"
  o: [480, 820, 2830], // "oh"
  u: [340, 700, 2700], // "ooh"
  e: [600, 1650, 2700], // open "eh"
};

/**
 * One palette per prestige depth (cycles every 8). Each shifts key, mode and
 * timbre so later runs sound different. root = MIDI note of "octave 0" tonic.
 * prog = 4 scale degrees for the arpeggio chord cycle; beats = chord lengths.
 */
export const PALETTES = [
  { name: 'F dorian', root: 53, mode: 'dorian', vowel: 'a', bright: 0.8, inharm: 0.0005, pluck: 'triangle', prog: [0, 6, 3, 4], beats: [16, 8, 8, 8], periodScale: 1.0 },
  { name: 'Db lydian', root: 49, mode: 'lydian', vowel: 'o', bright: 0.9, inharm: 0.0004, pluck: 'triangle', prog: [0, 1, 4, 5], beats: [8, 8, 16, 8], periodScale: 1.04 },
  { name: 'Ab mixolydian', root: 56, mode: 'mixolydian', vowel: 'u', bright: 0.7, inharm: 0.0008, pluck: 'pulse', prog: [0, 6, 3, 0], beats: [8, 8, 8, 8], periodScale: 0.97 },
  { name: 'C aeolian', root: 48, mode: 'aeolian', vowel: 'o', bright: 0.6, inharm: 0.0006, pluck: 'triangle', prog: [0, 5, 2, 6], beats: [16, 16, 8, 8], periodScale: 1.08 },
  { name: 'Eb ionian', root: 51, mode: 'ionian', vowel: 'a', bright: 1.0, inharm: 0.0003, pluck: 'pulse', prog: [0, 5, 3, 4], beats: [8, 8, 8, 8], periodScale: 0.95 },
  { name: 'G phrygian', root: 55, mode: 'phrygian', vowel: 'u', bright: 0.55, inharm: 0.0012, pluck: 'triangle', prog: [0, 1, 5, 6], beats: [16, 8, 16, 8], periodScale: 1.1 },
  { name: 'E lydian', root: 52, mode: 'lydian', vowel: 'e', bright: 1.1, inharm: 0.0004, pluck: 'pulse', prog: [0, 4, 1, 5], beats: [8, 16, 8, 16], periodScale: 1.0 },
  { name: 'D aeolian', root: 50, mode: 'aeolian', vowel: 'o', bright: 0.75, inharm: 0.0009, pluck: 'triangle', prog: [0, 3, 5, 4], beats: [16, 8, 8, 16], periodScale: 1.06 },
];

// Offset of each mode's tonic above its parent major key (semitones).
const MAJOR_OFFSET = { ionian: 0, dorian: 2, phrygian: 4, lydian: 5, mixolydian: 7, aeolian: 9 };
const NOTE = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];

/**
 * The ten wave identities. Each wave of a cycle has its own modal centre,
 * chord cycle, arpeggio figure and lead colour, so the player learns to
 * recognise it. The journey is written relative to the depth palette:
 *   k    = how many fifths the pitch collection sits above the palette's
 *          (never more than one accidental between neighbouring waves);
 *   mode = the mode taken inside that collection (null = the palette's own).
 * With the depth-0 palette (F dorian) the tonics run
 *   F  C  Eb  G  Bb  D  F  A  C  F   (every move a fifth or a third),
 * and wave 10 (F mixolydian) falls back to wave 1 (F dorian) on a common tonic.
 *   prog/beats = 4-chord cycle (scale degrees) and chord lengths in beats;
 *   cells      = pattern lengths of the five arpeggio voices; style = figure;
 *   feel       = 'straight' or 'dotted' (long-short pairs); group = accent every n steps;
 *   oct        = register shift; lead = which loop family leads; vowel; period = loop-length scale.
 */
export const WAVES = [
  { k: 0, mode: null, prog: null, beats: null, cells: [6, 8, 5, 7, 9], style: 'rise', feel: 'straight', group: 4, oct: 0, lead: 'piano', vowel: null, period: 1.0 },
  { k: 1, mode: 'dorian', prog: [0, 3, 6, 4], beats: [8, 8, 8, 8], cells: [5, 7, 6, 8, 9], style: 'wave', feel: 'straight', group: 5, oct: 0, lead: 'voice', vowel: 'o', period: 0.94 },
  { k: 1, mode: 'lydian', prog: [0, 1, 4, 1], beats: [16, 8, 16, 8], cells: [7, 5, 8, 6, 9], style: 'broken', feel: 'dotted', group: 3, oct: 1, lead: 'piano', vowel: 'e', period: 1.07 },
  { k: 2, mode: 'dorian', prog: [0, 2, 5, 3], beats: [8, 8, 8, 16], cells: [8, 6, 5, 9, 7], style: 'pedal', feel: 'straight', group: 4, oct: 0, lead: 'voice', vowel: 'a', period: 0.9 },
  { k: 2, mode: 'lydian', prog: [0, 4, 1, 5], beats: [8, 16, 8, 8], cells: [9, 7, 6, 5, 8], style: 'rise', feel: 'dotted', group: 6, oct: 0, lead: 'both', vowel: 'u', period: 1.03 },
  { k: 2, mode: 'aeolian', prog: [0, 5, 2, 6], beats: [16, 16, 8, 8], cells: [5, 8, 7, 6, 9], style: 'wave', feel: 'straight', group: 3, oct: -1, lead: 'voice', vowel: 'u', period: 1.12 },
  { k: 3, mode: 'lydian', prog: [0, 1, 5, 4], beats: [8, 8, 8, 8], cells: [6, 9, 5, 8, 7], style: 'broken', feel: 'straight', group: 7, oct: 1, lead: 'piano', vowel: 'a', period: 0.97 },
  { k: 3, mode: 'aeolian', prog: [0, 3, 5, 2], beats: [16, 8, 8, 8], cells: [7, 6, 9, 5, 8], style: 'pedal', feel: 'dotted', group: 4, oct: 0, lead: 'voice', vowel: 'e', period: 1.09 },
  { k: 2, mode: 'mixolydian', prog: [0, 6, 3, 0], beats: [8, 8, 16, 8], cells: [8, 5, 7, 9, 6], style: 'rise', feel: 'straight', group: 5, oct: 0, lead: 'piano', vowel: 'o', period: 0.92 },
  { k: 1, mode: 'mixolydian', prog: [0, 6, 4, 3], beats: [8, 8, 8, 8], cells: [9, 8, 7, 6, 5], style: 'wave', feel: 'dotted', group: 4, oct: 0, lead: 'both', vowel: 'a', period: 1.0 },
];

const scaleCache = new Map();
/**
 * Build the active scale/identity: prestige depth picks the palette, the
 * wave (1..10, or any integer: wraps) picks the identity above, and the
 * cycle transposes everything up a fourth per cycle and re-voices the
 * arpeggio registers (rev), so cycle 2 is not a repeat of cycle 1.
 * makeScale(d) alone is wave 1 / cycle 0 = the plain depth palette.
 * Results are cached: the same (depth, wave, cycle) is the same object.
 */
export function makeScale(depth = 0, wave = 1, cycle = 0) {
  const d = Math.max(0, Math.floor(depth || 0));
  const wi = (((Math.floor(wave || 1) - 1) % 10) + 10) % 10;
  const cy = Math.max(0, Math.floor(cycle || 0));
  const key = d + '|' + wi + '|' + cy;
  if (scaleCache.has(key)) return scaleCache.get(key);
  const base = PALETTES[d % PALETTES.length];
  const turn = Math.floor(d / PALETTES.length);
  // Beyond the first palette round: transpose by fifths (kept within a sane range) and brighten.
  let baseRoot = base.root + ((turn * 7) % 12);
  if (baseRoot > 57) baseRoot -= 12;
  const W = WAVES[wi];
  const mode = W.mode || base.mode;
  const parent = baseRoot - MAJOR_OFFSET[base.mode] + 7 * W.k + 5 * cy;
  // tonic of the wave's mode inside the shifted collection, folded next to the palette root
  let root = parent + MAJOR_OFFSET[mode];
  while (root > baseRoot + 5) root -= 12;
  while (root < baseRoot - 6) root += 12;
  const sc = {
    ...base,
    name: wi === 0 && cy === 0 ? base.name : NOTE[((root % 12) + 12) % 12] + ' ' + mode,
    depth: d, wave: wi + 1, cycle: cy, rev: cy % 3,
    root, mode,
    intervals: MODES[mode],
    prog: W.prog || base.prog,
    beats: W.beats || base.beats,
    vowel: W.vowel || base.vowel,
    periodScale: base.periodScale * W.period,
    cells: W.cells, style: W.style, feel: W.feel, group: W.group, octShift: W.oct, lead: W.lead,
    bright: base.bright * (1 + 0.08 * Math.min(turn, 4)) * (1 + 0.06 * W.oct),
    detuneExtra: Math.min(turn, 4) * 2,
  };
  if (scaleCache.size > 400) scaleCache.clear();
  scaleCache.set(key, sc);
  return sc;
}

/** Scale degree (any integer, may be negative) + octave -> MIDI note. */
export function degMidi(scale, deg, oct = 0) {
  const n = scale.intervals.length;
  const o = Math.floor(deg / n);
  const i = ((deg % n) + n) % n;
  return scale.root + 12 * (oct + o) + scale.intervals[i];
}
export const degHz = (scale, deg, oct = 0) => midiToHz(degMidi(scale, deg, oct));

/**
 * Oscillator budget. Every note registers [start, end, count]; a request is
 * denied if, at any instant within its lifetime, the total would exceed limit.
 * This keeps the engine under ~48 simultaneous oscillators deterministically,
 * also when notes are scheduled ahead of time.
 */
export class VoiceBudget {
  constructor(max = 48) {
    this.max = max;
    this.persistent = 0; // long-running oscillators (drones, LFOs, shepard)
    this.ev = [];
  }
  prune(now) {
    if (this.ev.length) this.ev = this.ev.filter((e) => e.e > now);
  }
  countAt(p) {
    let c = 0;
    for (const e of this.ev) if (e.s <= p && e.e > p) c += e.n;
    return c;
  }
  peak(s, e) {
    let m = this.countAt(s);
    for (const ev of this.ev) if (ev.s > s && ev.s < e) m = Math.max(m, this.countAt(ev.s));
    return m + this.persistent;
  }
  request(s, e, n, limit = this.max) {
    if (this.peak(s, e) + n > limit) return false;
    this.ev.push({ s, e, n });
    return true;
  }
}
