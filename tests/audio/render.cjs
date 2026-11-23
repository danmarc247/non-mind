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
  console.log('id            peak   rms   rmsDb  dc         silent%  centroid  onsets  NaN  maxOsc  ms');
  for (const r of RENDERS) {
    const res = await page.evaluate((cfg) => window.__audioTest.renderMusic(cfg), { ...r, dur: 40 });
    if (res.wav) {
      const f = path.join(wavDir, `nonmind-${r.id.replace(/[^a-z0-9-]/gi, '_')}.wav`);
      fs.writeFileSync(f, Buffer.from(res.wav, 'base64'));
      delete res.wav;
      res.wavFile = f;
    }
    results[r.id] = res;
    console.log(
      `${r.id.padEnd(13)} ${String(res.peak).padEnd(6)} ${String(res.rms).padEnd(5)} ${String(res.rmsDb).padEnd(6)} ${String(res.dc).padEnd(10)} ${String(res.silentPct).padEnd(8)} ${String(res.centroid).padEnd(9)} ${String(res.onsets).padEnd(7)} ${String(res.nan).padEnd(4)} ${String(res.maxOsc).padEnd(7)} ${res.renderMs}`,
    );
    if (res.segments) for (const s of res.segments) console.log(`   [${s.from}-${s.to}s] rms ${s.rms} (${s.rmsDb} dB) peak ${s.peak} centroid ${s.centroid} onsets ${s.onsets}`);
    check(res.nan === 0, `${r.id}: NaN samples`);
    check(res.peak < 1.0, `${r.id}: peak ${res.peak} >= 1`);
    check(res.rmsDb > -32 && res.rmsDb < -10, `${r.id}: rms ${res.rmsDb} dBFS outside [-32,-10]`);
    check(Math.abs(res.dc) < 0.01, `${r.id}: DC offset ${res.dc}`);
    check(res.maxOsc <= 48, `${r.id}: oscillator budget exceeded (${res.maxOsc})`);
  }
  const s0 = results.simple, s1 = results.full;
  check(s1.onsets > s0.onsets * 2, `full onsets ${s1.onsets} not clearly > simple ${s0.onsets}`);
  check(s1.centroid > s0.centroid * 1.2, `full centroid ${s1.centroid} not clearly > simple ${s0.centroid}`);
  check(results.mid.onsets > s0.onsets, 'mid onsets should exceed simple');
  const rs = results['reset@20'].segments;
  check(rs[1].rms < rs[0].rms * 0.5, `reset: post-collapse rms ${rs[1].rms} not << pre ${rs[0].rms}`);
  check(rs[1].onsets <= 3, `reset: post-collapse should be nearly event-free (${rs[1].onsets} onsets)`);

  console.log('\n== sfx (rendered alone, positioned, intensity 0.8) ==');
  console.log('name            peak   rms    dur(s)  tailRms   NaN');
  const names = await page.evaluate(() => window.__audioTest.SFX_NAMES);
  const aspects = await page.evaluate(() => window.__audioTest.ASPECTS);
  const jobs = names.map((n) => [n, {}]);
  for (const a of aspects) { jobs.push([`hit:${a}`, { aspect: a }]); jobs.push([`cast:${a}`, { aspect: a }]); }
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

  await browser.close();
  console.log('\nWAVs:', Object.values(results).filter((r) => r.wavFile).map((r) => r.wavFile).join('\n      '));
  if (failures.length) {
    console.log('\nFAILED:\n - ' + failures.join('\n - '));
    process.exit(1);
  }
  console.log('\nALL CHECKS PASSED');
})().catch((e) => { console.error(e); process.exit(2); });
