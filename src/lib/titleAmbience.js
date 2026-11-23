// Home-screen ambience: a very quiet, warm pad with a rare soft bell, on its own tiny AudioContext so
// it never waits for the game's audio engine. Browsers only allow sound after a first interaction, so
// it begins at once where the browser permits it, and otherwise on the first press, key or touch.
// It fades out when the game begins and then releases its context.
let ctx = null, master = null, bellTimer = null, state = 'idle';
const muted = () => { try { return localStorage.getItem('non-mind-muted') === '1'; } catch { return false; } };

function build() {
  const t = ctx.currentTime;
  master = ctx.createGain(); master.gain.setValueAtTime(0.0001, t); master.gain.exponentialRampToValueAtTime(muted() ? 0.0001 : 0.5, t + 5);
  const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1100; lp.Q.value = 0.3;
  const delay = ctx.createDelay(1.5), fb = ctx.createGain(), wet = ctx.createGain();
  delay.delayTime.value = 0.42; fb.gain.value = 0.38; wet.gain.value = 0.35;
  lp.connect(master); lp.connect(delay); delay.connect(fb).connect(delay); delay.connect(wet).connect(master); master.connect(ctx.destination);
  // pad: F add9 spread wide, each voice two slightly detuned sines breathing on its own slow period
  [[87.31, 0.05], [130.81, 0.045], [220.0, 0.03], [293.66, 0.022], [392.0, 0.016]].forEach(([f, g], i) => {
    const vg = ctx.createGain(), pan = ctx.createStereoPanner(); vg.gain.value = g; pan.pan.value = (i % 2 ? 1 : -1) * (0.15 + i * 0.12);
    const lfo = ctx.createOscillator(), lg = ctx.createGain(); lfo.frequency.value = 0.045 + i * 0.017; lg.gain.value = g * 0.55; lfo.connect(lg).connect(vg.gain); lfo.start();
    for (const d of [-4, 5]) { const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = f; o.detune.value = d; o.connect(vg); o.start(); }
    vg.connect(pan).connect(lp);
  });
  // a soft bell now and then, from a five-note set that cannot clash with the pad
  const notes = [349.23, 440.0, 523.25, 587.33, 783.99];
  const bell = () => {
    if (state !== 'on') return;
    const n = ctx.currentTime + 0.05, f = notes[Math.floor(Math.random() * notes.length)];
    const o = ctx.createOscillator(), o2 = ctx.createOscillator(), g = ctx.createGain(), pan = ctx.createStereoPanner();
    o.frequency.value = f; o2.frequency.value = f * 2.01; pan.pan.value = Math.random() * 1.2 - 0.6;
    g.gain.setValueAtTime(0.0001, n); g.gain.exponentialRampToValueAtTime(0.05, n + 0.03); g.gain.exponentialRampToValueAtTime(0.0001, n + 4.2);
    const g2 = ctx.createGain(); g2.gain.value = 0.18; o2.connect(g2).connect(g); o.connect(g).connect(pan).connect(lp);
    o.start(n); o2.start(n); o.stop(n + 4.4); o2.stop(n + 4.4);
    bellTimer = setTimeout(bell, 4500 + Math.random() * 5500);
  };
  bellTimer = setTimeout(bell, 2500);
}

export function startTitleAmbience() {
  if (state !== 'idle' || typeof window === 'undefined') return;
  const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
  state = 'waiting';
  try { ctx = new AC(); } catch { state = 'off'; return; }
  const go = () => {
    if (state !== 'waiting') return;
    ctx.resume().then(() => { if (state === 'waiting' && ctx.state === 'running') { state = 'on'; build(); off(); } }).catch(() => {});
  };
  const evs = ['pointerdown', 'keydown', 'touchstart'];
  const off = () => evs.forEach((e) => window.removeEventListener(e, go, true));
  evs.forEach((e) => window.addEventListener(e, go, true));
  go(); // some browsers allow it right away
}

export function stopTitleAmbience() {
  if (!ctx) return;
  const was = state; state = 'off'; clearTimeout(bellTimer);
  const c = ctx; ctx = null;
  if (was === 'on' && master) { const t = c.currentTime; master.gain.cancelScheduledValues(t); master.gain.setValueAtTime(Math.max(0.0001, master.gain.value), t); master.gain.exponentialRampToValueAtTime(0.0001, t + 2.8); setTimeout(() => c.close().catch(() => {}), 3200); }
  else c.close().catch(() => {});
}
