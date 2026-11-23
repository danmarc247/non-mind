// NON-MIND audio — generative music.
//
//  * Ambient layer (asynchronous loops of different lengths; internal names `air*`): 8 loops with
//    incommensurate periods (~17-34 s), each holding one note or a 2-3 note
//    phrase played by a felt piano or a wordless voice. Each loop sits in its
//    own HRTF panner that slowly orbits the listener on its own period.
//  * Arpeggio layer (interlocking minimalist arpeggios): horn swells outlining a
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

//
// The score travels on four time scales (see setMood in engine.js):
//  * wave (1..10) + cycle: each wave has its own identity (util.js WAVES): modal
//    centre, chord cycle, arpeggio cells/figure/feel, lead colour. A change is
//    handed over at a phrase boundary: sustained notes of the old key fade over
//    ~5 s while the arpeggio voices switch one by one (a 4-8 s cross-fade).
//  * phase + beat: inside a wave the fight builds beat by beat (voices enter in
//    order), holds its breath before the last beat, releases on 'won' (one
//    pulse voice, loops bloom through prep) and turns low and muffled on 'lost'.
//  * stage (0..17): the palette itself unlocks over a run (STAGE_UNLOCK below).
//  * long form: seeded slow walks on loop length, register, filter and orbit,
//    occasional rests of a whole layer, rare "gift" events.

import { piano, voice, horn, pluck, thump, glass } from './instruments.js';
import { clamp, smoothstep, degHz, VOWELS, pick, mulberry32, approach } from './util.js';

const TAU = Math.PI * 2;
const MUSIC_LIMIT = 40; // music may use 40 of the ~48 oscillators; SFX get the rest

// Stage at which each device joins the palette (complexity stays the density
// control inside whatever is unlocked). With no stage given everything is open.
export const STAGE_UNLOCK = {
  pulse1: 3, // first pulse (arpeggio) voice
  horns: 5, // horn swells
  pulse2: 7, // second pulse voice, in contrary motion
  pad: 9, // bowed-glass pad
  lowPulse: 11, // soft low pulse
  canon: 13, // canon of the lead a fifth above, off the beat
  full: 15, // the full interlocking set (voices 4 and 5)
  extras: 17, // overwhelm treatment: polymetric sixteenth voices
};
const LOOP_STAGE = [0, 0, 0, 0, 0.5, 1, 1.5, 2]; // ambient loops join one by one over stages 0-2
// Fight arc: how much of the pulsed layer is let in at each of the ten beats.
// Beat 9 (index 8) is the held breath before the last beat.
const DEN = [0.12, 0.25, 0.38, 0.5, 0.62, 0.75, 0.88, 1, 0, 1];
const STYLES = ['rise', 'wave', 'broken', 'pedal'];
const BASE_OCT = [2, 2, 1, 2, 3];

