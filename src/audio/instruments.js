// NON-MIND audio — synthesized instruments. Every function schedules one
// note at absolute time `t` into `dest`, claims oscillators from the budget
// (returns false if denied), and disconnects all of its nodes once finished.

import { mulberry32 } from './util.js';

/** Shared toolbox: context, budget, noise buffer, waveforms, impulse builder. */
export function createKit(ctx, budget, seed = 1) {
  const sr = ctx.sampleRate;
  const rng = mulberry32(seed ^ 0x51f15e);
  // 2 s of white noise, reused by every noise source (random start offset).
  const noise = ctx.createBuffer(1, Math.floor(sr * 2), sr);
  const nd = noise.getChannelData(0);
  for (let i = 0; i < nd.length; i++) nd[i] = rng() * 2 - 1;

  // Soft pulse (duty 0.3) with gentle harmonic rolloff — "synth flute/sax".
  const N = 40;
  const re = new Float32Array(N), im = new Float32Array(N);
  for (let n = 1; n < N; n++) re[n] = ((2 / (n * Math.PI)) * Math.sin(n * Math.PI * 0.3)) / (1 + n * 0.08);
  const pulse = ctx.createPeriodicWave(re, im);

  const kit = {
    ctx, budget, noise, pulse, rng,
    /** Disconnect all nodes when the given source ends. */
    cleanup(src, nodes) {
      src.onended = () => {
        for (const n of nodes) {
          try { n.disconnect(); } catch (e) { /* already gone */ }
        }
        src.onended = null;
      };
    },
    osc(type, freq, t) {
      const o = ctx.createOscillator();
      if (type === 'pulse') o.setPeriodicWave(pulse);
      else o.type = type;
      o.frequency.setValueAtTime(freq, t);
      return o;
    },
    noiseSrc(t, dur) {
      const s = ctx.createBufferSource();
      s.buffer = noise;
      s.loop = true;
      s.start(t, rng() * 1.5);
      s.stop(t + dur);
      return s;
    },
    gain(v = 0) {
      const g = ctx.createGain();
      g.gain.value = v;
      return g;
    },
    filter(type, f, Q = 0.7) {
      const b = ctx.createBiquadFilter();
      b.type = type;
      b.frequency.value = f;
      b.Q.value = Q;
      return b;
    },
  };
  return kit;
}

/** Long, warm reverb impulse: decaying filtered noise, stereo-decorrelated. */
export function makeImpulse(ctx, seconds = 5.5, seed = 7, opts = {}) {
  const sr = ctx.sampleRate;
  const len = Math.floor(sr * seconds);
  const buf = ctx.createBuffer(2, len, sr);
  const pre = Math.floor(sr * (opts.predelay ?? 0.025));
  const fadeIn = sr * 0.06;
  for (let ch = 0; ch < 2; ch++) {
    const rng = mulberry32(seed * 31 + ch * 977);
    const d = buf.getChannelData(ch);
    let lp = 0;
    for (let i = 0; i < len; i++) {
      if (i < pre) { d[i] = 0; continue; }
      const t = (i - pre) / sr;
      const tn = t / seconds;
      // amplitude reaches -60 dB at the end
      const amp = Math.exp(-6.9 * tn) * Math.min(1, (i - pre) / fadeIn);
      // one-pole lowpass closing over time ("air absorption": tail gets darker)
      const a = 0.25 + 0.7 * Math.min(1, tn * 1.6) * (opts.dark ?? 1);
      lp = lp * a + (rng() * 2 - 1) * (1 - a);
      d[i] = lp * amp;
    }
  }
  return buf;
}

