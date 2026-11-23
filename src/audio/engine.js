// NON-MIND audio engine — procedural generative music + spatial SFX.
// Pure Web Audio API: no libraries, no samples, no network.
//
//   const eng = createAudioEngine(ctx, { seed: 1 });
//   eng.start(); eng.setMood({ complexity: 0.4 }); eng.sfx('attend', { position: [1, 0, -2] });
//
// Signal graph
//   music voices -> per-voice HRTF panners -> airDry / floeDry ─┐
//                \-> airRev / floeRev -> reverbIn -> Convolver ─┤
//   drone / breath / shepard -> musicDry ───────────────────────┤
//   relational ping-pong delay ─────────────────────────────────┤
//        musicSum -> [clean | tanh drive] -> tilt shelves -> collapse LP -> duck -> musicGain ─┐
//   sfx voices -> (HRTF panner) -> sfxDry + sfxRev(Convolver) -> sfxGain ──────────────────────┤
//        master -> mute -> DynamicsCompressor -> makeup -> soft-clip WaveShaper -> Analyser -> out
//
// Scheduling: a lookahead scheduler (setInterval 25 ms, events scheduled
// ~150 ms ahead on ctx.currentTime). For OfflineAudioContext the engine steps
// through the render deterministically with ctx.suspend() every 0.1 s and
// pre-schedules each window, so mood changes / reset() at given times (see
// engine.at()) are rendered sample-accurately and reproducibly.

import { mulberry32, clamp, approach, makeScale, VoiceBudget } from './util.js';
import { createKit, makeImpulse } from './instruments.js';
import { createMusic } from './music.js';
import { createSfx, SFX_NAMES } from './sfx.js';

export { SFX_NAMES };
export const ASPECTS = ['vagal', 'limbic', 'cortical', 'somatic', 'shadow', 'relational', 'void', 'mythic'];
export const STANCES = ['toward', 'away', 'against'];

const RT_LOOKAHEAD = 0.15;
const RT_INTERVAL_MS = 25;
const RT_CONTROL_MIN = 0.08;
const OFF_STEP = 0.1;
const OFF_LOOKAHEAD = 0.3;

