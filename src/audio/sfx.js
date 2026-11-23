// NON-MIND audio — procedural one-shot sound effects. All synthesized, all
// pitched to the current mode (E.scale) so they harmonize with the music,
// optionally HRTF-positioned. Each sfx builds a tiny graph, and every node is
// disconnected when its last source ends.

import { degHz, clamp, mulberry32 } from './util.js';

export const SFX_NAMES = [
  'attend', 'buy', 'sell', 'reroll', 'pickup', 'place', 'merge', 'integrate',
  'subtract', 'split', 'repurpose', 'hit', 'cast', 'death', 'enemyDeath',
  'waveStart', 'waveWin', 'waveLose', 'upgrade', 'verbStart', 'verbDone',
  'decay', 'unlock', 'error', 'hover', 'overwhelmPulse', 'stanceChoose', 'reset',
];

const SFX_LIMIT = 48;

export function createSfx(E) {
  const { ctx, kit, bus } = E;
  const rng = mulberry32((E.seed ^ 0xa11ce) >>> 0);
  const attend = { step: 0, last: -10 };

  /** Per-call context: output (gain -> optional panner -> dry + reverb). */
  function begin(o = {}) {
    const t = ctx.currentTime + 0.012;
    const I = clamp(o.intensity ?? 0.6);
    const out = kit.gain(0.35 + 0.65 * I);
    const nodes = [out];
    let tail = out;
    if (o.position) {
      const p = ctx.createPanner();
      p.panningModel = 'HRTF';
      p.distanceModel = 'inverse';
      p.refDistance = 4;
      p.rolloffFactor = 0.8;
      const [x, y, z] = o.position;
      if (p.positionX) {
        p.positionX.setValueAtTime(x, t);
        p.positionY.setValueAtTime(y, t);
        p.positionZ.setValueAtTime(z, t);
      } else p.setPosition(x, y, z);
      out.connect(p);
      tail = p;
      nodes.push(p);
    }
    const rev = kit.gain(o.rev ?? 0.25);
    tail.connect(bus.sfxDry);
    tail.connect(rev).connect(bus.sfxRev);
    nodes.push(rev);
    const k = Math.pow(2, (o.pitch ?? 0) / 12);
    const X = {
      t, I, k, out, revGain: rev, last: null, lastEnd: -1,
      hz: (deg, oct = 0) => degHz(E.scale, deg, oct) * k,
      track(src, end) { if (end > X.lastEnd) { X.lastEnd = end; X.last = src; } },
      /** Enveloped oscillator. env: a (attack), tau (decay), hold, peak. */
      tone(f, t0, dur, e = {}) {
        const end = t0 + dur;
        if (!kit.budget.request(t0, end, 1, SFX_LIMIT)) return null;
        const s = kit.osc(e.type || 'sine', f, t0);
        if (e.detune) s.detune.setValueAtTime(e.detune, t0);
        if (e.glide) for (const [gf, gt] of e.glide) s.frequency.exponentialRampToValueAtTime(Math.max(1, gf), t0 + gt);
        const g = kit.gain(0);
        const a = e.a ?? 0.004, peak = e.peak ?? 0.2;
        g.gain.setValueAtTime(0, t0);
        g.gain.linearRampToValueAtTime(peak, t0 + a);
        if (e.hold) g.gain.setValueAtTime(peak, t0 + a + e.hold);
        g.gain.setTargetAtTime(0, t0 + a + (e.hold || 0), e.tau ?? dur / 5);
        let chain = s.connect(g);
        const nodes2 = [s, g];
        if (e.filter) {
          const [ft, ff, fq, fglide] = e.filter;
          const b = kit.filter(ft, ff, fq ?? 0.7);
          b.frequency.setValueAtTime(ff, t0);
          if (fglide) for (const [gf, gt] of fglide) b.frequency.exponentialRampToValueAtTime(gf, t0 + gt);
          chain = chain.connect(b);
          nodes2.push(b);
        }
        chain.connect(e.dest || out);
        s.start(t0);
        s.stop(end);
        kit.cleanup(s, nodes2);
        X.track(s, end);
        return { s, g };
      },
      /** Enveloped filtered noise. */
      noise(t0, dur, e = {}) {
        const end = t0 + dur;
        const s = kit.noiseSrc(t0, dur);
        const b = kit.filter(e.type || 'bandpass', e.f ?? 2000, e.Q ?? 1);
        b.frequency.setValueAtTime(e.f ?? 2000, t0);
        if (e.f2) b.frequency.exponentialRampToValueAtTime(e.f2, t0 + (e.ft ?? dur));
        const g = kit.gain(0);
        const a = e.a ?? 0.003, peak = e.peak ?? 0.1;
        g.gain.setValueAtTime(0, t0);
        g.gain.linearRampToValueAtTime(peak, t0 + a);
        if (e.hold) g.gain.setValueAtTime(peak, t0 + a + e.hold);
        g.gain.setTargetAtTime(0, t0 + a + (e.hold || 0), e.tau ?? dur / 5);
        s.connect(b).connect(g).connect(e.dest || out);
        kit.cleanup(s, [s, b, g]);
        X.track(s, end);
        return { s, g, b };
      },
      finish() {
        if (X.last) {
          const prev = X.last.onended;
          X.last.onended = () => {
            if (prev) prev();
            for (const n of nodes) { try { n.disconnect(); } catch (e) { /* */ } }
          };
        } else for (const n of nodes) { try { n.disconnect(); } catch (e) { /* */ } }
      },
    };
    return X;
  }

  // Aspect flavours for hit / cast.
  const HIT = {
    vagal(X, t) { X.tone(130, t, 0.3, { peak: 0.4, tau: 0.06, glide: [[70, 0.12]], filter: ['lowpass', 500] }); X.noise(t, 0.12, { type: 'lowpass', f: 500, peak: 0.12, tau: 0.03 }); },
    limbic(X, t) { const f = X.hz(0, 0); X.tone(f, t, 0.25, { type: 'triangle', peak: 0.45, tau: 0.045, filter: ['lowpass', f * 3, 1.5] }); X.tone(f * 2.01, t, 0.12, { peak: 0.12, tau: 0.02 }); X.noise(t, 0.05, { f: 1200, Q: 1, peak: 0.2, tau: 0.01 }); },
    cortical(X, t) { X.tone(X.hz(4, 3), t, 0.25, { peak: 0.28, tau: 0.04 }); X.tone(X.hz(4, 3) * 2.76, t, 0.15, { peak: 0.12, tau: 0.02 }); X.noise(t, 0.04, { type: 'highpass', f: 6000, peak: 0.2, tau: 0.008 }); },
    somatic(X, t) { X.tone(170, t, 0.35, { peak: 0.55, tau: 0.07, glide: [[48, 0.15]] }); X.noise(t, 0.03, { type: 'lowpass', f: 2500, peak: 0.15, tau: 0.006 }); },
    shadow(X, t) { X.tone(X.hz(0, -2) * 2, t, 0.3, { type: 'square', peak: 0.12, tau: 0.06, filter: ['lowpass', 700, 3] }); X.noise(t, 0.18, { type: 'lowpass', f: 900, Q: 3, peak: 0.2, tau: 0.04 }); },
    relational(X, t) { for (const d of [0, 0.065]) { X.tone(X.hz(2, 1), t + d, 0.15, { type: 'triangle', peak: 0.25, tau: 0.025 }); X.noise(t + d, 0.03, { f: 2500, Q: 1.5, peak: 0.08, tau: 0.006 }); } },
    void(X, t) { X.noise(t, 0.4, { f: 600, f2: 2500, ft: 0.25, Q: 1.6, peak: 0.9, a: 0.01, tau: 0.07 }); X.tone(X.hz(0, -1), t, 0.3, { peak: 0.2, tau: 0.06, glide: [[X.hz(0, -2), 0.2]] }); X.revGain.gain.value = 0.8; },
    mythic(X, t) { const f = X.hz(0, 1); for (const [r, p] of [[1, 0.25], [2.76, 0.12], [5.4, 0.06]]) X.tone(f * r, t, 0.9, { peak: p, tau: 0.25 / Math.sqrt(r) }); },
  };
  const CAST_TINT = {
    vagal: { Q: 1.5, wave: 'sine', degs: [0, 2, 4] },
    limbic: { Q: 2, wave: 'triangle', degs: [0, 4, 7] },
    cortical: { Q: 6, wave: 'sine', degs: [4, 6, 8] },
    somatic: { Q: 1, wave: 'triangle', degs: [0, 1, 4] },
    shadow: { Q: 3, wave: 'sawtooth', degs: [0, 1, 3] },
    relational: { Q: 2, wave: 'triangle', degs: [0, 2, 0, 4] },
    void: { Q: 0.7, wave: 'sine', degs: [0, 7] },
    mythic: { Q: 4, wave: 'sine', degs: [0, 4, 7, 11] },
  };

  const S = {
    attend(X) {
      const t = X.t;
      const el = t - attend.last;
      attend.step = Math.max(0, attend.step - Math.max(0, el - 0.15) / 0.3); // relax back down
      if (el < 0.6) attend.step = Math.min(14, attend.step + 1); // rapid clicks walk up
      attend.last = t;
      const f = X.hz(Math.round(attend.step), 1);
      X.tone(f, t, 0.45, { peak: 0.32, tau: 0.09 });
      X.tone(f * 3.98, t, 0.12, { peak: 0.09, tau: 0.018 }); // marimba 4th-ish partial
      X.noise(t, 0.02, { f: f * 2, Q: 3, peak: 0.04, tau: 0.004 });
    },
    buy(X) {
      const t = X.t;
      X.tone(X.hz(4, 1), t, 0.3, { type: 'triangle', peak: 0.25, tau: 0.06 });
      X.tone(X.hz(7, 1), t + 0.07, 0.5, { type: 'triangle', peak: 0.28, tau: 0.1 });
      X.tone(X.hz(7, 3), t + 0.07, 0.3, { peak: 0.05, tau: 0.05 });
      X.noise(t + 0.07, 0.25, { type: 'highpass', f: 7000, peak: 0.04, tau: 0.05 });
    },
    sell(X) {
      const t = X.t;
      X.tone(X.hz(7, 1), t, 0.3, { type: 'triangle', peak: 0.2, tau: 0.05 });
      X.tone(X.hz(4, 1), t + 0.08, 0.5, { type: 'triangle', peak: 0.22, tau: 0.1, filter: ['lowpass', 2000] });
    },
    reroll(X) {
      const t = X.t;
      for (let i = 0; i < 12; i++) {
        const tt = t + i * 0.028 + rng() * 0.012;
        const deg = Math.floor(rng() * 10);
        X.tone(X.hz(deg, 1 + (rng() < 0.4 ? 1 : 0)), tt, 0.07, { peak: 0.13 * (1 - i / 16), tau: 0.012, type: rng() < 0.5 ? 'triangle' : 'sine' });
      }
      X.noise(t, 0.4, { f: 3000, f2: 1200, Q: 2, peak: 0.05, a: 0.03, tau: 0.08 });
    },
    pickup(X) {
      const t = X.t;
      X.tone(X.hz(0, 1), t, 0.2, { peak: 0.22, tau: 0.05, glide: [[X.hz(4, 1), 0.07]] });
      X.noise(t, 0.02, { f: 3000, Q: 2, peak: 0.05, tau: 0.004 });
    },
    place(X) {
      const t = X.t;
      X.tone(X.hz(0, -1), t, 0.3, { peak: 0.35, tau: 0.05, glide: [[X.hz(0, -1) * 0.7, 0.1]] });
      X.tone(X.hz(4, 0), t, 0.2, { type: 'triangle', peak: 0.1, tau: 0.04 });
      X.noise(t, 0.08, { type: 'lowpass', f: 1200, peak: 0.12, tau: 0.015 });
    },
    merge(X) {
      const t = X.t, f = X.hz(0, 1);
      for (const [r, d] of [[0.75, 0], [0.9, 0.05], [1.12, 0.1]]) {
        X.tone(f * r, t + d, 0.9 - d, { peak: 0.12, a: 0.03, hold: 0.25, tau: 0.12, glide: [[f, 0.45]] });
      }
      X.tone(f * 2, t + 0.45, 0.6, { peak: 0.08, a: 0.02, tau: 0.12 });
    },
    integrate(X) {
      const t = X.t, f = X.hz(2, 1);
      X.tone(f, t, 1.2, { peak: 0.15, a: 0.06, hold: 0.5, tau: 0.15, glide: [[f, 0.1]] });
      // second tone glides in to a beating near-unison, then locks
      X.tone(f * 1.25, t, 1.2, { peak: 0.15, a: 0.06, hold: 0.5, tau: 0.15, glide: [[f * 1.018, 0.4], [f * 1.012, 0.65], [f * 1.0005, 0.8]] });
    },
    subtract(X) {
      const t = X.t, f = X.hz(0, 0);
      const n = kit.filter('notch', 300, 3);
      n.frequency.setValueAtTime(300, t);
      n.frequency.exponentialRampToValueAtTime(4000, t + 0.6);
      const n2 = kit.filter('notch', 600, 3);
      n2.frequency.setValueAtTime(600, t);
      n2.frequency.exponentialRampToValueAtTime(6000, t + 0.6);
      n.connect(n2).connect(X.out);
      const r = X.tone(f, t, 0.8, { type: 'sawtooth', peak: 0.14, a: 0.02, hold: 0.35, tau: 0.08, dest: n, filter: ['lowpass', 3500] });
      if (r) { const p = r.s.onended; r.s.onended = () => { if (p) p(); n.disconnect(); n2.disconnect(); }; }
      else { n.disconnect(); n2.disconnect(); }
    },
    split(X) {
      const t = X.t, f = X.hz(4, 0);
      X.tone(f, t, 0.2, { type: 'triangle', peak: 0.2, a: 0.01, hold: 0.12, tau: 0.02 });
      X.noise(t + 0.14, 0.12, { f: 2000, f2: 5000, Q: 1.5, peak: 0.07, tau: 0.03 });
      X.tone(f, t + 0.14, 0.9, { type: 'triangle', peak: 0.16, tau: 0.15, glide: [[f * Math.pow(2, 5 / 12), 0.55]] });
      X.tone(f, t + 0.14, 0.9, { type: 'triangle', peak: 0.16, tau: 0.15, glide: [[f * Math.pow(2, -7 / 12), 0.55]] });
    },
    repurpose(X) {
      const t = X.t, f = X.hz(0, 1);
      X.tone(f, t, 0.7, { type: 'triangle', peak: 0.18, a: 0.01, hold: 0.15, tau: 0.12, glide: [[f / 3, 0.45]] });
      for (const [d, p] of [[0.5, 0.18], [0.68, 0.13], [0.86, 0.09], [1.04, 0.06]]) {
        X.tone(f / 3, t + d, 0.12, { type: 'square', peak: p * 0.4, tau: 0.012, filter: ['lowpass', 900] });
      }
      X.tone(f / 6, t + 0.45, 0.9, { peak: 0.12, a: 0.05, tau: 0.2 });
    },
    hit(X, o) {
      const f = HIT[o.aspect];
      if (f) f(X, X.t);
      else { HIT.limbic(X, X.t); HIT.somatic(X, X.t); }
    },
    cast(X, o) {
      const t = X.t;
      const tint = CAST_TINT[o.aspect] || { Q: 2, wave: 'sine', degs: [0, 2, 4] };
      X.noise(t, 0.7, { f: 400, f2: 5000, ft: 0.55, Q: tint.Q, peak: 0.12, a: 0.15, tau: 0.12 });
      tint.degs.forEach((d, i) => X.tone(X.hz(d, 1), t + 0.08 + i * 0.07, 0.55, { type: tint.wave, peak: 0.1, a: 0.01, tau: 0.1, filter: ['lowpass', 4000] }));
    },
    death(X) {
      const t = X.t;
      for (const d of [0, 2, 4]) {
        const f = X.hz(d, 0);
        X.tone(f, t, 1.4, { type: 'triangle', peak: 0.12, a: 0.01, tau: 0.3, glide: [[f * 0.74, 1.1]], filter: ['lowpass', 3000, 0.7, [[300, 1.1]]] });
      }
      X.noise(t, 1.3, { type: 'lowpass', f: 3000, f2: 200, Q: 0.7, peak: 0.07, a: 0.05, tau: 0.3 });
    },
    enemyDeath(X) {
      const t = X.t;
      for (let i = 0; i < 10; i++) {
        const tt = t + rng() * 0.18;
        X.tone(2000 + rng() * 4000, tt, 0.25, { peak: 0.06, tau: 0.03 + rng() * 0.04 });
      }
      X.tone(X.hz(4, 3), t, 0.5, { peak: 0.05, tau: 0.1 });
      X.noise(t, 0.35, { type: 'highpass', f: 3500, peak: 0.14, tau: 0.05 });
    },
    waveStart(X) {
      const t = X.t;
      for (const [d, tt, dur] of [[0, 0, 0.65], [4, 0.4, 0.8]]) {
        const f = X.hz(d, -1);
        for (const det of [-8, 8]) X.tone(f, t + tt, dur, { type: 'sawtooth', peak: 0.1, a: 0.18, hold: dur * 0.3, tau: 0.12, detune: det, filter: ['lowpass', 250, 1, [[1100, 0.25], [400, dur]]] });
      }
    },
    waveWin(X) {
      const t = X.t;
      [0, 2, 4, 7].forEach((d, i) => {
        X.tone(X.hz(d, 1), t + i * 0.08, 1.3 - i * 0.08, { peak: 0.12, a: 0.01, hold: 0.2, tau: 0.22 });
        X.tone(X.hz(d, 1), t + i * 0.08, 1.3 - i * 0.08, { peak: 0.05, detune: 9, a: 0.02, hold: 0.2, tau: 0.22 });
      });
      X.noise(t + 0.2, 1.0, { type: 'highpass', f: 6000, peak: 0.03, a: 0.2, tau: 0.2 });
    },
    waveLose(X) {
      const t = X.t, r = degHz(E.scale, 0, 0) * X.k;
      [[7, 0], [3, 0.22], [0, 0.44]].forEach(([semi, d]) => {
        const f = r * Math.pow(2, semi / 12);
        X.tone(f, t + d, 0.9 - d * 0.6, { type: 'triangle', peak: 0.16, a: 0.02, tau: 0.16, glide: [[f * 0.97, 0.8]], filter: ['lowpass', 900] });
      });
    },
    upgrade(X) {
      const t = X.t;
      [0, 2, 4, 7].forEach((d, i) => X.tone(X.hz(d, 1), t + i * 0.055, 0.5, { type: 'triangle', peak: 0.15, tau: 0.07 }));
      X.tone(X.hz(7, 2), t + 0.22, 0.6, { peak: 0.08, tau: 0.12 });
      X.noise(t + 0.2, 0.4, { type: 'highpass', f: 7000, peak: 0.04, tau: 0.08 });
    },
    verbStart(X) {
      const t = X.t;
      X.noise(t, 0.8, { f: 400, f2: 1800, ft: 0.6, Q: 1.2, peak: 0.08, a: 0.45, tau: 0.08 });
      X.tone(X.hz(0, 0), t, 0.85, { peak: 0.1, a: 0.5, tau: 0.08 });
    },
    verbDone(X) {
      const t = X.t, f = X.hz(4, 1);
      for (const [r, p, tau] of [[1, 0.2, 0.28], [2.0, 0.1, 0.2], [2.76, 0.08, 0.16], [5.4, 0.05, 0.09], [8.93, 0.03, 0.05]]) {
        X.tone(f * r, t, 1.3, { peak: p, tau });
      }
    },
    decay(X) {
      const t = X.t;
      let d = 0;
      for (let i = 0; i < 5; i++) {
        X.noise(t + d, 0.03, { type: 'highpass', f: 3500, peak: 0.12 * Math.pow(0.6, i), tau: 0.004 });
        X.tone(X.hz(0, 2), t + d, 0.05, { type: 'square', peak: 0.03 * Math.pow(0.6, i), tau: 0.006 });
        d += 0.09 + i * 0.05;
      }
      X.revGain.gain.value = 0.05; // dry
    },
    unlock(X) {
      const t = X.t;
      X.tone(X.hz(4, 1), t, 0.4, { type: 'triangle', peak: 0.18, tau: 0.08 });
      X.tone(X.hz(7, 1), t + 0.12, 0.9, { type: 'triangle', peak: 0.2, tau: 0.18 });
      X.tone(X.hz(7, 2), t + 0.12, 0.8, { peak: 0.06, tau: 0.15 });
      X.noise(t + 0.1, 0.6, { type: 'highpass', f: 5000, peak: 0.04, a: 0.08, tau: 0.12 });
    },
    error(X) {
      const t = X.t;
      X.tone(110, t, 0.25, { type: 'triangle', peak: 0.35, tau: 0.04, filter: ['lowpass', 400] });
      X.tone(110 * Math.SQRT2, t + 0.015, 0.22, { type: 'triangle', peak: 0.18, tau: 0.035, filter: ['lowpass', 400] });
      X.noise(t, 0.05, { type: 'lowpass', f: 600, peak: 0.12, tau: 0.01 });
      X.revGain.gain.value = 0.08;
    },
    hover(X) {
      X.tone(X.hz(4, 3), X.t, 0.04, { peak: 0.03, tau: 0.006 });
      X.revGain.gain.value = 0.05;
    },
    overwhelmPulse(X) {
      const t = X.t;
      X.noise(t, 0.6, { type: 'lowpass', f: 300, f2: 3000, ft: 0.45, Q: 1, peak: 0.1, a: 0.42, tau: 0.03 });
      X.tone(58, t + 0.42, 0.75, { peak: 0.6, a: 0.008, tau: 0.13, glide: [[34, 0.4]] });
      X.tone(X.hz(0, -1), t + 0.42, 0.5, { type: 'triangle', peak: 0.1, tau: 0.08 });
    },
    stanceChoose(X) {
      const t = X.t, st = E.target.stance;
      const degs = st === 'away' ? [0, 4, 11] : st === 'against' ? [0, 1, 4, 5] : [0, 2, 4];
      const wave = st === 'against' ? 'sawtooth' : 'sine';
      degs.forEach((d, i) => X.tone(X.hz(d, 1), t + i * 0.04, 1.3, { type: wave, peak: 0.1, a: 0.12, hold: 0.25, tau: 0.2, filter: ['lowpass', st === 'against' ? 3500 : 2200] }));
      if (st === 'away') X.revGain.gain.value = 0.8;
    },
  };

  function play(name, o = {}) {
    if (name === 'reset') { E.reset(); return true; }
    const fn = S[name];
    if (!fn) return false;
    const X = begin(o);
    fn(X, o);
    X.finish();
    return true;
  }

  /** ~6 s reset gesture: a falling whoosh, then a single pure tone. */
  function resetGesture(t) {
    const out = kit.gain(1);
    const rev = kit.gain(0.3);
    out.connect(bus.sfxDry);
    out.connect(rev).connect(bus.sfxRev);
    const f = degHz(E.scale, 0, 1);
    const end = t + 6.2;
    const nodes = [out, rev];
    // pure tone (budget-exempt: one oscillator; it is the whole point)
    kit.budget.request(t, end, 1, 999);
    const s = kit.osc('sine', f, t);
    const g = kit.gain(0);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.006, t + 0.6);
    g.gain.linearRampToValueAtTime(0.034, t + 1.8);
    g.gain.setValueAtTime(0.034, t + 2.6);
    g.gain.setTargetAtTime(0, t + 2.6, 0.9);
    s.connect(g).connect(out);
    s.start(t); s.stop(end);
    nodes.push(s, g);
    // collapse whoosh: noise through a lowpass falling 6 kHz -> 150 Hz
    const n = kit.noiseSrc(t, 2.4);
    const lp = kit.filter('lowpass', 6000, 1.2);
    lp.frequency.setValueAtTime(6000, t);
    lp.frequency.exponentialRampToValueAtTime(150, t + 1.9);
    const ng = kit.gain(0);
    ng.gain.setValueAtTime(0, t);
    ng.gain.linearRampToValueAtTime(0.06, t + 0.25);
    ng.gain.setTargetAtTime(0, t + 0.4, 0.45);
    n.connect(lp).connect(ng).connect(out);
    kit.cleanup(n, [n, lp, ng]);
    // soft sub implosion
    if (kit.budget.request(t, t + 2.6, 1, 999)) {
      const sub = kit.osc('sine', 70, t);
      sub.frequency.exponentialRampToValueAtTime(38, t + 1.9);
      const sg = kit.gain(0);
      sg.gain.setValueAtTime(0, t);
      sg.gain.linearRampToValueAtTime(0.06, t + 1.2);
      sg.gain.setTargetAtTime(0, t + 1.5, 0.25);
      sub.connect(sg).connect(out);
      sub.start(t); sub.stop(t + 2.6);
      kit.cleanup(sub, [sub, sg]);
    }
    kit.cleanup(s, nodes);
  }

  return { play, resetGesture };
}
