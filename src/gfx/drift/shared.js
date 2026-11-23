// Shared helpers for the drift components: eased stage palette (display sRGB), tokens, a tiny
// registry so Tethers can find the Mobiles, and the clear-view-cone test.
import * as THREE from 'three';
import { mood, PALETTE } from '../mood.js';
import { mixStagePalette, linearToSrgb } from '../palettes/stages.js';

export const SEA_R = 12.5;
export const SEA_Y = -0.35;
export const VESSEL_TOP = SEA_Y + 0.5;
export const VESSEL_BOTTOM = SEA_Y - 5;
export const CORE = [0, 1.7, 0];
export const ease = (cur, tgt, dt, rate = 10) => cur + (tgt - cur) * (1 - Math.exp(-rate * dt));
export const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
export const tok = (name) => new THREE.Vector3(...PALETTE[name]);
// world key light shared by every drift piece (upper left, slightly in front)
export const LIGHT = new THREE.Vector3(-0.45, 0.8, 0.4).normalize();

// Same stage rule as Sea / PainterSky: overwhelm at stage 16 pushes toward the white collapse (17).
const pal = { key: '', slots: [[1, 1, 1], [1, 1, 1], [1, 1, 1], [1, 1, 1], [1, 1, 1]], ground: [1, 1, 1], ink: [0, 0, 0] };
const SLOT_NAMES = ['primary', 'secondary', 'accent', 'tertiary', 'glow'];
export function stagePalette() {
  const st = Math.min(17, mood.stage + mood.overwhelm * 0.999 * (mood.stage >= 16 ? 1 : 0));
  const key = st.toFixed(3);
  if (key !== pal.key) {
    pal.key = key;
    const p = mixStagePalette(st);
    SLOT_NAMES.forEach((k, i) => { pal.slots[i] = p[k].map(linearToSrgb); });
    pal.ground = p.ground.map(linearToSrgb); pal.ink = p.ink.map(linearToSrgb);
  }
  return pal;
}
// Write four depth-rotated stage slots into uniforms (uA..uD by default), starting at `offset`.
export function setSlots(u, offset = 0, names = ['uA', 'uB', 'uC', 'uD']) {
  const p = stagePalette(), d = Math.floor(mood.depth) || 0;
  names.forEach((n, i) => { if (u[n]) u[n].value.set(...p.slots[(offset + i + d) % 5]); });
}

// Registry: Mobiles publishes each body's live world position, radius and visibility here.
export const driftState = { mobiles: [], cameraTarget: new THREE.Vector3(0, -3.2, 0) };

// Clear cone: 0 when a sphere (c, r) sits between the camera and the arena, 1 when it is clear.
// The arena is treated as a sphere of radius `arenaR` at `target`. Bodies BEHIND the arena are fine.
const tv = new THREE.Vector3(), ta = new THREE.Vector3();
export function clearOfArena(camPos, target, c, r, arenaR = 14, margin = 0.05) {
  ta.copy(target).sub(camPos); const da = ta.length(); ta.multiplyScalar(1 / da);
  tv.copy(c).sub(camPos); const dv = tv.length();
  const along = tv.dot(ta);
  if (along > da - arenaR * 0.25) return 1;          // beyond the arena's middle: occluded, not occluding
  if (dv < r + 2) return 0;                          // at the lens
  const ang = Math.acos(Math.min(1, Math.max(-1, along / dv)));
  const lim = Math.asin(Math.min(1, arenaR / da)) + Math.asin(Math.min(1, r / dv));
  return smooth(lim, lim + margin + 0.04, ang);
}
