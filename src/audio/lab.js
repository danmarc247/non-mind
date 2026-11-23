// NON-MIND audio lab: plain-DOM test bench for the audio engine (no React).
// Open /audio-lab.html on the Vite dev server.
import { getAudio, SFX_NAMES, ASPECTS } from './engine.js';

const $ = (id) => document.getElementById(id);
const audio = getAudio({ seed: 1 });
const mood = { complexity: 0, overwhelm: 0, tension: 0, depth: 0, stance: null, aspects: {} };

function slider(parent, key, label, min, max, step, onInput, init = 0) {
  const row = document.createElement('div');
  row.className = 'row';
  row.innerHTML = `<span>${label}</span><input type="range" min="${min}" max="${max}" step="${step}" value="${init}"><span>${init}</span>`;
  const input = row.querySelector('input'), out = row.querySelectorAll('span')[1];
  input.addEventListener('input', () => { out.textContent = input.value; onInput(+input.value); });
  parent.appendChild(row);
}
const push = () => audio.setMood(mood);

slider($('sliders'), 'complexity', 'complexity', 0, 1, 0.01, (v) => { mood.complexity = v; push(); });
slider($('sliders'), 'overwhelm', 'overwhelm', 0, 1, 0.01, (v) => { mood.overwhelm = v; push(); });
slider($('sliders'), 'tension', 'tension', 0, 1, 0.01, (v) => { mood.tension = v; push(); });
slider($('sliders'), 'depth', 'depth', 0, 15, 1, (v) => { mood.depth = v; push(); });
slider($('sliders'), 'wave', 'wave', 1, 10, 1, (v) => { mood.wave = v; push(); }, 1);
slider($('sliders'), 'cycle', 'cycle', 0, 5, 1, (v) => { mood.cycle = v; push(); });
slider($('sliders'), 'stage', 'stage', 0, 17, 0.1, (v) => { mood.stage = v; push(); }, 17);
slider($('sliders'), 'beat', 'beat', 0, 9, 1, (v) => { mood.beat = v; push(); });
slider($('sliders'), 'master', 'master', 0, 1.2, 0.01, (v) => audio.setMaster(v), 0.8);
for (const ph of ['(no phase)', 'prep', 'fight', 'won', 'lost']) {
  const l = document.createElement('label');
  l.className = 'radio';
  l.innerHTML = `<input type="radio" name="phase" value="${ph}" ${ph === '(no phase)' ? 'checked' : ''}> ${ph}`;
  l.querySelector('input').addEventListener('change', () => { mood.phase = ph === '(no phase)' ? null : ph; push(); });
  $('sliders').appendChild(l);
}

for (const st of ['none', 'toward', 'away', 'against']) {
  const l = document.createElement('label');
  l.className = 'radio';
  l.innerHTML = `<input type="radio" name="stance" value="${st}" ${st === 'none' ? 'checked' : ''}> ${st}`;
  l.querySelector('input').addEventListener('change', () => { mood.stance = st === 'none' ? null : st; push(); });
  $('stances').appendChild(l);
}
for (const a of ASPECTS) slider($('aspects'), a, a, 0, 1, 0.01, (v) => { mood.aspects[a] = v; push(); });

const sel = $('sfxAspect');
sel.innerHTML = '<option value="">(none)</option>' + ASPECTS.map((a) => `<option>${a}</option>`).join('');
for (const name of SFX_NAMES) {
  const b = document.createElement('button');
  b.textContent = name;
  b.addEventListener('click', async () => {
    await audio.unlock({ music: false });
    // random position around the listener so HRTF placement is audible
    const a = Math.random() * Math.PI * 2;
    audio.sfx(name, { position: [Math.cos(a) * 3, 0, Math.sin(a) * 3], intensity: 0.8, aspect: sel.value || undefined });
  });
  $('sfx').appendChild(b);
}

$('start').addEventListener('click', async () => { await audio.unlock(); audio.start(); });
$('stop').addEventListener('click', () => audio.stop());
$('reset').addEventListener('click', async () => { await audio.unlock(); audio.reset(); });
$('mute').addEventListener('change', (e) => audio.setMuted(e.target.checked));

// live spectrum from the engine's AnalyserNode
const cv = $('spec'), g = cv.getContext('2d');
const bins = new Uint8Array(audio.analyser.frequencyBinCount);
function draw() {
  requestAnimationFrame(draw);
  audio.analyser.getByteFrequencyData(bins);
  const W = cv.width, H = cv.height;
  g.fillStyle = '#08090c';
  g.fillRect(0, 0, W, H);
  // log-frequency axis from 30 Hz to 16 kHz
  const sr = audio.ctx.sampleRate, n = bins.length;
  g.fillStyle = '#9fd4c8';
  for (let x = 0; x < W; x++) {
    const f = 30 * Math.pow(16000 / 30, x / W);
    const v = bins[Math.min(n - 1, Math.round((f / (sr / 2)) * n))] / 255;
    g.fillRect(x, H - v * H, 1, v * H);
  }
  const L = audio.getLevels(), d = audio.debug();
  $('levels').textContent = `low ${L.low.toFixed(2)}  mid ${L.mid.toFixed(2)}  high ${L.high.toFixed(2)}  rms ${L.rms.toFixed(2)}  |  ${d.scale} (wave ${d.wave}, cycle ${d.cycle})  osc ${d.osc}  c ${d.c.toFixed(2)} o ${d.o.toFixed(2)}  beat ${d.beat} den ${d.den.toFixed(2)} calm ${d.calm.toFixed(2)}`;
  $('status').textContent = `${audio.ctx.state}${audio.started ? ' · music on' : ''}`;
}
draw();