// ---------------------------------------------------------------------------
// Felt piano: 2-op FM (ratio 1, decaying index) + slightly inharmonic 2nd
// partial + optional sub-octave (limbic colour) + filtered-noise hammer.
export function piano(kit, dest, t, freq, o = {}) {
  const { ctx } = kit;
  const vel = o.vel ?? 0.7, dur = o.dur ?? 6, bright = o.bright ?? 0.8;
  const inharm = o.inharm ?? 0.0005, sub = o.sub ?? 0;
  const nOsc = 3 + (sub > 0.05 ? 1 : 0);
  const end = t + dur + 0.25;
  if (!kit.budget.request(t, end, nOsc, o.limit)) return false;

  const out = kit.gain(0);
  const peak = 0.3 * vel;
  out.gain.setValueAtTime(0, t);
  out.gain.linearRampToValueAtTime(peak, t + 0.014);
  out.gain.setTargetAtTime(peak * 0.4, t + 0.014, 0.35);
  out.gain.setTargetAtTime(0, t + 0.9, Math.max(0.3, dur / 5));

  const cut = Math.min(5200, freq * (3 + 3 * bright));
  const lp = kit.filter('lowpass', cut, 0.5);
  lp.frequency.setValueAtTime(cut, t);
  lp.frequency.setTargetAtTime(Math.max(300, cut * 0.45), t + 0.02, 1.2);

  const car = kit.osc('sine', freq, t);
  const mod = kit.osc('sine', freq, t);
  const mg = kit.gain(0);
  mg.gain.setValueAtTime(freq * 1.5 * bright * vel, t);
  mg.gain.setTargetAtTime(freq * 0.06, t, 0.16);
  mod.connect(mg).connect(car.frequency);
  car.connect(lp);

  const p2 = kit.osc('sine', freq * 2 * Math.sqrt(1 + inharm * 4), t);
  const p2g = kit.gain(0);
  p2g.gain.setValueAtTime(0.22 * bright, t);
  p2g.gain.setTargetAtTime(0, t, 0.45);
  p2.connect(p2g).connect(lp);

  const nodes = [out, lp, car, mod, mg, p2, p2g];
  const srcs = [car, mod, p2];
  if (sub > 0.05) {
    const s = kit.osc('sine', freq / 2, t);
    const sg = kit.gain(0);
    sg.gain.setValueAtTime(0, t);
    sg.gain.linearRampToValueAtTime(0.35 * sub, t + 0.05);
    sg.gain.setTargetAtTime(0, t + 0.05, dur / 4);
    s.connect(sg).connect(lp);
    nodes.push(s, sg);
    srcs.push(s);
  }
  // hammer: tiny bandpassed noise transient
  const h = kit.noiseSrc(t, 0.08);
  const hb = kit.filter('bandpass', Math.min(6000, freq * 3), 0.9);
  const hg = kit.gain(0);
  hg.gain.setValueAtTime(0.05 * vel, t);
  hg.gain.setTargetAtTime(0, t, 0.012);
  h.connect(hb).connect(hg).connect(out);
  kit.cleanup(h, [h, hb, hg]);

  lp.connect(out).connect(dest);
  for (const s of srcs) { s.start(t); s.stop(end); }
  kit.cleanup(car, nodes);
  return out;
}

// ---------------------------------------------------------------------------
// Wordless voice: 3 detuned saws (chorus) -> 3 parallel formant bandpasses,
// slow attack, vibrato fading in.
export function voice(kit, dest, t, freq, o = {}) {
  const vel = o.vel ?? 0.6, dur = o.dur ?? 6, attack = o.attack ?? 1.5;
  const formants = o.vowel || [800, 1150, 2900];
  const spread = o.spread ?? 2.5;
  const end = t + dur + 0.4;
  if (!kit.budget.request(t, end, 4, o.limit)) return false;

  const mix = kit.gain(0.33 * 3 / (1 + 2 * (o.side ?? 0.45)));
  const pre = kit.filter('lowpass', 3800, 0.5);
  mix.connect(pre);
  const out = kit.gain(0);
  const peak = 0.85 * vel;
  const rel = Math.min(2.5, dur * 0.4);
  out.gain.setValueAtTime(0, t);
  out.gain.linearRampToValueAtTime(peak * 0.3, t + attack * 0.4);
  out.gain.linearRampToValueAtTime(peak, t + attack);
  out.gain.setValueAtTime(peak, t + dur - rel);
  out.gain.setTargetAtTime(0, t + dur - rel, rel / 4);

  const lfo = kit.osc('sine', 4.4 + kit.rng() * 0.6, t);
  const lg = kit.gain(0);
  lg.gain.setValueAtTime(0, t);
  lg.gain.linearRampToValueAtTime(0, t + attack * 0.7);
  lg.gain.linearRampToValueAtTime(o.vibrato ?? 4.5, t + attack + 2.2);
  lfo.connect(lg);

  const nodes = [mix, pre, out, lfo, lg];
  const srcs = [lfo];
  // chorus: centre saw at full level, the two detuned copies quieter (o.side)
  // so their beating can never cancel the centre -> little amplitude flutter
  const det = [-spread, 0.3, spread * 0.85];
  const side = o.side ?? 0.45;
  det.forEach((d, k) => {
    const s = kit.osc('sawtooth', freq, t);
    s.detune.setValueAtTime(d, t);
    lg.connect(s.detune);
    if (k === 1) s.connect(mix);
    else {
      const sg = kit.gain(side);
      s.connect(sg).connect(mix);
      nodes.push(sg);
    }
    nodes.push(s);
    srcs.push(s);
  });
  const fg = [1.0, 0.55, 0.22], fq = o.formantQ || [3, 4, 5]; // low Q: vibrato barely modulates level
  formants.forEach((f, i) => {
    const bp = kit.filter('bandpass', f, fq[i]);
    const g = kit.gain(fg[i] * 1.9);
    pre.connect(bp).connect(g).connect(out);
    nodes.push(bp, g);
  });
  out.connect(dest);
  for (const s of srcs) { s.start(t); s.stop(end); }
  kit.cleanup(lfo, nodes);
  return out;
}

