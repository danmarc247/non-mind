// NON-MIND audio: offline render + measurement harness.
//
//   cd /home/user/non-mind && npx vite --port 5183 --strictPort &
//   node tests/audio/render.cjs http://localhost:5183 [wavDir]
//
// Renders several moods through OfflineAudioContext(2, 44100*40, 44100) in
// headless Chromium, prints peak / RMS / DC / silence / centroid / NaN /
// onsets per render, renders every SFX once, and asserts sanity bounds.
// Exit code 1 on any failed assertion.

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const base = (process.argv[2] || 'http://localhost:5183').replace(/\/$/, '');
const wavDir = process.argv[3] || '/tmp/claude-0/-home-user/bc92351f-c73a-5da5-a249-f7cf1432bb3b/scratchpad/audio';

const RENDERS = [
  { id: 'simple', mood: { complexity: 0 }, wav: [0, 30] },
  { id: 'mid', mood: { complexity: 0.5 } },
  { id: 'full', mood: { complexity: 1, overwhelm: 1, tension: 0.6 }, wav: [0, 30] },
  {
    id: 'reset@20',
    mood: { complexity: 1, overwhelm: 0.7 },
    events: [{ t: 20, reset: true }, { t: 20.1, mood: { complexity: 0, overwhelm: 0 } }],
    segments: [[15, 20], [21.5, 24], [24, 28]],
    wav: [10, 40],
  },
  { id: 'depth3-away', mood: { complexity: 0.3, depth: 3, stance: 'away', aspects: { void: 0.7, vagal: 0.6 } } },
  { id: 'c0.25', mood: { complexity: 0.25 } },
  { id: 'c0.75', mood: { complexity: 0.75 } },
  { id: 'c1', mood: { complexity: 1 } },
  { id: 'low-quality', quality: 'low', mood: { complexity: 0.6, overwhelm: 0.3 } },
  {
    // depth change mid-render (key change crossfade) + camera soft-zoom every 100 ms
    id: 'depth0->1',
    mood: { complexity: 0.4, depth: 0 },
    events: [{ t: 15, mood: { depth: 1 } }, ...Array.from({ length: 300 }, (_, i) => ({ t: 5 + i * 0.1, listener: { position: [0, 3 + Math.sin(i / 20), 6 + 3 * Math.sin(i / 37)], forward: [Math.sin(i / 50), -0.3, -Math.cos(i / 50)], up: [0, 1, 0] } }))],
    segments: [[10, 15], [15, 17], [17, 22]],
  },
  { id: 'against+asp', mood: { complexity: 0.7, overwhelm: 0.2, stance: 'against', aspects: { cortical: 0.8, somatic: 0.7, relational: 0.6, shadow: 0.5, mythic: 0.6, limbic: 0.5 } } },
];

const failures = [];
const check = (cond, msg) => { if (!cond) failures.push(msg); };

