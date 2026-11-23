// Browser side of the offline render harness. Exposes window.__audioTest.
import { createAudioEngine, SFX_NAMES, ASPECTS } from '/src/audio/engine.js';

const SR = 44100;

function fft(re, im) {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) { [re[i], re[j]] = [re[j], re[i]]; [im[i], im[j]] = [im[j], im[i]]; }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = (-2 * Math.PI) / len, wr = Math.cos(ang), wi = Math.sin(ang);
    for (let i = 0; i < n; i += len) {
      let cr = 1, ci = 0;
      for (let k = 0; k < len / 2; k++) {
        const a = i + k, b = a + len / 2;
        const xr = re[b] * cr - im[b] * ci, xi = re[b] * ci + im[b] * cr;
        re[b] = re[a] - xr; im[b] = im[a] - xi; re[a] += xr; im[a] += xi;
        const nr = cr * wr - ci * wi; ci = cr * wi + ci * wr; cr = nr;
      }
    }
  }
}

function spectra(mono, N, hop, cb) {
  const win = new Float32Array(N);
  for (let i = 0; i < N; i++) win[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / N);
  const re = new Float64Array(N), im = new Float64Array(N);
  for (let s = 0; s + N <= mono.length; s += hop) {
    for (let i = 0; i < N; i++) { re[i] = mono[s + i] * win[i]; im[i] = 0; }
    fft(re, im);
    const mag = new Float32Array(N / 2);
    for (let k = 0; k < N / 2; k++) mag[k] = Math.hypot(re[k], im[k]);
    cb(mag, s);
  }
}

export function analyze(buf, from = 0, to = Infinity) {
  const L = buf.getChannelData(0), R = buf.numberOfChannels > 1 ? buf.getChannelData(1) : L;
  const a = Math.floor(from * SR), b = Math.min(L.length, Math.floor(to * SR));
  const n = b - a;
  const mono = new Float32Array(n);
  let peak = 0, ss = 0, dc = 0, nan = 0;
  for (let i = 0; i < n; i++) {
    const l = L[a + i], r = R[a + i];
    if (!Number.isFinite(l) || !Number.isFinite(r)) { nan++; continue; }
    peak = Math.max(peak, Math.abs(l), Math.abs(r));
    ss += l * l + r * r;
    mono[i] = 0.5 * (l + r);
    dc += mono[i];
  }
  const rms = Math.sqrt(ss / (2 * n));
  // silent 100 ms windows (< -60 dBFS)
  const W = SR / 10;
  let silent = 0, wins = 0;
  for (let s = 0; s + W <= n; s += W) {
    let e = 0;
    for (let i = 0; i < W; i++) e += mono[s + i] * mono[s + i];
    wins++;
    if (Math.sqrt(e / W) < 0.001) silent++;
  }
  // spectral centroid (magnitude weighted, all frames)
  let num = 0, den = 0;
  spectra(mono, 2048, 2048, (mag) => {
    for (let k = 1; k < mag.length; k++) { num += k * (SR / 2048) * mag[k]; den += mag[k]; }
  });
  // onsets: band energy flux. Energy of 4 bands per 512-sample hop (FFT 1024),
  // in dB; flux = sum over bands of the rise versus the max of the previous 3
  // frames (ignores slow swells/vibrato); peak-picked over an adaptive
  // threshold with a 70 ms refractory period.
  const BANDS = [[80, 400], [400, 1500], [1500, 4000], [4000, 12000]].map(([lo, hi]) => [Math.round(lo / (SR / 1024)), Math.round(hi / (SR / 1024))]);
  const hist = [];
  spectra(mono, 1024, 512, (mag) => {
    hist.push(BANDS.map(([lo, hi]) => { let x = 0; for (let k = lo; k < hi; k++) x += mag[k] * mag[k]; return 10 * Math.log10(x + 1e-9); }));
  });
  // floor each band 35 dB below its loudest frame so near-silent bands do not flicker
  const floors = BANDS.map((_, j) => Math.max(...hist.map((h) => h[j])) - 35);
  for (const h of hist) for (let j = 0; j < h.length; j++) h[j] = Math.max(h[j], floors[j]);
  const flux = hist.map((e, i) => {
    if (i < 3) return 0;
    let f = 0;
    for (let j = 0; j < e.length; j++) f += Math.max(0, e[j] - Math.max(hist[i - 1][j], hist[i - 2][j], hist[i - 3][j]));
    return f;
  });
  let onsets = 0, lastOn = -1e9;
  for (let i = 1; i < flux.length - 1; i++) {
    const lo = Math.max(0, i - 20), hi = Math.min(flux.length, i + 20);
    const loc = flux.slice(lo, hi).sort((x, y) => x - y);
    const med = loc[loc.length >> 1];
    const th = med + 2.5;
    if (flux[i] > th && flux[i] >= flux[i - 1] && flux[i] >= flux[i + 1] && i - lastOn > 6) { onsets++; lastOn = i; }
  }
  // audible duration: span where 10 ms RMS exceeds -30 dB relative to its max
  const w10 = SR / 100, env = [];
  for (let s = 0; s + w10 <= n; s += w10) {
    let e = 0;
    for (let i = 0; i < w10; i++) e += mono[s + i] * mono[s + i];
    env.push(Math.sqrt(e / w10));
  }
  const emax = Math.max(...env, 1e-12);
  let first = -1, last = -1;
  env.forEach((v, i) => { if (v > emax * 0.03) { if (first < 0) first = i; last = i; } });
  let tailE = 0;
  const tailN = Math.min(n, Math.floor(SR * 0.25));
  for (let i = n - tailN; i < n; i++) tailE += mono[i] * mono[i];
  const r3 = (x) => Math.round(x * 1000) / 1000;
  return {
    peak: r3(peak), rms: r3(rms), rmsDb: Math.round(20 * Math.log10(rms + 1e-12) * 10) / 10,
    dc: Number(((dc / n) || 0).toExponential(2)), silentPct: Math.round((silent / Math.max(1, wins)) * 1000) / 10,
    centroid: Math.round(num / Math.max(den, 1e-12)), nan, onsets,
    onsetsPerMin: Math.round((onsets / (n / SR)) * 60),
    dur: first < 0 ? 0 : r3((last - first + 1) / 100), tailRms: Number(Math.sqrt(tailE / tailN).toExponential(2)),
  };
}