// ---------------------------------------------------------------------------
// Horn swell: 2 detuned saws through a lowpass whose cutoff follows the swell.
export function horn(kit, dest, t, freq, o = {}) {
  const vel = o.vel ?? 0.6, dur = o.dur ?? 6, spread = o.spread ?? 8;
  const cutoff = o.cutoff ?? 900;
  const end = t + dur + 0.1;
  if (!kit.budget.request(t, end, 2, o.limit)) return false;
  const att = dur * 0.45;
  const lp = kit.filter('lowpass', 160, 0.9);
  lp.frequency.setValueAtTime(160, t);
  lp.frequency.exponentialRampToValueAtTime(cutoff, t + att);
  lp.frequency.exponentialRampToValueAtTime(180, t + dur);
  const out = kit.gain(0);
  const peak = 0.13 * vel;
  out.gain.setValueAtTime(0, t);
  out.gain.linearRampToValueAtTime(peak, t + att);
  out.gain.linearRampToValueAtTime(peak * 0.6, t + dur * 0.75);
  out.gain.linearRampToValueAtTime(0, t + dur);
  const a = kit.osc('sawtooth', freq, t);
  const b = kit.osc('sawtooth', freq, t);
  a.detune.setValueAtTime(-spread, t);
  b.detune.setValueAtTime(spread, t);
  a.connect(lp); b.connect(lp);
  lp.connect(out).connect(dest);
  a.start(t); b.start(t); a.stop(end); b.stop(end);
  kit.cleanup(a, [a, b, lp, out]);
  return out;
}

// ---------------------------------------------------------------------------
// Pluck for the arpeggio ostinati: triangle or soft pulse, short envelope;
// optional detuned double (overwhelm) and bell partial (cortical colour).
export function pluck(kit, dest, t, freq, o = {}) {
  const vel = o.vel ?? 0.6, decay = o.decay ?? 0.12;
  const det = o.detune ?? 0, bell = o.bell ?? 0;
  const dbl = Math.abs(det) > 4;
  const n = 1 + (dbl ? 1 : 0) + (bell > 0.1 ? 1 : 0);
  const end = t + decay * 6 + 0.02;
  if (!kit.budget.request(t, end, n, o.limit)) return false;
  const out = kit.gain(0);
  const peak = 0.26 * vel;
  out.gain.setValueAtTime(0, t);
  out.gain.linearRampToValueAtTime(peak, t + (o.attack ?? 0.004));
  out.gain.setTargetAtTime(0, t + (o.attack ?? 0.004), decay);
  const a = kit.osc(o.wave || 'triangle', freq, t);
  a.detune.setValueAtTime(o.cents ?? 0, t);
  a.connect(out);
  const nodes = [out, a];
  const srcs = [a];
  if (dbl) {
    const b = kit.osc(o.wave || 'triangle', freq, t);
    b.detune.setValueAtTime((o.cents ?? 0) + det, t);
    const bg = kit.gain(0.7);
    b.connect(bg).connect(out);
    nodes.push(b, bg); srcs.push(b);
  }
  if (bell > 0.1) {
    const c = kit.osc('sine', freq * 4.01, t);
    const cg = kit.gain(0);
    cg.gain.setValueAtTime(0.35 * bell, t);
    cg.gain.setTargetAtTime(0, t, decay * 0.5);
    c.connect(cg).connect(out);
    nodes.push(c, cg); srcs.push(c);
  }
  out.connect(dest);
  for (const s of srcs) { s.start(t); s.stop(end); }
  kit.cleanup(a, nodes);
  return true;
}

/** Low "heartbeat"/thump: sine with a falling pitch. */
export function thump(kit, dest, t, o = {}) {
  const f0 = o.f0 ?? 90, f1 = o.f1 ?? 42, dur = o.dur ?? 0.35, vel = o.vel ?? 0.5;
  const end = t + dur + 0.05;
  if (!kit.budget.request(t, end, 1, o.limit)) return false;
  const s = kit.osc('sine', f0, t);
  s.frequency.exponentialRampToValueAtTime(f1, t + dur * 0.6);
  const g = kit.gain(0);
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(vel, t + 0.006);
  g.gain.setTargetAtTime(0, t + 0.01, dur / 4);
  s.connect(g).connect(dest);
  s.start(t); s.stop(end);
  kit.cleanup(s, [s, g]);
  return true;
}