(async () => {
  const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
  const page = await browser.newPage();
  page.on('console', (m) => { if (m.type() === 'error') console.log('[page error]', m.text()); });
  page.on('pageerror', (e) => console.log('[pageerror]', e.message));
  await page.goto(`${base}/tests/audio/render.html`);
  await page.waitForFunction(() => window.__audioTest && window.__audioTest.ready, null, { timeout: 30000 });
  fs.mkdirSync(wavDir, { recursive: true });

  const results = {};
  console.log('\n== music renders (40 s each) ==');
  console.log('id            peak   rms   rmsDb  dc         silent%  centroid  onsets  notes  NaN  maxOsc  ms');
  for (const r of RENDERS) {
    const res = await page.evaluate((cfg) => window.__audioTest.renderMusic(cfg), { ...r, dur: 40 });
    delete res.noteLog; delete res.onsetTimes;
    if (res.segments) res.segments.forEach((x) => delete x.onsetTimes);
    if (res.wav) {
      const f = path.join(wavDir, `nonmind-${r.id.replace(/[^a-z0-9-]/gi, '_')}.wav`);
      fs.writeFileSync(f, Buffer.from(res.wav, 'base64'));
      delete res.wav;
      res.wavFile = f;
    }
    results[r.id] = res;
    console.log(
      `${r.id.padEnd(13)} ${String(res.peak).padEnd(6)} ${String(res.rms).padEnd(5)} ${String(res.rmsDb).padEnd(6)} ${String(res.dc).padEnd(10)} ${String(res.silentPct).padEnd(8)} ${String(res.centroid).padEnd(9)} ${String(res.onsets).padEnd(7)} ${String(res.notes).padEnd(6)} ${String(res.nan).padEnd(4)} ${String(res.maxOsc).padEnd(7)} ${res.renderMs}`,
    );
    if (res.segments) for (const s of res.segments) console.log(`   [${s.from}-${s.to}s] rms ${s.rms} (${s.rmsDb} dB) peak ${s.peak} centroid ${s.centroid} onsets ${s.onsets}`);
    check(res.nan === 0, `${r.id}: NaN samples`);
    check(res.peak < 1.0, `${r.id}: peak ${res.peak} >= 1`);
    check(res.rmsDb > -32 && res.rmsDb < -10, `${r.id}: rms ${res.rmsDb} dBFS outside [-32,-10]`);
    check(Math.abs(res.dc) < 0.01, `${r.id}: DC offset ${res.dc}`);
    check(res.maxOsc <= 48, `${r.id}: oscillator budget exceeded (${res.maxOsc})`);
  }
  const s0 = results.simple, s1 = results.full;
  // brightness must rise monotonically with complexity (2 % tolerance)
  const sweep = ['simple', 'c0.25', 'mid', 'c0.75', 'c1'].map((k) => results[k].centroid);
  console.log('centroid sweep c=0,.25,.5,.75,1:', sweep.join(' -> '));
  for (let i = 1; i < sweep.length; i++) check(sweep[i] >= sweep[i - 1] * 0.98, `centroid not monotonic in complexity: ${sweep.join(',')}`);
  const dc = results['depth0->1'].segments;
  check(dc[1].peak < 0.95 && dc[1].onsets <= dc[0].onsets + 8, `depth change: burst at key change ${JSON.stringify(dc[1])}`);
  const flu = await page.evaluate(() => window.__audioTest.voiceFlutter(false));
  const fluOld = await page.evaluate(() => window.__audioTest.voiceFlutter(true));
  console.log(`voice flutter (dB p-p, a/o/u): now ${flu.join('/')}  pre-fix settings ${fluOld.join('/')}`);
  check(Math.max(...flu) < 3, `voice flutter ${flu} >= 3 dB`);
  check(s1.onsets > s0.onsets * 2, `full onsets ${s1.onsets} not clearly > simple ${s0.onsets}`);
  check(s1.centroid > s0.centroid * 1.2, `full centroid ${s1.centroid} not clearly > simple ${s0.centroid}`);
  check(results.mid.onsets > s0.onsets, 'mid onsets should exceed simple');
  const rs = results['reset@20'].segments;
  check(rs[1].rms < rs[0].rms * 0.5, `reset: post-collapse rms ${rs[1].rms} not << pre ${rs[0].rms}`);
  check(rs[1].onsets <= 3, `reset: post-collapse should be nearly event-free (${rs[1].onsets} onsets)`);

  // ---------------- the score travels: waves, stages, wave change, fight arc ----------------
  const RM = async (cfg) => {
    const r = await page.evaluate((c) => window.__audioTest.renderMusic(c), cfg);
    delete r.noteLog; delete r.onsetTimes;
    if (r.segments) r.segments.forEach((x) => delete x.onsetTimes);
    check(r.nan === 0 && r.peak < 1.0, `${cfg.id}: NaN or peak ${r.peak} >= 1`);
    check(r.rmsDb > -32 && r.rmsDb < -10, `${cfg.id}: rms ${r.rmsDb} dBFS outside [-32,-10]`);
    check(r.maxOsc <= 48, `${cfg.id}: oscillator budget exceeded (${r.maxOsc})`);
    return r;
  };
  const l1 = (a, b) => a.reduce((s, x, i) => s + Math.abs(x - b[i]), 0);

  console.log('\n== waves: same mood (complexity 0.6), wave 1 / 4 / 7 / 10, 40 s ==');
  console.log('wave  key            pitch-class histogram C..B                                    centroid onsets rmsDb');
  const WV = {};
  for (const w of [1, 4, 7, 10]) {
    const r = (WV[w] = await RM({ id: `wave${w}`, dur: 40, mood: { complexity: 0.6, wave: w } }));
    console.log(`${String(w).padEnd(5)} ${r.scale.padEnd(14)} ${r.pcs.map((x) => x.toFixed(2)).join(' ')}   ${String(r.centroid).padEnd(8)} ${String(r.onsets).padEnd(6)} ${r.rmsDb}`);
  }
  const wBase = await RM({ id: 'wave1-seed8', dur: 40, seed: 8, mood: { complexity: 0.6, wave: 1 } });
  const baseD = l1(WV[1].pcs, wBase.pcs);
  const pairs = [[1, 4], [1, 7], [1, 10], [4, 7], [4, 10], [7, 10]].map(([a, b]) => [a, b, l1(WV[a].pcs, WV[b].pcs)]);
  console.log(`pitch-class L1 distance: ${pairs.map(([a, b, d]) => `${a}-${b} ${d.toFixed(2)}`).join('  ')}  | same wave, other seed ${baseD.toFixed(2)}`);
  for (const [a, b, d] of pairs) check(d > 0.3 && d > baseD * 1.5, `waves ${a} and ${b}: pitch-class histograms too alike (${d.toFixed(2)}, baseline ${baseD.toFixed(2)})`);
  const cyc = await RM({ id: 'wave1-cycle1', dur: 40, mood: { complexity: 0.6, wave: 1, cycle: 1 } });
  const cycD = l1(WV[1].pcs, cyc.pcs);
  console.log(`cycle 0 -> 1 on wave 1: ${WV[1].scale} -> ${cyc.scale}, distance ${cycD.toFixed(2)}`);
  check(cycD > 0.3, `cycle 1 repeats cycle 0 (${cycD.toFixed(2)})`);

  console.log('\n== stages: same mood (complexity 0.7), stage 2 / 8 / 14, 40 s ==');
  const ST = {};
  for (const st of [2, 8, 14]) {
    const r = (ST[st] = await RM({ id: `stage${st}`, dur: 40, mood: { complexity: 0.7, stage: st } }));
    console.log(`stage ${String(st).padEnd(3)} onsets ${String(r.onsets).padEnd(4)} centroid ${String(r.centroid).padEnd(5)} notes ${String(r.notes).padEnd(4)} rmsDb ${r.rmsDb} peak ${r.peak} maxOsc ${r.maxOsc}`);
  }
  check(ST[8].onsets > ST[2].onsets * 3, `stage 8 onsets ${ST[8].onsets} not >> stage 2 ${ST[2].onsets}`);
  check(ST[14].onsets > ST[8].onsets * 1.15, `stage 14 onsets ${ST[14].onsets} not > stage 8 ${ST[8].onsets}`);
  check(ST[8].centroid > ST[2].centroid * 1.1, `stage 8 centroid ${ST[8].centroid} vs stage 2 ${ST[2].centroid}`);
  check(ST[14].centroid > ST[8].centroid * 1.05, `stage 14 centroid ${ST[14].centroid} vs stage 8 ${ST[8].centroid}`);

  console.log('\n== wave change: 60 s, wave 3 -> 4 at 30 s (stage 12, fight) ==');
  const TR = await RM({ id: 'wave3->4', dur: 60, mood: { complexity: 0.6, wave: 3, stage: 12, phase: 'fight', beat: 7 }, events: [{ t: 30, mood: { wave: 4 } }], segments: [[20, 30], [30, 40], [40, 55]] });
  console.log(`ends in ${TR.scale}, transitions ${TR.transitions}, peak ${TR.peak}, longest gap ${TR.maxGap}s, max sample step ${TR.maxStep}`);
  for (const s of TR.segments) console.log(`   [${s.from}-${s.to}s] rms ${s.rmsDb} dB peak ${s.peak} gap ${s.maxGap}s step ${s.maxStep} onsets ${s.onsets}`);
  check(TR.transitions === 1 && TR.scale === 'G dorian', `wave change did not happen (${TR.scale})`);
  check(TR.segments[1].maxGap <= 1.5, `silence gap ${TR.segments[1].maxGap}s at the wave change`);
  check(TR.segments[1].maxStep <= Math.max(TR.segments[0].maxStep, TR.segments[2].maxStep) * 1.5, `click at the wave change (step ${TR.segments[1].maxStep})`);
  check(Math.abs(TR.segments[1].rmsDb - TR.segments[0].rmsDb) < 4, 'level jump across the wave change');
  check(l1(TR.segments[0].pcs, TR.segments[2].pcs) > 0.3, 'pitch classes did not move across the wave change');

  console.log('\n== fight arc: prep 0-12, fight 12-40 (beats by time), won|lost 40-42.2, prep (stage 14, wave 2) ==');
  const ARC = {};
  const SEG = { prep: [4, 12], first: [12.5, 17], late: [24, 31.5], breath: [32.5, 34], last: [35.5, 40], end: [40.5, 44], after: [46, 58] };
  for (const end of ['won', 'lost']) {
    const r = (ARC[end] = await RM({ id: `arc-${end}`, dur: 60, mood: { complexity: 0.7, stage: 14, phase: 'prep', wave: 2 },
      events: [{ t: 12, mood: { phase: 'fight' } }, { t: 40, mood: { phase: end } }, { t: 42.2, mood: { phase: 'prep' } }], segments: Object.values(SEG) }));
    const row = Object.keys(SEG).map((k, i) => { const s = r.segments[i]; s.rate = s.onsets / (s.to - s.from); return `${k} ${s.rate.toFixed(1)}/s ${s.rmsDb}dB ${s.centroid}Hz`; });
    console.log(`${end}: ${row.join(' | ')}`);
  }
  const A = Object.fromEntries(Object.keys(SEG).map((k, i) => [k, ARC.won.segments[i]]));
  check(A.late.rate > A.first.rate * 2, 'fight does not build from the first beat');
  check(A.late.centroid > A.first.centroid * 1.2, 'fight does not brighten as layers enter');
  check(A.breath.rate < A.late.rate * 0.4, 'no held breath before the last beat');
  check(A.last.rate > A.breath.rate * 3, 'last beat does not release');
  check(A.prep.rate < A.late.rate && A.after.rate < A.late.rate, 'prep is not calmer than the fight');
  check(ARC.lost.segments[5].centroid < ARC.won.segments[5].centroid * 0.85, 'lost is not muffled against won');

  const dA = await page.evaluate(() => window.__audioTest.renderMusic({ mood: { complexity: 0.6 }, dur: 10, seed: 5 }));
  const dB = await page.evaluate(() => window.__audioTest.renderMusic({ mood: { complexity: 0.6 }, dur: 10, seed: 5 }));
  const dC = await page.evaluate(() => window.__audioTest.renderMusic({ mood: { complexity: 0.6 }, dur: 10, seed: 6 }));
  const sig = (r) => `${r.rms}/${r.peak}/${r.centroid}/${r.notes}`;
  console.log(`determinism: seed5 ${sig(dA)} | seed5 again ${sig(dB)} | seed6 ${sig(dC)}`);
  check(sig(dA) === sig(dB), 'same seed should render identically');
  check(sig(dA) !== sig(dC), 'different seeds should differ');

  console.log('\n== sfx (rendered alone, positioned, intensity 0.8) ==');
  console.log('name            peak   rms    dur(s)  tailRms   NaN');
  const names = await page.evaluate(() => window.__audioTest.SFX_NAMES);
  const aspects = await page.evaluate(() => window.__audioTest.ASPECTS);
  const jobs = names.map((n) => [n, {}]);
  for (const a of aspects) { jobs.push([`hit:${a}`, { aspect: a }]); jobs.push([`cast:${a}`, { aspect: a }]); }
  for (const g of [0, 5, 9]) jobs.push([`gate:${g}`, { gate: g }]);
  jobs.push(['hit:low-q', { aspect: 'somatic', quality: 'low' }]);
  for (const n of ['mutation', 'miss', 'coreHit', 'gate']) check(names.includes(n), `SFX_NAMES lacks ${n}`);
  for (const [label, opts] of jobs) {
    const name = label.split(':')[0];
    const res = await page.evaluate(([n, o]) => window.__audioTest.renderSfx(n, o), [name, opts]);
    console.log(`${label.padEnd(15)} ${String(res.peak).padEnd(6)} ${String(res.rms).padEnd(6)} ${String(res.dur).padEnd(7)} ${String(res.tailRms).padEnd(9)} ${res.nan}`);
    check(res.nan === 0, `sfx ${label}: NaN`);
    check(res.peak > 0.005, `sfx ${label}: inaudible (peak ${res.peak})`);
    check(res.peak < 1.0, `sfx ${label}: peak ${res.peak}`);
    check(res.tailRms < 1e-3, `sfx ${label}: does not end (tail rms ${res.tailRms})`);
    const maxDur = name === 'reset' ? 8 : 1.6;
    check(res.dur <= maxDur, `sfx ${label}: dur ${res.dur}s > ${maxDur}s`);
  }

  console.log('\n== soak: 300 s offline, mood sweeps + resets + 4 sfx/s ==');
  const soak = await page.evaluate(() => window.__audioTest.soak(300));
  console.log(JSON.stringify(soak));
  const lives = soak.samples.map((x) => x[1]);
  check(soak.nan === 0 && soak.peak < 1, 'soak: NaN or peak >= 1');
  check(soak.maxOsc <= 48, `soak: oscillator budget exceeded (${soak.maxOsc})`);
  check(Math.max(...lives.slice(2)) < Math.max(...lives.slice(0, 3)) * 1.6 + 40, `soak: live nodes growing ${lives.join(',')}`);
  check(soak.gifts >= 1 && soak.rests >= 1 && soak.transitions >= 3, `soak: long-form events missing (gifts ${soak.gifts}, rests ${soak.rests}, transitions ${soak.transitions})`);
  check(soak.liveAfterDispose < 20, `soak: ${soak.liveAfterDispose} nodes still connected after dispose()`);

  console.log('\n== realtime smoke test (AudioContext via getAudio) ==');
  const rt = await page.evaluate(() => window.__audioTest.realtime(6000));
  console.log(JSON.stringify(rt));
  check(rt.state === 'running' && rt.rms > 0.005, 'realtime: engine silent or not running');

  await browser.close();
  console.log('\nWAVs:', Object.values(results).filter((r) => r.wavFile).map((r) => r.wavFile).join('\n      '));
  if (failures.length) {
    console.log('\nFAILED:\n - ' + failures.join('\n - '));
    process.exit(1);
  }
  console.log('\nALL CHECKS PASSED');
})().catch((e) => { console.error(e); process.exit(2); });
