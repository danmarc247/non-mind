// NON-MIND audio — generative music.
//
//  * "Airports" layer (after Eno, Music for Airports 1/1, 2/1): 8 loops with
//    incommensurate periods (~17-34 s), each holding one note or a 2-3 note
//    phrase played by a felt piano or a wordless voice. Each loop sits in its
//    own HRTF panner that slowly orbits the listener on its own period.
//  * "Floe" layer (after Glass, Glassworks/Floe): horn swells outlining a
//    4-chord cycle, then 1-5 arpeggio ostinati whose pattern lengths differ
//    (5..9 notes) and grow/shrink by one note every few cycles (additive
//    process) so they phase against each other; two extra sixteenth-note
//    polymetric voices (11 and 13 notes) appear with overwhelm.
//  * Overwhelm extras: detune, open filters, faster pulse (132 -> 168 bpm),
//    saturation, a rising Shepard-Risset glissando.
//  * Continuous colours: tension/shadow drone, vagal breath, relational delay,
//    somatic heartbeat (scheduled), etc.
//
// The music never reads wall-clock time: schedule(tEnd) generates every event
// with start < tEnd at sample-accurate AudioContext times, and control(T)
// ramps continuous parameters to their values at time T.

import { piano, voice, horn, pluck, thump } from './instruments.js';
import { clamp, smoothstep, degHz, VOWELS, pick } from './util.js';

const TAU = Math.PI * 2;
const MUSIC_LIMIT = 40; // music may use 40 of the ~48 oscillators; SFX get the rest