export function createAudioEngine(ctx, opts = {}) {
  const isOfflineCtx = typeof OfflineAudioContext !== 'undefined' && ctx instanceof OfflineAudioContext;
  const offline = opts.offline ?? isOfflineCtx;
  const seed = (opts.seed ?? 1) >>> 0;
  const rng = mulberry32(seed);
  const budget = new VoiceBudget(48);
  const kit = createKit(ctx, budget, seed);
  const t0 = ctx.currentTime;

  // ---- mood: targets + smoothed values ------------------------------------
  const target = {
    complexity: 0, overwhelm: 0, tension: 0, depth: 0, stance: null,
    aspects: Object.fromEntries(ASPECTS.map((a) => [a, 0])),
  };
  const S = {
    c: 0, o: 0, ten: 0, toward: 0, away: 0, against: 0,
    asp: Object.fromEntries(ASPECTS.map((a) => [a, 0])),
  };
  function smooth(dt) {
    S.c += (target.complexity - S.c) * approach(dt, 2.0);
    S.o += (target.overwhelm - S.o) * approach(dt, target.overwhelm > S.o ? 1.2 : 0.8);
    S.ten += (target.tension - S.ten) * approach(dt, 2.0);
    for (const st of STANCES) S[st] += ((target.stance === st ? 1 : 0) - S[st]) * approach(dt, 3.0);
    for (const a of ASPECTS) S.asp[a] += (target.aspects[a] - S.asp[a]) * approach(dt, 3.0);
  }
  function snap() {
    S.c = target.complexity; S.o = target.overwhelm; S.ten = target.tension;
    for (const st of STANCES) S[st] = target.stance === st ? 1 : 0;
    for (const a of ASPECTS) S.asp[a] = target.aspects[a];
  }

  // ---- graph --------------------------------------------------------------
  const ctl = (param, v) => { param.setValueAtTime(v, t0); return param; };
  const G = (v) => { const g = ctx.createGain(); ctl(g.gain, v); return g; };

  // master chain
  const userMaster = G(0.8), mute = G(1);
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -20; comp.knee.value = 10; comp.ratio.value = 3.5;
  comp.attack.value = 0.006; comp.release.value = 0.25;
  const makeup = G(1.15);
  const clip = ctx.createWaveShaper();
  {
    // linear below 0.6, smooth tanh knee above; endpoints < 0.9 so peak < 1.0
    const n = 4096, c = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const x = (i / (n - 1)) * 2 - 1, ax = Math.abs(x);
      c[i] = Math.sign(x) * (ax < 0.6 ? ax : 0.6 + 0.3 * Math.tanh((ax - 0.6) / 0.3));
    }
    clip.curve = c;
    clip.oversample = 'none';
  }
  const analyser = ctx.createAnalyser();
  analyser.fftSize = 1024;
  analyser.smoothingTimeConstant = 0.7;
  userMaster.connect(mute).connect(comp).connect(makeup).connect(clip).connect(analyser).connect(ctx.destination);

  // music chain
  const musicGain = G(0.9);
  const duck = G(1);
  const runGain = G(0);
  const collapseLP = ctx.createBiquadFilter();
  collapseLP.type = 'lowpass'; ctl(collapseLP.frequency, 18000); collapseLP.Q.value = 0.5;
  const tiltLo = ctx.createBiquadFilter();
  tiltLo.type = 'lowshelf'; tiltLo.frequency.value = 220; ctl(tiltLo.gain, 0);
  const tiltHi = ctx.createBiquadFilter();
  tiltHi.type = 'highshelf'; tiltHi.frequency.value = 3200; ctl(tiltHi.gain, 0);
  const musicSum = G(1);
  const satClean = G(1), satDrive = G(0);
  // drive path: unity small-signal gain, tanh(3x)/3 squashes peaks above ~0.15
  const satPre = G(1);
  const sat = ctx.createWaveShaper();
  {
    const n = 2048, c = new Float32Array(n);
    for (let i = 0; i < n; i++) { const x = (i / (n - 1)) * 2 - 1; c[i] = Math.tanh(3 * x) / 3; }
    sat.curve = c;
    sat.oversample = offline ? 'none' : '2x';
  }
  const dcBlock = ctx.createBiquadFilter(); // saturating asymmetric pulses creates DC
  dcBlock.type = 'highpass'; dcBlock.frequency.value = 24; dcBlock.Q.value = 0.6;
  musicSum.connect(satClean).connect(dcBlock);
  musicSum.connect(satPre).connect(sat).connect(satDrive).connect(dcBlock);
  dcBlock.connect(tiltLo);
  tiltLo.connect(tiltHi).connect(collapseLP).connect(duck).connect(runGain).connect(musicGain).connect(userMaster);

  const musicDry = G(1);
  musicDry.connect(musicSum);
  const reverb = ctx.createConvolver();
  reverb.buffer = makeImpulse(ctx, 5.6, seed + 3);
  const reverbIn = G(1);
  const reverbOut = G(0.9);
  reverbIn.connect(reverb).connect(reverbOut).connect(musicSum);
  const airDry = G(1), airRev = G(0.6), floeDry = G(0), floeRev = G(0);
  airDry.connect(musicDry); floeDry.connect(musicDry);
  airRev.connect(reverbIn); floeRev.connect(reverbIn);

  // relational: stereo ping-pong delay, fed from the dry layers
  const delaySend = G(0);
  const dL = ctx.createDelay(2), dR = ctx.createDelay(2);
  dL.delayTime.value = 0.43; dR.delayTime.value = 0.61;
  const fbL = G(0.38), fbR = G(0.38);
  const dLP = ctx.createBiquadFilter(); dLP.type = 'lowpass'; dLP.frequency.value = 2600;
  const merger = ctx.createChannelMerger(2);
  airDry.connect(delaySend); floeDry.connect(delaySend);
  delaySend.connect(dLP).connect(dL);
  dL.connect(merger, 0, 0); dR.connect(merger, 0, 1);
  dL.connect(fbL).connect(dR); dR.connect(fbR).connect(dL);
  const delayOut = G(0.6);
  merger.connect(delayOut).connect(musicSum);

  // sfx chain (own shorter reverb so the music "duck" does not swallow it)
  const sfxGain = G(0.9);
  const sfxSum = G(1);
  const sfxDry = G(1);
  const sfxRevIn = G(1);
  const sfxReverb = ctx.createConvolver();
  sfxReverb.buffer = makeImpulse(ctx, 2.4, seed + 11, { predelay: 0.012 });
  sfxDry.connect(sfxSum);
  sfxRevIn.connect(sfxReverb).connect(sfxSum);
  sfxSum.connect(sfxGain).connect(userMaster);

  const E = {
    ctx, kit, rng, budget, seed, offline, S, target,
    scale: makeScale(0),
    listener: { pos: [0, 0, 0], fwd: [0, 0, -1], up: [0, 1, 0] },
    bus: { airDry, airRev, floeDry, floeRev, musicDry, reverbIn, delaySend, sfxDry, sfxRev: sfxRevIn },
    nodes: { tiltHi, tiltLo, satClean, satDrive },
    reset: () => reset(),
    stats: { notes: 0 }, // count of music note events actually played (for tests)
  };
  const music = createMusic(E);
  const sfxEngine = createSfx(E);

  // ---- scheduler ----------------------------------------------------------
  let started = false, disposed = false, timer = null, lastCtl = null;
  const atQueue = []; // offline callbacks [{time, fn}]

  function tick(lookahead, force) {
    const now = ctx.currentTime;
    const T = now + lookahead;
    if (lastCtl === null) lastCtl = now;
    const dt = T - lastCtl;
    if (force || dt >= RT_CONTROL_MIN) {
      smooth(dt);
      music.control(T, dt);
      lastCtl = T;
    }
    music.schedule(T, now);
    budget.prune(now - 0.05);
  }
  function runAt(t) {
    while (atQueue.length && atQueue[0].time <= t + 1e-6) {
      const { fn } = atQueue.shift();
      try { fn(); } catch (e) { console.error(e); }
    }
  }

  function start() {
    if (started || disposed) return;
    started = true;
    const now = ctx.currentTime;
    music.restart(now);
    lastCtl = null;
    runGain.gain.cancelScheduledValues(now);
    runGain.gain.setValueAtTime(runGain.gain.value, now);
    runGain.gain.linearRampToValueAtTime(1, now + 0.6);
    if (offline) {
      const sr = ctx.sampleRate;
      const dur = ctx.length / sr;
      const quant = (t) => (Math.round((t * sr) / 128) * 128) / sr;
      let k = 0;
      const step = () => {
        if (!started || disposed) return;
        runAt(ctx.currentTime);
        tick(OFF_LOOKAHEAD, true);
        k++;
        const next = quant(k * OFF_STEP);
        if (next < dur - 0.02 && typeof ctx.suspend === 'function') {
          ctx.suspend(next).then(() => { step(); ctx.resume(); });
        }
      };
      if (typeof ctx.suspend === 'function') step();
      else {
        // no suspend(): pre-schedule the whole duration deterministically
        for (let t = now; t < dur; t += OFF_STEP) { smooth(OFF_STEP); music.control(t + OFF_STEP, OFF_STEP); music.schedule(t + OFF_STEP, t); }
      }
    } else {
      tick(RT_LOOKAHEAD, true);
      timer = setInterval(() => tick(RT_LOOKAHEAD, false), RT_INTERVAL_MS);
    }
  }

  function stop() {
    if (!started) return;
    started = false;
    if (timer) clearInterval(timer);
    timer = null;
    const now = ctx.currentTime;
    runGain.gain.cancelScheduledValues(now);
    runGain.gain.setValueAtTime(runGain.gain.value, now);
    runGain.gain.linearRampToValueAtTime(0, now + 1.0);
  }

  // ---- parameters ---------------------------------------------------------
  const setP = (param, v, tau = 0.05) => param.setTargetAtTime(v, ctx.currentTime, tau);
  const setMaster = (v) => setP(userMaster.gain, clamp(+v || 0, 0, 1.5));
  const setMusic = (v) => setP(musicGain.gain, clamp(+v || 0, 0, 1.5));
  const setSfx = (v) => setP(sfxGain.gain, clamp(+v || 0, 0, 1.5));
  const setMuted = (m) => setP(mute.gain, m ? 0 : 1, 0.08);

  function setListener(l = {}) {
    const L = ctx.listener;
    const { position: p, forward: f, up: u } = l;
    if (p) {
      E.listener.pos = [p[0], p[1], p[2]];
      if (L.positionX) { L.positionX.value = p[0]; L.positionY.value = p[1]; L.positionZ.value = p[2]; }
      else if (L.setPosition) L.setPosition(p[0], p[1], p[2]);
    }
    if (f || u) {
      const F = f || E.listener.fwd, U = u || E.listener.up;
      E.listener.fwd = F; E.listener.up = U;
      if (L.forwardX) {
        L.forwardX.value = F[0]; L.forwardY.value = F[1]; L.forwardZ.value = F[2];
        L.upX.value = U[0]; L.upY.value = U[1]; L.upZ.value = U[2];
      } else if (L.setOrientation) L.setOrientation(F[0], F[1], F[2], U[0], U[1], U[2]);
    }
  }

  function setMood(m = {}) {
    if (typeof m.complexity === 'number') target.complexity = clamp(m.complexity);
    if (typeof m.overwhelm === 'number') target.overwhelm = clamp(m.overwhelm);
    if (typeof m.tension === 'number') target.tension = clamp(m.tension);
    if ('stance' in m) target.stance = STANCES.includes(m.stance) ? m.stance : null;
    if (m.aspects && typeof m.aspects === 'object') {
      for (const a of ASPECTS) if (typeof m.aspects[a] === 'number') target.aspects[a] = clamp(m.aspects[a]);
    }
    if (typeof m.depth === 'number') {
      const d = Math.max(0, Math.floor(m.depth));
      if (d !== target.depth) { target.depth = d; E.scale = makeScale(d); }
    }
    if (!started) snap(); // before start(): apply immediately (deterministic offline renders)
  }

  function sfx(name, o = {}) {
    if (disposed) return false;
    return sfxEngine.play(name, o || {});
  }

  /** The big "non-mind" collapse: ~2 s to a single pure tone, then regrowth. */
  function reset() {
    if (disposed) return;
    const t = ctx.currentTime + 0.02;
    target.complexity = 0; target.overwhelm = 0; target.tension = 0;
    S.c = 0; S.o = 0; S.ten = 0;
    const hold = (p) => {
      if (p.cancelAndHoldAtTime) p.cancelAndHoldAtTime(t);
      else { p.cancelScheduledValues(t); p.setValueAtTime(p.value, t); }
    };
    hold(duck.gain);
    duck.gain.setTargetAtTime(0.0003, t, 0.42);
    duck.gain.setTargetAtTime(1, t + 4.2, 1.1);
    hold(collapseLP.frequency);
    collapseLP.frequency.exponentialRampToValueAtTime(160, t + 1.7);
    collapseLP.frequency.setValueAtTime(160, t + 3.8);
    collapseLP.frequency.exponentialRampToValueAtTime(18000, t + 7.5);
    music.reset(t);
    sfxEngine.resetGesture(t);
  }

  // Levels for visuals: cheap, reuses typed arrays; zeros when offline.
  const fbuf = new Uint8Array(analyser.frequencyBinCount);
  const tbuf = new Float32Array(analyser.fftSize);
  const binHz = ctx.sampleRate / analyser.fftSize;
  const iLow = Math.max(1, Math.round(250 / binHz)), iMid = Math.round(2500 / binHz);
  const ZERO = Object.freeze({ low: 0, mid: 0, high: 0, rms: 0 });
  function getLevels() {
    if (offline || disposed) return ZERO;
    analyser.getByteFrequencyData(fbuf);
    let lo = 0, mi = 0, hi = 0;
    for (let i = 1; i < fbuf.length; i++) {
      if (i < iLow) lo += fbuf[i]; else if (i < iMid) mi += fbuf[i]; else hi += fbuf[i];
    }
    analyser.getFloatTimeDomainData(tbuf);
    let s = 0;
    for (let i = 0; i < tbuf.length; i++) s += tbuf[i] * tbuf[i];
    return {
      low: lo / ((iLow - 1) * 255),
      mid: mi / ((iMid - iLow) * 255),
      high: Math.min(1, (hi / ((fbuf.length - iMid) * 255)) * 2),
      rms: Math.min(1, Math.sqrt(s / tbuf.length) * 3),
    };
  }

  /** Run fn at context time `time` (offline: exact step; realtime: setTimeout). */
  function at(time, fn) {
    if (offline) {
      atQueue.push({ time, fn });
      atQueue.sort((a, b) => a.time - b.time);
    } else setTimeout(fn, Math.max(0, (time - ctx.currentTime) * 1000));
  }

  function dispose() {
    if (disposed) return;
    stop();
    disposed = true;
    music.dispose();
    const all = [userMaster, mute, comp, makeup, clip, analyser, musicGain, duck, runGain, collapseLP, tiltLo, tiltHi,
      musicSum, dcBlock, satClean, satDrive, satPre, sat, musicDry, reverb, reverbIn, reverbOut, airDry, airRev, floeDry, floeRev,
      delaySend, dL, dR, fbL, fbR, dLP, merger, delayOut, sfxGain, sfxSum, sfxDry, sfxRevIn, sfxReverb];
    setTimeout(() => all.forEach((n) => { try { n.disconnect(); } catch (e) { /* */ } }), 250);
  }

  return {
    start, stop, setMaster, setMusic, setSfx, setMuted, setListener, setMood, sfx, reset, getLevels,
    analyser, dispose, at,
    get started() { return started; },
    get ctx() { return ctx; },
    /** Debug snapshot (smoothed mood, scale name, live oscillator count). */
    debug: () => ({ ...S, asp: { ...S.asp }, scale: E.scale.name, osc: budget.countAt(ctx.currentTime) + budget.persistent, notes: E.stats.notes }),
  };
}

// ---- lazily created singleton for the game -------------------------------------
let single = null;
/**
 * getAudio(): creates an AudioContext + engine on first call (the context
 * stays suspended until unlock() is called from a user gesture). Returns the
 * engine object plus unlock(): resumes the context and starts the music.
 */
export function getAudio(opts = {}) {
  if (single) return single;
  const AC = typeof window !== 'undefined' && (window.AudioContext || window.webkitAudioContext);
  if (!AC) throw new Error('Web Audio not available');
  const ctx = new AC({ latencyHint: 'interactive' });
  const eng = createAudioEngine(ctx, opts);
  let unlocked = false;
  eng.unlock = async (o = {}) => {
    try { if (ctx.state !== 'running') await ctx.resume(); } catch (e) { /* not a gesture yet */ }
    if (ctx.state === 'running') {
      unlocked = true;
      if (o.music !== false && !eng.started) eng.start();
    }
    return unlocked;
  };
  eng.isUnlocked = () => unlocked && ctx.state === 'running';
  single = eng;
  return eng;
}
