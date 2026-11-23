// Shared helpers for the arena shader components.
import * as THREE from 'three';
import { mood, PALETTE } from '../mood.js';
import { mixStagePalette, linearToSrgb, hexToRgb } from '../palettes/stages.js';

export const SEA_R = 12.5;
export const SEA_Y = -0.35;
export const ease = (cur, tgt, dt, rate = 10) => cur + (tgt - cur) * (1 - Math.exp(-rate * dt));
export const v3 = (c) => new THREE.Vector3(c[0], c[1], c[2]);
export const hex3 = (h) => v3(hexToRgb(h));
export const tok = (name) => v3(PALETTE[name]);

// Eased stage palette in display sRGB (same stage rule as Sea/PainterSky), recomputed only when it moves.
const pal = { key: '', ground: [1, 1, 1], ink: [0, 0, 0], primary: [1, 1, 1], secondary: [1, 1, 1], tertiary: [1, 1, 1], accent: [1, 1, 1], glow: [1, 1, 1] };
export function stagePalette() {
  const st = Math.min(17, mood.stage + mood.overwhelm * 0.999 * (mood.stage >= 16 ? 1 : 0));
  const key = st.toFixed(3);
  if (key !== pal.key) {
    pal.key = key;
    const p = mixStagePalette(st);
    for (const k of ['ground', 'ink', 'primary', 'secondary', 'tertiary', 'accent', 'glow']) pal[k] = p[k].map(linearToSrgb);
  }
  return pal;
}
// depth rotates which slot leads (prestige dialect), as PainterSky does
const SLOTS = ['primary', 'secondary', 'accent', 'glow', 'tertiary'];
export function setPaletteSlots(u, names = ['uP0', 'uP1', 'uP2', 'uP3']) {
  const p = stagePalette(), d = Math.floor(mood.depth) || 0;
  names.forEach((n, i) => u[n].value.set(...p[SLOTS[(i + d) % SLOTS.length]]));
}