export function createMusic(E) {
  const { ctx, kit, rng, bus } = E;

  // ---- spatial helpers ------------------------------------------------------
  function makePanner(dest, revDest) {
    const input = kit.gain(1);
    const p = ctx.createPanner();
    p.panningModel = E.quality === 'low' ? 'equalpower' : 'HRTF'; // HRTF is costly on mobile
    p.distanceModel = 'inverse';
    p.refDistance = 6;
    p.maxDistance = 200;
    p.rolloffFactor = 1;
    const t0 = ctx.currentTime;
    if (p.positionX) {
      p.positionX.setValueAtTime(0, t0);
      p.positionY.setValueAtTime(0, t0);
      p.positionZ.setValueAtTime(-8, t0);
    }
    input.connect(p).connect(dest);
    if (revDest) input.connect(revDest);
    return { input, p };
  }
  function moveTo(pan, x, y, z, T) {
    const p = pan.p;
    if (p.positionX) {
      p.positionX.linearRampToValueAtTime(x, T);
      p.positionY.linearRampToValueAtTime(y, T);
      p.positionZ.linearRampToValueAtTime(z, T);
    } else p.setPosition(x, y, z);
  }

  // ---- Airports loops ---------------------------------------------------------
  const PERIODS = [17.3, 19.7, 22.1, 23.9, 26.3, 28.6, 31.1, 33.7];
  const INST = ['piano', 'voice', 'piano', 'piano', 'voice', 'piano', 'voice', 'piano'];
  const FAVOURED = [0, 2, 4, 0, 4, 1, 5, 3, 6, 2];
  const loops = PERIODS.map((base, i) => {
    const inst = INST[i];
    const period = base * (1 + (rng() - 0.5) * 0.03); // keeps ratios non-integer
    const n = inst === 'piano' ? 1 + Math.floor(rng() * 3) : 1 + Math.floor(rng() * 2);
    const phrase = [];
    let deg = pick(rng, FAVOURED);
    let off = 0;
    for (let k = 0; k < n; k++) {
      phrase.push({
        off,
        deg,
        dur: inst === 'piano' ? 5 + rng() * 3 : 5.5 + rng() * 3,
        vel: 0.5 + rng() * 0.3,
      });
      off += inst === 'piano' ? 0.9 + rng() * 1.8 : 3 + rng() * 2;
      deg += pick(rng, [-2, -1, 1, 2, 3, -3]);
    }
    const oct = inst === 'piano' ? (rng() < 0.55 ? 1 : 2) : rng() < 0.6 ? 0 : 1;
    const pan = makePanner(bus.airDry, bus.airRev);
    return {
      i, inst, period, phrase, oct, pan,
      orbit: { r: 6 + rng() * 8, period: 45 + rng() * 90, phase: rng() * TAU, dir: rng() < 0.5 ? -1 : 1, y: (rng() - 0.5) * 3 },
      cycle: 0, j: 0, enabledAt: 0, startFrac: rng(),
    };
  });

  // Sustained notes still sounding (piano / voice / horn output gains). On a key
  // change (depth) they are faded out, so the new key never sounds under old notes.
  let live = [];
  const track = (out, t, dur) => { if (out && out.gain) live.push({ g: out.gain, end: t + dur + 0.5 }); };

  function playLoopNote(L, ev, t) {
    const S = E.S, sc = E.scale, A = S.asp;
    if (rng() < 0.3 * S.away + 0.2 * A.void) return; // sparser / distant stances
    let deg = ev.deg;
    // toward: pull to tonic-triad tones (consonant)
    if (S.toward > 0.1 && rng() < S.toward * 0.7) {
      const o7 = Math.floor(deg / 7) * 7, r = deg - o7;
      deg = o7 + (r <= 1 ? 0 : r <= 3 ? 2 : r <= 5 ? 4 : 7);
    }
    const f = degHz(sc, deg, L.oct);
    const lim = MUSIC_LIMIT;
    E.stats.notes++;
    if (E.stats.log && E.stats.log.length < 4000) E.stats.log.push([+t.toFixed(2), L.inst]);
    if (L.inst === 'piano') {
      track(piano(kit, L.pan.input, t, f, {
        vel: ev.vel, dur: ev.dur, bright: sc.bright * (1 + 0.3 * S.against), inharm: sc.inharm,
        sub: A.limbic, limit: lim,
      }), t, ev.dur);
    } else {
      const vowel = VOWELS[S.toward > 0.5 ? 'o' : sc.vowel];
      track(voice(kit, L.pan.input, t, f, {
        vel: ev.vel * 0.9, dur: ev.dur, attack: 1.5 + 0.8 * S.away, vowel,
        spread: 2.5 + sc.detuneExtra + 6 * S.o, limit: lim,
      }), t, ev.dur);
      // mythic: a choir companion a fifth above
      if (A.mythic > 0.05 && rng() < A.mythic * 0.8) {
        track(voice(kit, L.pan.input, t + 0.7, degHz(sc, deg + 4, L.oct), {
          vel: ev.vel * 0.45, dur: ev.dur * 0.9, attack: 2, vowel: VOWELS.u, limit: lim - 4,
        }), t + 0.7, ev.dur);
      }
    }
  }

  // ---- Floe layer -----------------------------------------------------------
  const TONES = [0, 2, 4, 7, 9, 11]; // chord tones as scale-degree offsets (1.5 octaves)
  function makeSeq(style, L) {
    const n = L + 3;
    const s = [];
    for (let i = 0; i < n; i++) {
      let v;
      if (style === 'rise') v = i % 6;
      else if (style === 'wave') { const k = i % 6; v = k <= 3 ? k : 6 - k; }
      else if (style === 'broken') v = ((i >> 1) % 4) + (i & 1 ? 2 : 0); // 0 2 1 3 2 4 3 5
      else v = i % 2 ? 3 : (i >> 1) % 6; // pedal
      s.push(clamp(Math.round(v), 0, 5));
    }
    return s;
  }
  const RING = 5.5;
  const VOICE_DEF = [
    { L: 6, style: 'rise', oct: 2, th: 0.16, M: 2 },
    { L: 8, style: 'wave', oct: 2, th: 0.36, M: 3 },
    { L: 5, style: 'broken', oct: 1, th: 0.5, M: 2 },
    { L: 7, style: 'pedal', oct: 2, th: 0.64, M: 4 },
    { L: 9, style: 'rise', oct: 3, th: 0.78, M: 3 },
    // overwhelm-only polymetric sixteenth voices
    { L: 11, style: 'wave', oct: 2, th: 0.22, M: 2, extra: true },
    { L: 13, style: 'broken', oct: 3, th: 0.5, M: 3, extra: true },
  ];
  const fVoices = VOICE_DEF.map((d, k) => {
    const filt = kit.filter('lowpass', 2000, 0.6);
    const pan = makePanner(bus.floeDry, bus.floeRev);
    filt.connect(pan.input);
    filt.frequency.setValueAtTime(2000, ctx.currentTime);
    return {
      ...d, k, filt, pan, seq: makeSeq(d.style, d.L), pos: 0, add: 0, dir: 1, cycles: 0,
      ang: (k / VOICE_DEF.length) * TAU + rng() * 0.4, drift: (rng() - 0.5) * 0.02,
    };
  });
  const hornPans = [makePanner(bus.floeDry, bus.floeRev), makePanner(bus.floeDry, bus.floeRev)];
  const F = { next: 0, inChord: 1e9, chordIdx: -1, chordLen: 16, hornN: 0, stepDur: 30 / 132 };

  function voiceNote(v, t, lvl, S, sc) {
    const len = v.L + v.add;
    const idx = v.seq[Math.min(v.pos, v.seq.length - 1)];
    const first = v.pos === 0;
    v.pos++;
    if (v.pos >= len) {
      v.pos = 0;
      v.cycles++;
      if (v.cycles % v.M === 0) { // additive / subtractive process
        v.add += v.dir;
        if (v.add >= 3) v.dir = -1;
        if (v.add <= 0) { v.add = 0; v.dir = 1; }
      }
    }
    if (lvl < 0.02) return;
    if (rng() < 0.3 * S.away) return;
    const deg = sc.prog[Math.max(0, F.chordIdx)] + TONES[idx];
    const f = degHz(sc, deg, v.oct);
    const o = S.o;
    E.stats.notes++;
    pluck(kit, v.filt, t, f, {
      vel: lvl * (first ? 1 : 0.72) * (v.extra ? 0.7 : 1.15),
      decay: (v.extra ? 0.06 : 0.1) + 0.05 * (1 - o),
      wave: v.extra || S.against > 0.5 ? 'pulse' : sc.pluck,
      cents: (rng() - 0.5) * (o * 30 + sc.detuneExtra),
      detune: o > 0.2 ? (6 + 22 * o) * (rng() < 0.5 ? -1 : 1) : 0,
      bell: S.asp.cortical,
      attack: S.against > 0.5 ? 0.002 : 0.005,
      limit: MUSIC_LIMIT,
    });
  }

  function chordStart(t, S, sc) {
    // horns enter soft and grow with complexity (so they never darken the mix early)
    const hl = smoothstep(0.06, 0.28, S.c) * (0.5 + 0.5 * smoothstep(0.45, 1, S.c)) * (1 - 0.3 * S.away);
    if (hl < 0.02) return;
    const chordDur = F.chordLen * F.stepDur;
    const dur = clamp(chordDur * 1.15, 4, 8);
    const d = sc.prog[F.chordIdx];
    // mid register (root/fifth at octave 0, third above) so the Floe brightens the mix
    const notes = [[d, 0], [d + 4, 0], [d + 2, 1]];
    if (S.asp.mythic > 0.3) notes.push([d + 7, 1]);
    const o = S.o;
    notes.forEach(([deg, oct], i) => {
      track(horn(kit, hornPans[(F.hornN + i) % 2].input, t + i * 0.12, degHz(sc, deg, oct), {
        vel: hl * (0.65 + 0.35 * o) * (i === 2 ? 0.75 : 1), dur,
        cutoff: 900 + 1400 * S.c + 1900 * o + 600 * S.against + 300 * sc.bright,
        spread: 6 + 18 * o + sc.detuneExtra, limit: MUSIC_LIMIT,
      }), t + i * 0.12, dur);
    });
    F.hornN++;
    E.stats.notes++;
  }

  function floeStep(t) {
    const S = E.S, sc = E.scale;
    F.inChord++;
    if (F.inChord >= F.chordLen) {
      F.chordIdx = (F.chordIdx + 1) % 4;
      F.inChord = 0;
      F.chordLen = sc.beats[F.chordIdx] * 2; // eighths
      chordStart(t, S, sc);
    }
    for (const v of fVoices) {
      if (v.extra) {
        const lvl = smoothstep(v.th, v.th + 0.2, S.o) * smoothstep(0.4, 0.7, S.c);
        voiceNote(v, t, lvl, S, sc);
        voiceNote(v, t + F.stepDur / 2, lvl, S, sc);
      } else {
        voiceNote(v, t, smoothstep(v.th, v.th + 0.12, S.c), S, sc);
      }
    }
  }

  // ---- somatic heartbeat (only when the aspect is present) ----------------------
  const H = { next: 0 };

  // ---- persistent nodes: drone, breath, shepard ----------------------------------
  const t0 = ctx.currentTime;
  const droneOut = kit.gain(0);
  droneOut.gain.setValueAtTime(0, t0);
  const droneLP = kit.filter('lowpass', 500, 0.7);
  droneLP.frequency.setValueAtTime(500, t0);
  droneLP.connect(droneOut);
  droneOut.connect(bus.musicDry);
  droneOut.connect(bus.reverbIn);
  const d1 = kit.osc('sine', degHz(E.scale, 0, -1), t0);
  const d2 = kit.osc('triangle', degHz(E.scale, 4, -1), t0);
  const d2g = kit.gain(0.5);
  d1.connect(droneLP); d2.connect(d2g).connect(droneLP);
  d1.start(t0); d2.start(t0);
  E.budget.persistent += 2;

  const breath = kit.noiseSrc(t0, 1e6);
  const breathBP = kit.filter('bandpass', 700, 0.6);
  const breathG = kit.gain(0);
  breathG.gain.setValueAtTime(0, t0);
  breath.connect(breathBP).connect(breathG);
  breathG.connect(bus.reverbIn);
  breathG.connect(bus.musicDry);

  let droneScale = E.scale, keyAt = -1e9;
  let shep = null;
  let shepPhase = 0, shepQuiet = 0;
  function makeShepard(T) {
    const out = kit.gain(0);
    out.gain.setValueAtTime(0, T);
    out.connect(bus.musicDry);
    out.connect(bus.reverbIn);
    const comps = [];
    for (let i = 0; i < 6; i++) {
      const o = kit.osc('sine', 60, T);
      const g = kit.gain(0);
      g.gain.setValueAtTime(0, T);
      o.connect(g).connect(out);
      o.start(T);
      comps.push({ o, g, lastP: -1 });
    }
    E.budget.persistent += 6;
    return { out, comps };
  }
  function killShepard(T) {
    if (!shep) return;
    const s = shep;
    shep = null;
    s.out.gain.linearRampToValueAtTime(0, T + 0.1);
    for (const c of s.comps) {
      c.o.stop(T + 0.2);
      kit.cleanup(c.o, [c.o, c.g]);
    }
    setTimeoutSafe(() => s.out.disconnect(), 400);
    E.budget.persistent -= 6;
  }
  function setTimeoutSafe(fn, ms) { if (typeof setTimeout !== 'undefined') setTimeout(fn, ms); }

  // ---- public ---------------------------------------------------------------
  function restart(now) {
    for (const L of loops) {
      L.cycle = now + 0.5 + L.startFrac * L.period * 0.85 - L.phrase[0].off;
      L.j = 0;
      L.enabledAt = now;
    }
    F.next = now + 0.1;
    H.next = now + 0.5;
  }

  function schedule(tEnd, now) {
    const sc = E.scale, S = E.S;
    if (live.length > 64) live = live.filter((n) => n.end > now);
    for (const L of loops) {
      const per = L.period * sc.periodScale;
      while (L.cycle + per < now - 10) L.cycle += per; // after a long stall
      for (let guard = 0; guard < 32; guard++) {
        const ev = L.phrase[L.j];
        const t = L.cycle + ev.off;
        if (t >= tEnd) break;
        if (t >= L.enabledAt && t >= now - 0.02) playLoopNote(L, ev, t);
        if (++L.j >= L.phrase.length) { L.j = 0; L.cycle += per; }
      }
    }
    if (F.next < now - 0.2) F.next = now + 0.02;
    while (F.next < tEnd) {
      F.stepDur = 30 / (132 + 36 * S.o);
      floeStep(F.next);
      F.next += F.stepDur;
    }
    if (H.next < now - 0.2) H.next = now + 0.05;
    while (H.next < tEnd) {
      const w = S.asp.somatic;
      if (w > 0.03) {
        const dest = bus.musicDry;
        thump(kit, dest, H.next, { vel: 0.16 * w, f0: 80, f1: 45, dur: 0.3, limit: MUSIC_LIMIT });
        thump(kit, dest, H.next + 0.27, { vel: 0.09 * w, f0: 70, f1: 40, dur: 0.25, limit: MUSIC_LIMIT });
      }
      H.next += 60 / (54 + 30 * S.o);
    }
  }

  function control(T, dt) {
    const S = E.S, A = S.asp, sc = E.scale, P = E.listener.pos;
    const c = S.c, o = S.o;
    const dryMul = 1 - 0.35 * S.away - 0.3 * A.void;
    const revMul = 1 + 0.8 * S.away - 0.4 * S.against + 0.7 * A.void;
    // layer balances
    const air = clamp(1 - 0.5 * smoothstep(0.3, 1, c) - 0.25 * o, 0, 1);
    bus.airDry.gain.linearRampToValueAtTime(air * dryMul, T);
    bus.airRev.gain.linearRampToValueAtTime(air * 0.6 * revMul, T);
    const floe = smoothstep(0.05, 0.3, c);
    bus.floeDry.gain.linearRampToValueAtTime(floe * (0.8 + 0.1 * o) * dryMul, T);
    bus.floeRev.gain.linearRampToValueAtTime(floe * 0.3 * revMul, T);
    bus.delaySend.gain.linearRampToValueAtTime(0.35 * A.relational, T);
    // tone shaping (stance + overwhelm)
    // brightness rises monotonically with complexity (gentle: +3 dB air, -2 dB body)
    const lift = 0.6 * smoothstep(0.02, 0.4, c) + 0.4 * smoothstep(0.35, 0.9, c);
    E.nodes.tiltHi.gain.linearRampToValueAtTime(3 * lift - 3 * S.toward - 2 * S.away + 4 * S.against + 2 * o - 2 * A.shadow, T);
    E.nodes.tiltLo.gain.linearRampToValueAtTime(-2 * lift + 2 * S.toward + 1.5 * A.limbic + 1.5 * A.shadow, T);
    const sat = 0.6 * o * o;
    E.nodes.satClean.gain.linearRampToValueAtTime(1 - sat, T);
    E.nodes.satDrive.gain.linearRampToValueAtTime(sat, T);
    // arpeggio voice filters open with overwhelm / against / cortical
    const cut = 2400 + 5200 * o + 2200 * S.against + 900 * A.cortical + 300 * sc.bright;
    for (const v of fVoices) v.filt.frequency.linearRampToValueAtTime(cut * (1 + 0.15 * v.oct), T);

    // orbits: every Airports loop circles the listener on its own period
    const rMul = 1 + 0.5 * S.away + 0.3 * A.void;
    for (const L of loops) {
      const ob = L.orbit;
      const a = ob.phase + (ob.dir * TAU * T) / ob.period;
      const r = ob.r * rMul;
      moveTo(L.pan, P[0] + r * Math.cos(a), P[1] + ob.y + Math.sin(a * 0.7), P[2] + r * Math.sin(a), T);
    }
    for (const v of fVoices) {
      v.ang += v.drift * dt;
      const r = RING * (v.extra ? 0.8 : 1) * rMul;
      moveTo(v.pan, P[0] + r * Math.cos(v.ang), P[1] + (v.oct - 1.5) * 0.8, P[2] + r * Math.sin(v.ang), T);
    }
    const ha = 0.15 * Math.sin(T * 0.05);
    moveTo(hornPans[0], P[0] - 7 * Math.cos(0.6 + ha), P[1], P[2] - 7 * Math.sin(0.6 + ha), T);
    moveTo(hornPans[1], P[0] + 7 * Math.cos(0.6 - ha), P[1], P[2] - 7 * Math.sin(0.6 - ha), T);

    // drone: tension + shadow (shadow bends the fifth to a tritone)
    let dl = 0.045 * S.ten + 0.045 * A.shadow;
    if (T < keyAt + 1.2) dl = 0; // fading out for a key change
    else if (droneScale !== sc) { // silent now: retune to the new key, then fade back in
      droneScale = sc;
      d1.frequency.setValueAtTime(degHz(sc, 0, -1), T - 0.05);
    }
    droneOut.gain.linearRampToValueAtTime(dl, T);
    const dr = degHz(droneScale, 0, -1);
    d1.frequency.linearRampToValueAtTime(dr, T);
    d2.frequency.linearRampToValueAtTime(dr * Math.pow(2, (7 - A.shadow) / 12), T);
    droneLP.frequency.linearRampToValueAtTime(300 + 500 * S.ten - 150 * A.shadow, T);
    // vagal breath: slow 7 s swell
    const br = 0.5 + 0.5 * Math.sin((TAU * T) / 7);
    breathG.gain.linearRampToValueAtTime(0.05 * A.vagal * br, T);

    // Shepard-Risset rising tone, created only while overwhelm is present
    if (o > 0.02 && !shep) shep = makeShepard(T);
    if (shep) {
      shepPhase += dt / (9 - 5 * o);
      const N = shep.comps.length;
      shep.out.gain.linearRampToValueAtTime(0.06 * Math.pow(o, 1.4), T);
      shep.comps.forEach((cmp, i) => {
        const p = (i + shepPhase) % N;
        const f = 55 * Math.pow(2, p);
        const g = Math.pow(Math.sin((Math.PI * p) / N), 2);
        if (p < cmp.lastP) cmp.o.frequency.setValueAtTime(f, T);
        else cmp.o.frequency.linearRampToValueAtTime(f, T);
        cmp.g.gain.linearRampToValueAtTime(g * 0.4, T);
        cmp.lastP = p;
      });
      shepQuiet = o < 0.005 ? shepQuiet + dt : 0;
      if (shepQuiet > 4) killShepard(T);
    }
  }

  /**
   * Depth changed (E.scale already replaced): fade every sustained note of the
   * old key over ~1 s; everything scheduled from now on uses the new key. The
   * Floe restarts its chord cycle so horns re-swell in the new key.
   */
  function keyChange(now) {
    keyAt = now;
    live = live.filter((n) => n.end > now);
    for (const n of live) {
      if (n.g.cancelAndHoldAtTime) n.g.cancelAndHoldAtTime(now);
      else { n.g.cancelScheduledValues(now); n.g.setValueAtTime(n.g.value, now); }
      n.g.setTargetAtTime(0, now, 0.3);
    }
    live = [];
    F.inChord = 1e9;
    F.chordIdx = -1;
  }

  /** Non-mind collapse: silence the Floe, regrow Airports from one loop. */
  function reset(t) {
    const order = loops.slice().sort((a, b) => (a.inst === 'piano' ? 0 : 1) - (b.inst === 'piano' ? 0 : 1));
    order.forEach((L, k) => {
      const at = k === 0 ? t + 4.4 : t + 9 + k * 5.5 + rng() * 3;
      L.enabledAt = at;
      L.cycle = at - L.phrase[0].off;
      L.j = 0;
    });
    for (const v of fVoices) { v.pos = 0; v.add = 0; v.dir = 1; v.cycles = 0; }
    F.inChord = 1e9;
    F.chordIdx = -1;
  }

  function dispose() {
    const T = ctx.currentTime;
    for (const n of [d1, d2, breath]) { try { n.stop(T + 0.05); } catch (e) { /* */ } }
    killShepard(T);
    const all = [droneOut, droneLP, d1, d2, d2g, breath, breathBP, breathG, ...hornPans.flatMap((h) => [h.input, h.p])];
    for (const L of loops) all.push(L.pan.input, L.pan.p);
    for (const v of fVoices) all.push(v.filt, v.pan.input, v.pan.p);
    setTimeoutSafe(() => all.forEach((n) => { try { n.disconnect(); } catch (e) { /* */ } }), 200);
  }

  return { schedule, control, reset, restart, dispose, keyChange, loops, fVoices };
}
