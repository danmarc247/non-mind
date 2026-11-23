// Render quality: four tiers, a player setting and a frame-time governor.
//
// Setting (localStorage `non-mind-quality`): 'auto' (default) | 'low' | 'medium' | 'high'.
// Change it from anywhere with  window.dispatchEvent(new CustomEvent('nonmind:quality', { detail: 'low' })).
// Every change (setting or auto step) is announced as `nonmind:quality-changed` with
// detail { setting, tier, name }. React code can use useQuality() (see ./useQuality.js).
//
// Tiers (index = mood.quality). Fill rate is the cost, so every knob is per-pixel:
//   dpr    max device-pixel ratio (the Canvas never renders above window.devicePixelRatio)
//   post   PainterPost preset (PAINTER_QUALITY: Kuwahara taps, LIC, smear, focus, halo, bloom levels)
//   steps  fraction of each sculpture's raymarch budget (units 48, stressors 36, core 56)
//   hit    raymarch hit threshold per unit of ray length (bigger = fewer steps, softer edges)
//   motes  fraction of rising motes;  mobiles: fraction of drifting bodies
export const TIERS = [
  { name: 'minimum', dpr: 0.75, post: 'low', steps: 0.6, hit: 0.0012, motes: 0.35, mobiles: 0.5 },
  { name: 'low', dpr: 1.0, post: 'low', steps: 0.7, hit: 0.0008, motes: 0.6, mobiles: 0.7 },
  { name: 'medium', dpr: 1.25, post: 'lite', steps: 0.85, hit: 0.0005, motes: 1, mobiles: 1 },
  { name: 'high', dpr: 1.5, post: 'med', steps: 1.0, hit: 0.0003, motes: 1, mobiles: 1 },
];
export const SETTINGS = ['auto', 'low', 'medium', 'high'];
const FIXED = { low: 1, medium: 2, high: 3 };
const KEY = 'non-mind-quality';

const SMALL = typeof window !== 'undefined' && (window.matchMedia?.('(pointer: coarse)').matches || Math.min(window.innerWidth, window.innerHeight) < 620);
// auto range: phones start at low and never climb past medium
const AUTO_START = SMALL ? 1 : 2, AUTO_MAX = SMALL ? 2 : 3;

function readSetting() {
  try {
    const url = typeof location !== 'undefined' ? new URLSearchParams(location.search).get('quality') : null;
    if (url && SETTINGS.includes(url)) return url;
    const v = localStorage.getItem(KEY);
    if (SETTINGS.includes(v)) return v;
  } catch { /* storage blocked */ }
  return 'auto';
}

export const quality = { setting: readSetting(), tier: 2 };
quality.tier = quality.setting === 'auto' ? AUTO_START : FIXED[quality.setting];
export const tierInfo = () => TIERS[quality.tier];

const subs = new Set();
export const onQuality = (fn) => { subs.add(fn); return () => subs.delete(fn); };
function announce() {
  subs.forEach((f) => f(quality));
  if (typeof window !== 'undefined') {
    window.__nmTier = quality.tier;
    window.dispatchEvent(new CustomEvent('nonmind:quality-changed', { detail: { setting: quality.setting, tier: quality.tier, name: TIERS[quality.tier].name } }));
  }
}
function setTier(t) {
  t = Math.max(0, Math.min(3, t));
  if (t === quality.tier) return;
  quality.tier = t; announce();
}
export function setQualitySetting(s) {
  if (!SETTINGS.includes(s)) return;
  quality.setting = s;
  try { localStorage.setItem(KEY, s); } catch { /* storage blocked */ }
  gov.reset(); gov.blockedUntil.fill(0); gov.backoff.fill(30);
  // back to auto keeps the current tier: the governor moves it from there
  const t = s === 'auto' ? Math.min(quality.tier, AUTO_MAX) : FIXED[s];
  if (t !== quality.tier) setTier(t); else announce();
}
if (typeof window !== 'undefined') {
  window.__nmTier = quality.tier;
  window.addEventListener('nonmind:quality', (e) => setQualitySetting(typeof e.detail === 'string' ? e.detail : e.detail?.setting));
}

// ---- governor ----
// Frame times are averaged over 0.5 s windows. Only in 'auto'.
//  down: 3 slow windows in a row (avg > 24 ms, under ~42 fps)  -> one tier down
//        2 very slow windows (avg > 40 ms, under 25 fps)        -> two tiers down
//        so sustained slowness is answered within 1-1.5 s, and a slow machine reaches the floor in ~3 s.
//  up:   20 good windows in a row (10 s at avg < 18.5 ms) -> one tier up. If the new tier falls back
//        within 8 s, it is blocked for 30 s, then 60, 120 ... (no flip-flop).
//  After any change (and for 3 s after start) windows are ignored for 1 s: compiles and resizes hitch.
const WIN = 0.5, SLOW = 0.024, VERY = 0.040, GOOD = 0.0185;
const gov = {
  acc: 0, n: 0, slow: 0, very: 0, good: 0, settle: 3, now: 0, upAt: -1e9, upTier: -1,
  blockedUntil: [0, 0, 0, 0], backoff: [30, 30, 30, 30],
  reset() { this.acc = 0; this.n = 0; this.slow = 0; this.very = 0; this.good = 0; this.settle = 1; },
};
function change(t) {
  const from = quality.tier;
  t = Math.max(0, Math.min(AUTO_MAX, t));
  if (t === from) return;
  if (t < from && gov.upTier === from && gov.now - gov.upAt < 8) {   // the climb failed
    gov.blockedUntil[from] = gov.now + gov.backoff[from]; gov.backoff[from] *= 2;
  }
  if (t > from) { gov.upAt = gov.now; gov.upTier = t; }
  setTier(t); gov.reset();
}
/** Feed one frame's raw delta (seconds). Call once per rendered frame. */
export function governFrame(dt) {
  if (!(dt > 0) || dt > 0.25) return;          // tab switches, breakpoints, first frame
  gov.now += dt;
  if (gov.settle > 0) { gov.settle -= dt; return; }
  if (quality.setting !== 'auto') return;
  gov.acc += dt; gov.n++;
  if (gov.acc < WIN) return;
  const avg = gov.acc / gov.n; gov.acc = 0; gov.n = 0;
  gov.very = avg > VERY ? gov.very + 1 : 0;
  gov.slow = avg > SLOW ? gov.slow + 1 : 0;
  gov.good = avg < GOOD ? gov.good + 1 : 0;
  if (gov.very >= 2) change(quality.tier - 2);
  else if (gov.slow >= 3) change(quality.tier - 1);
  else if (gov.good >= 20 && quality.tier < AUTO_MAX && gov.now >= gov.blockedUntil[quality.tier + 1]) change(quality.tier + 1);
}
