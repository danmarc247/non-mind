// Fixed-size GPU instance pools for the paint fx. A slot is written once when an effect spawns;
// the vertex shader animates it from (t0, life) so live slots cost no CPU. When every slot is
// still alive, emit() returns -1 and the effect is dropped (counted in `dropped`).
import * as THREE from 'three';
import { PALETTE } from '../mood.js';
import { hexToRgb } from '../palettes/stages.js';

const ATTRS = ['aP', 'aQ', 'aT', 'aC1', 'aC2', 'aM', 'aX'];
const HIDDEN = -1e9;

export const MODE = { ground: 0, particle: 1, ribbon: 2, spiral: 3, column: 4 };

export class FxLayer {
  constructor(name, n, segs = 1) {
    this.name = name; this.n = n; this.cur = 0; this.hw = 0; this.dropped = 0; this.lo = n; this.hi = -1;
    const base = new THREE.PlaneGeometry(1, 1, segs, 1);
    const g = new THREE.InstancedBufferGeometry();
    g.index = base.index; g.setAttribute('position', base.getAttribute('position')); g.setAttribute('uv', base.getAttribute('uv'));
    this.buf = {}; this.attr = {};
    for (const k of ATTRS) {
      const arr = new Float32Array(n * 4), at = new THREE.InstancedBufferAttribute(arr, 4);
      at.setUsage(THREE.DynamicDrawUsage); g.setAttribute(k, at); this.buf[k] = arr; this.attr[k] = at;
    }
    for (let i = 0; i < n; i++) this.buf.aT[i * 4] = HIDDEN;
    g.instanceCount = 0; g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e4);
    this.geo = g; this.end = new Float32Array(n);
  }
  // Claim a slot; returns its index or -1 when the pool is full (graceful drop).
  emit(now, kind, mode, life, delay = 0, seed = Math.random()) {
    const n = this.n;
    for (let j = 0; j < n; j++) {
      const i = (this.cur + j) % n;
      if (this.end[i] > now) continue;
      this.cur = (i + 1) % n;
      const o = i * 4;
      for (const k of ATTRS) { const b = this.buf[k]; b[o] = b[o + 1] = b[o + 2] = b[o + 3] = 0; }
      const T = this.buf.aT; T[o] = now + delay; T[o + 1] = life; T[o + 2] = kind; T[o + 3] = seed;
      this.buf.aM[o] = mode; this.buf.aQ[o] = 1; this.buf.aQ[o + 1] = 1; this.buf.aC1[o + 3] = 1;
      this.end[i] = now + delay + life;
      if (i < this.lo) this.lo = i; if (i > this.hi) this.hi = i; if (i + 1 > this.hw) this.hw = i + 1;
      return i;
    }
    this.dropped++;
    return -1;
  }
  set(i, k, x = 0, y = 0, z = 0, w = 0) { if (i < 0) return; const b = this.buf[k], o = i * 4; b[o] = x; b[o + 1] = y; b[o + 2] = z; b[o + 3] = w; }
  col(i, k, rgb, w) { if (i < 0) return; const b = this.buf[k], o = i * 4; b[o] = rgb[0]; b[o + 1] = rgb[1]; b[o + 2] = rgb[2]; b[o + 3] = w; }
  live(now) { let c = 0; for (let i = 0; i < this.hw; i++) if (this.end[i] > now) c++; return c; }
  update(now) {
    while (this.hw > 0 && this.end[this.hw - 1] <= now) this.hw--;
    this.geo.instanceCount = this.hw;
    if (this.hi >= this.lo) {
      for (const k of ATTRS) { const at = this.attr[k]; at.clearUpdateRanges(); at.addUpdateRange(this.lo * 4, (this.hi - this.lo + 1) * 4); at.needsUpdate = true; }
      this.lo = this.n; this.hi = -1;
    }
  }
  clear() {
    for (let i = 0; i < this.n; i++) { this.end[i] = 0; this.buf.aT[i * 4] = HIDDEN; }
    this.lo = 0; this.hi = this.n - 1; this.hw = 0;
  }
  dispose() { this.geo.dispose(); }
}

// ---- token colours (sRGB 0..1, the Canvas writes display sRGB) ----
const cache = new Map();
export function rgb(c) {
  if (Array.isArray(c)) return c;
  let v = cache.get(c);
  if (!v) { v = PALETTE[c] ? PALETTE[c] : hexToRgb(c); cache.set(c, v); }
  return v;
}
