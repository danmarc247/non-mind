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

/** Build the active scale for a prestige depth. */
export function makeScale(depth = 0) {
  const d = Math.max(0, Math.floor(depth || 0));
  const base = PALETTES[d % PALETTES.length];
  const cycle = Math.floor(d / PALETTES.length);
  // Beyond the first cycle: transpose by fifths (kept within a sane range) and brighten.
  let root = base.root + ((cycle * 7) % 12);
  if (root > 57) root -= 12;
  return {
    ...base,
    depth: d,
    root,
    intervals: MODES[base.mode],
    bright: base.bright * (1 + 0.08 * Math.min(cycle, 4)),
    detuneExtra: Math.min(cycle, 4) * 2,
  };
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