function toWavB64(buf, from, to) {
  const ch = buf.numberOfChannels, a = Math.floor(from * SR), b = Math.min(buf.length, Math.floor(to * SR));
  const n = b - a;
  const out = new DataView(new ArrayBuffer(44 + n * ch * 2));
  const ws = (o, s) => { for (let i = 0; i < s.length; i++) out.setUint8(o + i, s.charCodeAt(i)); };
  ws(0, 'RIFF'); out.setUint32(4, 36 + n * ch * 2, true); ws(8, 'WAVE'); ws(12, 'fmt ');
  out.setUint32(16, 16, true); out.setUint16(20, 1, true); out.setUint16(22, ch, true);
  out.setUint32(24, SR, true); out.setUint32(28, SR * ch * 2, true); out.setUint16(32, ch * 2, true);
  out.setUint16(34, 16, true); ws(36, 'data'); out.setUint32(40, n * ch * 2, true);
  const chans = [...Array(ch)].map((_, c) => buf.getChannelData(c));
  let o = 44;
  for (let i = a; i < b; i++) for (let c = 0; c < ch; c++) {
    const v = Math.max(-1, Math.min(1, chans[c][i] || 0));
    out.setInt16(o, Math.round(v * 32767), true); o += 2;
  }
  const bytes = new Uint8Array(out.buffer);
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  return btoa(s);
}

/**
 * cfg: { mood, dur, seed, events: [{t, mood?|reset?|sfx?}], wav: [from,to], segments: [[a,b],...] }
 */
async function renderMusic(cfg) {
  const dur = cfg.dur ?? 40;
  const ctx = new OfflineAudioContext(2, SR * dur, SR);
  const eng = createAudioEngine(ctx, { seed: cfg.seed ?? 7, offline: true });
  eng.setMood(cfg.mood || {});
  eng.start();
  let maxOsc = 0;
  for (let t = 0.5; t < dur; t += 0.5) eng.at(t, () => { maxOsc = Math.max(maxOsc, eng.debug().osc); });
  for (const ev of cfg.events || []) {
    eng.at(ev.t, () => {
      if (ev.reset) eng.reset();
      if (ev.mood) eng.setMood(ev.mood);
      if (ev.sfx) eng.sfx(ev.sfx, ev.opts || {});
    });
  }
  const t0 = performance.now();
  const buf = await ctx.startRendering();
  const res = { ...analyze(buf), notes: eng.debug().notes, maxOsc, renderMs: Math.round(performance.now() - t0) };
  if (cfg.segments) res.segments = cfg.segments.map(([a, b]) => ({ from: a, to: b, ...analyze(buf, a, b) }));
  if (cfg.wav) res.wav = toWavB64(buf, cfg.wav[0], cfg.wav[1]);
  eng.dispose();
  return res;
}

async function renderSfx(name, opts = {}) {
  const dur = name === 'reset' ? 9 : 3.5;
  const ctx = new OfflineAudioContext(2, SR * dur, SR);
  const eng = createAudioEngine(ctx, { seed: 3, offline: true });
  eng.setMood({ depth: opts.depth ?? 0 });
  eng.sfx(name, { position: [1.5, 0, -2], intensity: 0.8, ...opts });
  const buf = await ctx.startRendering();
  eng.dispose();
  return analyze(buf);
}

window.__audioTest = { renderMusic, renderSfx, SFX_NAMES, ASPECTS, ready: true };