export function createMusic(E) {
  const { ctx, kit, rng, bus } = E;
  const lf = mulberry32((E.seed ^ 0x51ce5) >>> 0); // long-form variation: its own stream
  // Arc / stage / long-form state, smoothed in control() and read by schedule().
  const X = (E.X = {
    u3: 1, u5: 1, u7: 1, u9: 1, u11: 1, u13: 1, u15: 1, u17: 1, thScale: 1,
    den: 1, calm: 0, lost: 0, beat: 9, beatClock: 0, phase: null, init: false,
    restPiano: 1, restVoice: 1, restArp: 1, cutWalk: 1,
  });

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

  // ---- ambient loops ---------------------------------------------------------
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
      // long-form walk: loop length, orbit radius and register drift on their own slow periods
      w: { pp: 95 + lf() * 130, pph: lf() * TAU, rp: 140 + lf() * 190, rph: lf() * TAU },
      perMul: 1, octJ: 0,
    };
  });

  // Sustained notes still sounding (piano / voice / horn output gains). On a key
  // change (depth) they are faded out, so the new key never sounds under old notes.
  let live = [];
  const track = (out, t, dur) => { if (out && out.gain) live.push({ g: out.gain, end: t + dur + 0.5 }); };
  const fadeLive = (at, tau) => {
    for (const n of live) {
      if (n.end <= at) continue;
      if (n.g.cancelAndHoldAtTime) n.g.cancelAndHoldAtTime(at);
      else { n.g.cancelScheduledValues(at); n.g.setValueAtTime(n.g.value, at); }
      n.g.setTargetAtTime(0, at, tau);
    }
    live = [];
  };

  function playLoopNote(L, ev, t) {
    const S = E.S, sc = E.scale, A = S.asp;
    if (S.stage < LOOP_STAGE[L.i]) return; // this loop has not joined the palette yet
    const rest = L.inst === 'piano' ? X.restPiano : X.restVoice;
    if (rest < 0.1) return; // the whole family is resting
    if (rng() < 0.3 * S.away + 0.2 * A.void) return; // sparser / distant stances
    let deg = ev.deg;
    // toward: pull to tonic-triad tones (consonant)
    if (S.toward > 0.1 && rng() < S.toward * 0.7) {
      const o7 = Math.floor(deg / 7) * 7, r = deg - o7;
      deg = o7 + (r <= 1 ? 0 : r <= 3 ? 2 : r <= 5 ? 4 : 7);
    }
    // the wave's lead family sings out, the other steps back (both bloom when calm)
    const lead = sc.lead === 'both' || sc.lead === L.inst;
    const lv = (lead ? 1.1 : 0.5 + 0.4 * X.calm) * rest * (1 + 0.15 * X.calm);
    const low = X.lost > 0.4 ? 1 : 0; // 'lost': the loops turn an octave down
    const oct = L.inst === 'piano'
      ? clamp(L.oct + sc.octShift + L.octJ, 1, 3) - low
      : clamp(L.oct + L.octJ, 0, 1) - low;
    const f = degHz(sc, deg, oct);
    const lim = MUSIC_LIMIT;
    E.stats.notes++;
    if (E.stats.log && E.stats.log.length < 4000) E.stats.log.push([+t.toFixed(2), L.inst]);
    if (L.inst === 'piano') {
      const vel = ev.vel * lv * (oct >= 3 ? 0.75 : 1);
      track(piano(kit, L.pan.input, t, f, {
        vel, dur: ev.dur, bright: sc.bright * (1 + 0.3 * S.against) * (1 - 0.5 * X.lost), inharm: sc.inharm,
        sub: A.limbic, limit: lim,
      }), t, ev.dur);
      // calm bloom: now and then the lead answers itself a fifth above
      if (lead && X.calm > 0.5 && rng() < 0.45) {
        track(piano(kit, L.pan.input, t + 0.42, degHz(sc, deg + 4, oct), {
          vel: vel * 0.55, dur: ev.dur, bright: sc.bright, inharm: sc.inharm, limit: lim - 4,
        }), t + 0.42, ev.dur);
      }
    } else {
      const vowel = VOWELS[S.toward > 0.5 ? 'o' : X.lost > 0.4 ? 'u' : sc.vowel];
      track(voice(kit, L.pan.input, t, f, {
        vel: ev.vel * 0.9 * lv, dur: ev.dur, attack: 1.5 + 0.8 * S.away, vowel,
        spread: 2.5 + sc.detuneExtra + 6 * S.o, limit: lim,
      }), t, ev.dur);
      // mythic: a choir companion a fifth above
      if (A.mythic > 0.05 && rng() < A.mythic * 0.8) {
        track(voice(kit, L.pan.input, t + 0.7, degHz(sc, deg + 4, oct), {
          vel: ev.vel * 0.45 * lv, dur: ev.dur * 0.9, attack: 2, vowel: VOWELS.u, limit: lim - 4,
        }), t + 0.7, ev.dur);
      }
    }
  }

  // ---- arpeggio layer -----------------------------------------------------------
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
  // Regular voices take their pattern length, figure and register from the wave
  // identity (retune()). Roles: 0 = lead, 1 = contrary motion (figure mirrored),
  // 2 = canon (echoes the lead a fifth above, off the beat), 3 and 4 = full set.
  const VOICE_DEF = [
    { L: 6, style: 'rise', oct: 2, th: 0.16, M: 2, unlock: 'u3' },
    { L: 8, style: 'wave', oct: 2, th: 0.36, M: 3, unlock: 'u7' },
    { L: 5, style: 'broken', oct: 1, th: 0.5, M: 2, unlock: 'u13' },
    { L: 7, style: 'pedal', oct: 2, th: 0.64, M: 4, unlock: 'u15' },
    { L: 9, style: 'rise', oct: 3, th: 0.78, M: 3, unlock: 'u15' },
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
  const padPan = makePanner(bus.floeDry, bus.floeRev);
  const F = {
    next: 0, inChord: 1e9, chordIdx: -1, chordLen: 16, hornN: 0, stepDur: 30 / 132,
    stepN: 0, force: false, unisonUntil: -1, uIdx: 0, echo: [],
  };

  /** Give a voice the figure, cell length and register of a wave identity. */
  function retune(v, sc) {
    v.sc = sc;
    if (!v.extra) {
      v.L = sc.cells[v.k];
      v.style = STYLES[(STYLES.indexOf(sc.style) + v.k + sc.rev) % 4];
      v.oct = clamp(BASE_OCT[(v.k + sc.rev) % 5] + sc.octShift, 1, 3);
    }
    v.seq = makeSeq(v.style, v.L);
    v.pos = 0; v.add = 0; v.dir = 1; v.cycles = 0;
  }
  for (const v of fVoices) { v.switchAt = null; v.fadeIn = -1e9; retune(v, E.scale); }

  /** Level of a regular voice: stage unlock x complexity x fight arc x phase. */
  function voiceLevel(v, S, t) {
    const th = v.th * X.thScale;
    let lvl = smoothstep(th, th + 0.12 * X.thScale, S.c) * X[v.unlock];
    lvl *= smoothstep(v.k / 5 - 0.04, v.k / 5 + 0.08, X.den); // beats let the voices in, in order
    lvl *= v.k === 0 ? 1 - 0.45 * X.calm : 1 - X.calm; // calm: thin to the single lead voice
    lvl *= (1 - 0.85 * X.lost) * X.restArp;
    if (v.switchAt !== null) lvl *= 0.6; // still in the old wave's key: step back
    else if (t - v.fadeIn < 1.5) lvl *= 0.3 + (0.7 * (t - v.fadeIn)) / 1.5; // just handed over: fade in
    return lvl;
  }

  function voiceNote(v, t, lvl, S) {
    if (v.switchAt !== null && t >= v.switchAt) { // wave hand-over reaches this voice
      retune(v, E.scale);
      v.switchAt = null;
      v.fadeIn = t;
    }
    const sc = v.sc;
    const len = v.L + v.add;
    let idx = v.seq[Math.min(v.pos, v.seq.length - 1)];
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
    if (!v.extra) {
      if (t < F.unisonUntil) idx = F.uIdx; // gift: a brief unison on the lead's figure
      else if (v.k === 1) idx = 5 - idx; // contrary motion against the lead
    }
    const deg = sc.prog[Math.max(0, F.chordIdx)] + TONES[idx];
    if (v.k === 0) { // remember the lead for the canon voice
      F.echo.push({ deg, sc, oct: v.oct });
      if (F.echo.length > 8) F.echo.shift();
    }
    if (lvl < 0.02) return;
    if (rng() < 0.3 * S.away) return;
    // feel: 'dotted' delays every second step (long-short pairs); accents every `group` steps
    const tt = !v.extra && sc.feel === 'dotted' && F.stepN % 2 === 1 ? t + F.stepDur * 0.5 : t;
    const acc = first ? 1 : F.stepN % sc.group === 0 ? 0.88 : 0.68;
    playPluck(v, tt, degHz(sc, deg, v.oct), lvl * acc, S, sc);
  }

  function playPluck(v, t, f, vel, S, sc, wave) {
    const o = S.o;
    E.stats.notes++;
    pluck(kit, v.filt, t, f, {
      vel: vel * (v.extra ? 0.75 : 1.2),
      decay: (v.extra ? 0.06 : 0.1) + 0.05 * (1 - o),
      wave: wave || (v.extra || S.against > 0.5 ? 'pulse' : sc.pluck),
      cents: (rng() - 0.5) * (o * 30 + sc.detuneExtra),
      detune: o > 0.2 ? (6 + 22 * o) * (rng() < 0.5 ? -1 : 1) : 0,
      bell: S.asp.cortical,
      attack: S.against > 0.5 ? 0.002 : 0.005,
      limit: MUSIC_LIMIT,
    });
  }

  function chordStart(t, S, sc) {
    const k = X.thScale;
    const chordDur = F.chordLen * F.stepDur;
    const d = sc.prog[F.chordIdx];
    const o = S.o;
    // horns enter soft and grow with complexity (so they never darken the mix early)
    const hl = smoothstep(0.06 * k, 0.28 * k, S.c) * (0.5 + 0.5 * smoothstep(0.45, 1, S.c)) * (1 - 0.3 * S.away)
      * X.u5 * (0.45 + 0.55 * X.den) * (1 - 0.4 * X.calm) * (1 - 0.6 * X.lost);
    if (hl >= 0.02) {
      const dur = clamp(chordDur * 1.15, 4, 8);
      // mid register (root/fifth at octave 0, third above) so the arpeggio layer brightens the mix
      const notes = [[d, 0], [d + 4, 0], [d + 2, 1]];
      if (S.asp.mythic > 0.3) notes.push([d + 7, 1]);
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
    // bowed-glass pad: two colour tones (seventh, high third) held across the chord
    const pl = X.u9 * smoothstep(0.2 * k, 0.5 * k, S.c) * (0.5 + 0.5 * X.den) * (1 - 0.5 * X.lost);
    if (pl >= 0.03) {
      const dur = clamp(chordDur * 1.3, 5, 9);
      [[d + 6, 1], [d + 2, 2]].forEach(([deg, oct], i) => {
        track(glass(kit, padPan.input, t + 0.3 + i * 0.5, degHz(sc, deg, oct), { vel: pl * (i ? 0.6 : 0.9), dur, partials: 2, limit: MUSIC_LIMIT - 2 }), t + 0.3 + i * 0.5, dur);
      });
      E.stats.notes++;
    }
  }

  /** A pending wave identity takes over: the 4-8 s cross-fade starts at t. */
  let pending = null;
  function beginTransition(t) {
    const sc = pending.sc;
    pending = null;
    if (sc === E.scale) return;
    E.scale = sc;
    E.stats.transitions = (E.stats.transitions || 0) + 1;
    keyAt = t; // drone dips, retunes, returns
    fadeLive(t + 0.4, 1.5); // old-key sustains ring out under the new key's entries
    // the pulse voices hand over one by one (lead first)
    for (const v of fVoices) v.switchAt = t + (v.extra ? 3 : 0.8 + v.k * 1.1);
    F.chordIdx = -1; // the new identity starts its chord cycle from the top
  }

  function floeStep(t) {
    const S = E.S;
    F.stepN++;
    F.inChord++;
    // phrase boundary = start of a chord; never keep a wave change waiting more than 8 s
    let boundary = F.inChord >= F.chordLen || F.force;
    if (pending && (boundary || t - pending.since > 8)) { beginTransition(t); boundary = true; }
    const sc = E.scale;
    if (boundary) {
      F.force = false;
      F.chordIdx = (F.chordIdx + 1) % 4;
      F.inChord = 0;
      F.chordLen = sc.beats[F.chordIdx] * 2; // eighths
      chordStart(t, S, sc);
    }
    const v0 = fVoices[0];
    F.uIdx = v0.seq[Math.min(v0.pos, v0.seq.length - 1)];
    for (const v of fVoices) {
      if (v.extra) {
        const lvl = smoothstep(v.th, v.th + 0.2, S.o) * smoothstep(0.4, 0.7, S.c) * X.u17 * X.den * (1 - X.calm) * (1 - X.lost);
        voiceNote(v, t, lvl, S);
        voiceNote(v, t + F.stepDur / 2, lvl, S);
      } else if (v.k === 2 && t >= F.unisonUntil) {
        // canon: the lead's note from two steps ago, a fifth above, on the off-sixteenth
        if (v.switchAt !== null && t >= v.switchAt) { retune(v, sc); v.switchAt = null; v.fadeIn = t; }
        const e = F.echo[F.echo.length - 2];
        const lvl = voiceLevel(v, S, t);
        if (e && lvl >= 0.02 && rng() >= 0.3 * S.away) playPluck(v, t + F.stepDur * 0.5, degHz(e.sc, e.deg + 4, e.oct), lvl * 0.9, S, e.sc, 'pulse');
      } else {
        voiceNote(v, t, voiceLevel(v, S, t), S);
      }
    }
    // soft low pulse on the chord root, every half bar
    if (F.stepN % 4 === 0) {
      const k = X.thScale;
      const lp = X.u11 * smoothstep(0.25 * k, 0.55 * k, S.c) * (0.4 + 0.6 * X.den) * (1 - 0.7 * X.calm) * (1 - X.lost) * X.restArp;
      if (lp > 0.03) {
        const f = degHz(sc, sc.prog[F.chordIdx], -1);
        thump(kit, bus.floeDry, t, { f0: f * 1.5, f1: f, dur: 0.42, vel: 0.2 * lp, limit: MUSIC_LIMIT });
      }
    }
  }

  // ---- phase gestures ---------------------------------------------------------
  /** 'won': the tonic chord opens upward through the first loops, a voice holds the root. */
  function wonBloom(t) {
    const sc = E.scale;
    [0, 2, 4, 7].forEach((deg, i) => {
      const L = loops[i % loops.length];
      track(piano(kit, L.pan.input, t + i * 0.28, degHz(sc, deg, 1), { vel: 0.5, dur: 6, bright: sc.bright, inharm: sc.inharm, limit: MUSIC_LIMIT }), t + i * 0.28, 6);
    });
    track(voice(kit, loops[1].pan.input, t + 0.2, degHz(sc, 0, 0), { vel: 0.5, dur: 6, vowel: VOWELS.a, limit: MUSIC_LIMIT - 4 }), t + 0.2, 6);
  }
  /** 'lost': a low, muffled turn (root, then the step below). */
  function lostTurn(t) {
    const sc = E.scale;
    [[0, 0], [-1, 0.9]].forEach(([deg, d]) => {
      if (X.u5 > 0.5) track(horn(kit, hornPans[0].input, t + d, degHz(sc, deg, -1), { vel: 0.7, dur: 4.5, cutoff: 420, spread: 10, limit: MUSIC_LIMIT }), t + d, 4.5);
      else track(piano(kit, loops[0].pan.input, t + d, degHz(sc, deg, 0), { vel: 0.55, dur: 5, bright: 0.3, limit: MUSIC_LIMIT }), t + d, 5);
    });
  }
  /** gift: a single high harmonic bloom over the tonic (harmonics 8, 10, 12). */
  function harmonicBloom(t) {
    const f = degHz(E.scale, 0, 0);
    [8, 10, 12].forEach((h, i) => {
      glass(kit, loops[(i * 3) % loops.length].pan.input, t + i * 0.8, f * h, { vel: 0.3 - i * 0.05, dur: 7 - i, attack: 2.5, limit: MUSIC_LIMIT - 3 });
    });
  }
  const R = { next: 1e9, layer: null, until: 0 }; // layer rests
  const Gf = { next: 1e9 }; // gifts

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
    R.next = now + 70 + lf() * 60; R.layer = null;
    Gf.next = now + 60 + lf() * 60;
  }

  function schedule(tEnd, now) {
    const S = E.S;
    if (live.length > 64) live = live.filter((n) => n.end > now);
    // phase gestures (set by the engine when `phase` changes)
    if (E.arcEvent) {
      const ev = E.arcEvent;
      E.arcEvent = null;
      const t = Math.max(now + 0.05, ev.t);
      if (ev.phase === 'won') wonBloom(t);
      else if (ev.phase === 'lost') lostTurn(t);
    }
    for (const L of loops) {
      const base = L.period * E.scale.periodScale;
      while (L.cycle + base * L.perMul < now - 10) L.cycle += base * L.perMul; // after a long stall
      for (let guard = 0; guard < 32; guard++) {
        const ev = L.phrase[L.j];
        const t = L.cycle + ev.off;
        if (t >= tEnd) break;
        if (t >= L.enabledAt && t >= now - 0.02) playLoopNote(L, ev, t);
        if (++L.j >= L.phrase.length) {
          L.j = 0;
          L.cycle += base * L.perMul;
          // long-form walk: the loop length breathes +-5 %, and now and then a
          // whole pass sits an octave away
          L.perMul = 1 + 0.05 * Math.sin((TAU * L.cycle) / L.w.pp + L.w.pph);
          L.octJ = lf() < 0.12 ? (lf() < 0.5 ? -1 : 1) : 0;
        }
      }
    }
    // gifts: rare single events (a high harmonic bloom, or a brief unison of the pulse voices)
    if (Gf.next < tEnd) {
      const t = Math.max(Gf.next, now + 0.05);
      if (lf() < 0.5 || S.c * X.u3 < 0.2) harmonicBloom(t);
      else F.unisonUntil = t + 5 + lf() * 3;
      E.stats.gifts = (E.stats.gifts || 0) + 1;
      Gf.next = t + 100 + lf() * 140;
    }
    if (F.next < now - 0.2) F.next = now + 0.02;
    while (F.next < tEnd) {
      F.stepDur = 30 / ((132 + 36 * S.o) * (1 - 0.06 * X.calm)); // prep breathes a little slower
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

    // ---- stage: what the palette has unlocked (S.stage is 99 when no stage is given)
    const U = (a) => smoothstep(a - 0.7, a, S.stage);
    X.u3 = U(STAGE_UNLOCK.pulse1); X.u5 = U(STAGE_UNLOCK.horns); X.u7 = U(STAGE_UNLOCK.pulse2);
    X.u9 = U(STAGE_UNLOCK.pad); X.u11 = U(STAGE_UNLOCK.lowPulse); X.u13 = U(STAGE_UNLOCK.canon);
    X.u15 = U(STAGE_UNLOCK.full); X.u17 = U(STAGE_UNLOCK.extras);
    // complexity thresholds shrink with the number of unlocked pulse voices, so
    // complexity sweeps the whole of whatever the stage offers
    X.thScale = 0.4 + 0.6 * ((X.u3 + X.u7 + X.u13 + 2 * X.u15) / 5);

    // ---- wave arc: phase + beat -> density / calm / lost
    const ph = E.target.phase;
    if (ph !== X.phase) {
      if (ph === 'fight') X.beatClock = -0.33; // the first beat lands ~0.8 s into the fight
      X.phase = ph;
    }
    let denT = 1, calmT = 0, lostT = 0;
    if (ph === 'fight') {
      const was = X.beat;
      if (typeof E.target.beat === 'number') X.beat = clamp(Math.floor(E.target.beat), 0, 9);
      else { X.beatClock += dt / (2.4 * (o > 0.5 ? 0.7 : 1)); X.beat = clamp(Math.floor(X.beatClock), 0, 9); }
      if (X.beat === 9 && was === 8) F.force = true; // last beat: release on a fresh chord
      denT = DEN[X.beat];
    } else if (ph === 'prep' || ph === 'won') calmT = 1;
    else if (ph === 'lost') lostT = 1;
    if (!X.init) { X.init = true; X.den = denT; X.calm = calmT; X.lost = lostT; }
    X.den += (denT - X.den) * approach(dt, 0.45);
    X.calm += (calmT - X.calm) * approach(dt, calmT > X.calm ? 1.2 : 0.8);
    X.lost += (lostT - X.lost) * approach(dt, lostT > X.lost ? 0.3 : 4);

    // ---- long form: layer rests and the filter walk
    if (!R.layer && T > R.next) {
      R.layer = pick(lf, c * X.u3 > 0.25 ? ['piano', 'voice', 'arp'] : ['piano', 'voice']);
      R.until = T + 12 + lf() * 14;
      E.stats.rests = (E.stats.rests || 0) + 1;
    } else if (R.layer && T > R.until) { R.layer = null; R.next = T + 80 + lf() * 90; }
    const ra = approach(dt, 2.5);
    X.restPiano += ((R.layer === 'piano' ? 0 : 1) - X.restPiano) * ra;
    X.restVoice += ((R.layer === 'voice' ? 0 : 1) - X.restVoice) * ra;
    X.restArp += ((R.layer === 'arp' ? 0 : 1) - X.restArp) * ra;
    X.cutWalk = 1 + 0.15 * Math.sin((TAU * T) / 97 + 1.3) + 0.08 * Math.sin((TAU * T) / 41 + 4.1);

    const dryMul = 1 - 0.35 * S.away - 0.3 * A.void;
    const revMul = 1 + 0.8 * S.away - 0.4 * S.against + 0.7 * A.void;
    // layer balances
    const air = clamp(1 - 0.5 * smoothstep(0.3, 1, c) - 0.25 * o, 0, 1) * (1 + 0.3 * X.calm); // loops bloom when calm
    bus.airDry.gain.linearRampToValueAtTime(air * dryMul, T);
    bus.airRev.gain.linearRampToValueAtTime(air * 0.6 * revMul, T);
    const k = X.thScale;
    const floe = smoothstep(0.05 * k, 0.3 * k, c) * X.u3 * (0.65 + 0.35 * X.den) * (1 - 0.25 * X.calm);
    bus.floeDry.gain.linearRampToValueAtTime(floe * (0.8 + 0.1 * o) * dryMul, T);
    bus.floeRev.gain.linearRampToValueAtTime(floe * 0.3 * revMul, T);
    bus.delaySend.gain.linearRampToValueAtTime(0.35 * A.relational, T);
    // tone shaping (stance + overwhelm)
    // brightness rises monotonically with complexity (gentle: +3 dB air, -2 dB body)
    const lift = 0.6 * smoothstep(0.02, 0.4, c) + 0.4 * smoothstep(0.35, 0.9, c);
    E.nodes.tiltHi.gain.linearRampToValueAtTime(3 * lift - 3 * S.toward - 2 * S.away + 4 * S.against + 2 * o - 2 * A.shadow - 10 * X.lost, T);
    E.nodes.tiltLo.gain.linearRampToValueAtTime(-2 * lift + 2 * S.toward + 1.5 * A.limbic + 1.5 * A.shadow, T);
    const sat = 0.6 * o * o;
    E.nodes.satClean.gain.linearRampToValueAtTime(1 - sat, T);
    E.nodes.satDrive.gain.linearRampToValueAtTime(sat, T);
    // arpeggio voice filters open with overwhelm / against / cortical
    const cut = (2400 + 5200 * o + 2200 * S.against + 900 * A.cortical + 300 * sc.bright) * (0.7 + 0.3 * X.den) * X.cutWalk * (1 - 0.5 * X.lost);
    for (const v of fVoices) v.filt.frequency.linearRampToValueAtTime(cut * (1 + 0.15 * v.oct), T);

    // orbits: every ambient loop circles the listener on its own period
    const rMul = 1 + 0.5 * S.away + 0.3 * A.void;
    for (const L of loops) {
      const ob = L.orbit;
      const a = ob.phase + (ob.dir * TAU * T) / ob.period;
      const r = ob.r * rMul * (1 + 0.2 * Math.sin((TAU * T) / L.w.rp + L.w.rph)); // orbit radius walks
      moveTo(L.pan, P[0] + r * Math.cos(a), P[1] + ob.y + Math.sin(a * 0.7), P[2] + r * Math.sin(a), T);
    }
    for (const v of fVoices) {
      v.ang += v.drift * dt;
      const r = RING * (v.extra ? 0.8 : 1) * rMul;
      moveTo(v.pan, P[0] + r * Math.cos(v.ang), P[1] + (v.oct - 1.5) * 0.8, P[2] + r * Math.sin(v.ang), T);
    }
    moveTo(padPan, P[0] + 4 * Math.cos(T * 0.03), P[1] + 3, P[2] + 4 * Math.sin(T * 0.03), T);
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
   * the arpeggio layer restarts its chord cycle so horns re-swell in the new key.
   */
  function keyChange(now) {
    keyAt = now;
    pending = null;
    fadeLive(now, 0.3);
    for (const v of fVoices) { retune(v, E.scale); v.switchAt = null; v.fadeIn = now; }
    F.inChord = 1e9;
    F.chordIdx = -1;
  }
  /** Wave / cycle changed: hand over to `sc` at the next phrase boundary (soft cross-fade). */
  function requestScale(sc, now) {
    pending = sc === E.scale ? null : { sc, since: now };
  }
  /** Before start(): take an identity at once, no fades. */
  function adopt(sc) {
    pending = null;
    droneScale = sc;
    for (const v of fVoices) { retune(v, sc); v.switchAt = null; v.fadeIn = -1e9; }
  }

  /** Non-mind collapse: silence the arpeggio layer, regrow the ambient loops from one loop. */
  function reset(t) {
    const order = loops.slice().sort((a, b) => (a.inst === 'piano' ? 0 : 1) - (b.inst === 'piano' ? 0 : 1));
    order.forEach((L, k) => {
      const at = k === 0 ? t + 4.4 : t + 9 + k * 5.5 + rng() * 3;
      L.enabledAt = at;
      L.cycle = at - L.phrase[0].off;
      L.j = 0;
    });
    if (pending) { E.scale = pending.sc; pending = null; } // everything is silent: just take the new wave
    for (const v of fVoices) { retune(v, E.scale); v.switchAt = null; v.fadeIn = -1e9; }
    F.inChord = 1e9;
    F.chordIdx = -1;
    F.unisonUntil = -1;
  }

  function dispose() {
    const T = ctx.currentTime;
    for (const n of [d1, d2, breath]) { try { n.stop(T + 0.05); } catch (e) { /* */ } }
    killShepard(T);
    const all = [droneOut, droneLP, d1, d2, d2g, breath, breathBP, breathG, ...hornPans.flatMap((h) => [h.input, h.p]), padPan.input, padPan.p];
    for (const L of loops) all.push(L.pan.input, L.pan.p);
    for (const v of fVoices) all.push(v.filt, v.pan.input, v.pan.p);
    setTimeoutSafe(() => all.forEach((n) => { try { n.disconnect(); } catch (e) { /* */ } }), 200);
  }

  return { schedule, control, reset, restart, dispose, keyChange, requestScale, adopt, loops, fVoices };
}
