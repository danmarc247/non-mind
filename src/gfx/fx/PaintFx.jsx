// <PaintFx />: every game event becomes a wet-acrylic paint gesture, rendered by four
// fixed instanced pools with one GLSL program (src/gfx/glsl/fx.*). Drop-in for Scene's <Fx />:
// it subscribes to onEvent itself and writes mood.flash on the same events the old Fx did.
import { useEffect, useMemo } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { mood, PALETTE } from '../mood.js';
import { STAGE_PALETTES, mixStagePalette, linearToSrgb } from '../palettes/stages.js';
import { ASPECT_TONES, FAMILY_PALETTES, unitColors } from '../palettes/families.js';
import { game, onEvent } from '../../game/store.js';
import { seatPos, gatePos, leaves } from '../../game/index.js';
import { FxLayer, MODE, rgb } from './pool.js';
import fxVert from '../glsl/fx.vert.glsl';
import fxFrag from '../glsl/fx.frag.glsl';

// arena geometry (mirrors Scene.jsx)
export const FX_ARENA = { SEA_R: 12.5, SEA_Y: -0.35, UNIT_Y: 1.0, CORE_Y: 1.7 };
const { SEA_R, SEA_Y, UNIT_Y, CORE_Y } = FX_ARENA;
const GY = SEA_Y + 0.32;

// Hard caps per pool (slots = simultaneous marks). Full pool => new marks are dropped.
export const FX_CAPS = { ground: 192, ribbon: 64, air: 640, invert: 16 };

// kinds (must match fx.frag.glsl)
const K = { SPLAT: 1, SCUFF: 2, DROP: 3, MOTE: 4, SPARK: 5, PETAL: 6, FLECK: 7, WEDGE: 8, SPLIT: 9, SQUASH: 10, SHELL: 11, BLOOM: 12, COLUMN: 14,
  STROKE: 20, BRAID: 21, SWOOSH: 22, RING: 30, GSPLAT: 31, FLARE: 32, ROSETTE: 33, SPIKES: 34, CRESCENT: 35, SWEEP: 36, BLEED: 37, SPOKE: 38, STAMP: 39, HOLE: 40, INVERT: 41 };

// one clock for every fx (and ArcVeil); window.__fxTime (number) freezes/overrides it
export const fxClock = { t: 0 };
const dispatchers = new Set();
// Fire an event at every mounted PaintFx/ArcVeil without going through the game (galleries, tests).
export const dispatchFx = (e) => { for (const d of dispatchers) d(e); };
export const _registerFx = (fn) => { dispatchers.add(fn); return () => dispatchers.delete(fn); };
let lastStats = null;
export const fxStats = () => lastStats;

const R = Math.random;
const mixC = (a, b, t) => { const A = rgb(a), B = rgb(b); return [A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t, A[2] + (B[2] - A[2]) * t]; };
const tone = (a) => rgb(ASPECT_TONES[a] || 'magenta');

function createSystem() {
  const L = {
    ground: new FxLayer('ground', FX_CAPS.ground, 1),
    ribbon: new FxLayer('ribbon', FX_CAPS.ribbon, 24),
    air: new FxLayer('air', FX_CAPS.air, 1),
    invert: new FxLayer('invert', FX_CAPS.invert, 1),
  };
  const uniforms = {
    uTime: { value: 0 }, uCore: { value: new THREE.Vector3(0, CORE_Y, 0) },
    uPaper: { value: new THREE.Vector3(...PALETTE.paper) }, uInk: { value: new THREE.Vector3(...PALETTE.ink) },
  };
  const mk = (blend) => {
    const m = new THREE.ShaderMaterial({ vertexShader: fxVert, fragmentShader: fxFrag, uniforms, transparent: true, depthWrite: false, depthTest: true, side: THREE.DoubleSide });
    if (blend === 'invert') { m.blending = THREE.CustomBlending; m.blendEquation = THREE.AddEquation; m.blendSrc = THREE.OneMinusDstColorFactor; m.blendDst = THREE.OneMinusSrcColorFactor; m.blendEquationAlpha = THREE.AddEquation; m.blendSrcAlpha = THREE.ZeroFactor; m.blendDstAlpha = THREE.OneFactor; }
    m.toneMapped = false;
    return m;
  };
  const mats = { normal: mk(), invert: mk('invert') };
  const meshes = [];
  const add = (layer, mat, order) => { const me = new THREE.Mesh(layer.geo, mat); me.frustumCulled = false; me.renderOrder = order; meshes.push(me); };
  add(L.ground, mats.normal, 4); add(L.invert, mats.invert, 5); add(L.ribbon, mats.normal, 6); add(L.air, mats.normal, 7);

  const cam = new THREE.Vector3(0, 21, 29);
  const posCache = new Map();          // unit id -> [x, z]: survives the unit (merges/splits remove it first)
  let cacheT = 0, silence = 0;
  const T = [0, 0, 0];                 // scratch for toward()
  const now = () => fxClock.t;

  // point p nudged toward the camera by d (so billboards sit in front of their SDF body)
  function toward(x, y, z, d) {
    let dx = cam.x - x, dy = cam.y - y, dz = cam.z - z; const l = Math.hypot(dx, dy, dz) || 1;
    T[0] = x + dx / l * d; T[1] = y + dy / l * d; T[2] = z + dz / l * d; return T;
  }
  function cachePositions() {
    const G = game.G; if (!G) return;
    if (posCache.size > 400) posCache.clear();
    for (const u of G.units) {
      if (!u.seat) continue;
      let p = posCache.get(u.id); if (!p) { p = [0, 0]; posCache.set(u.id, p); }
      const s = seatPos(u.seat.ring, u.seat.dir); p[0] = s[0]; p[1] = s[1];
    }
  }
  // seat of a live unit, else the last seat it held, else null
  function unitPos(id) {
    const G = game.G, u = G && G.units.find((x) => x.id === id);
    if (u && u.seat) { const s = seatPos(u.seat.ring, u.seat.dir); return s; }
    return posCache.get(id) || null;
  }
  function famColors(id) {
    const G = game.G, u = G && G.units.find((x) => x.id === id);
    const f = u ? leaves(u.g)[0].f : null, fp = (f && FAMILY_PALETTES[f]) || { a: 'magenta', b: 'ultra', c: 'paper' };
    const uc = f ? unitColors(f, Math.round(4 + ((u.link || 1) - 1) * 8 / 11)) : null;
    return { a: rgb(fp.a), b: rgb(fp.b), c: rgb(fp.c), glow: uc && uc.a ? uc.a : rgb(fp.a), link: u ? u.link : 1 };
  }

  // ---- primitives ----
  function decal(kind, x, y, z, radius, life, delay, c1, a1 = 1, c2 = c1, a2 = 0, yaw = R() * 6.283) {
    const i = L.ground.emit(now(), kind, MODE.ground, life, delay);
    L.ground.set(i, 'aP', x, y, z, radius * 2); L.ground.set(i, 'aQ', 1, 1, 0, yaw);
    L.ground.col(i, 'aC1', rgb(c1), a1); L.ground.col(i, 'aC2', rgb(c2), a2);
    return i;
  }
  function ring(x, y, z, r0, r1, th, c1, life, delay = 0, a1 = 1, ticks = 0, c2 = c1, fill = 0) {
    const half = Math.max(r0, r1) * 1.25 + th * 2;
    const i = decal(K.RING, x, y, z, half, life, delay, c1, a1, c2, fill);
    L.ground.set(i, 'aX', r0 / half, r1 / half, th / half, ticks);
    return i;
  }
  function part(kind, x, y, z, vx, vy, vz, size, g, life, delay, c1, a1 = 1, c2 = c1, home = 0, stretch = 0, curve = 1, spin = 0, seed = R()) {
    const i = L.air.emit(now(), kind, MODE.particle, life, delay, seed);
    L.air.set(i, 'aP', x, y, z, size); L.air.set(i, 'aQ', vx, vy, vz, 0); L.air.set(i, 'aM', MODE.particle, g, home, spin);
    L.air.col(i, 'aC1', rgb(c1), a1); L.air.col(i, 'aC2', rgb(c2), 0); L.air.set(i, 'aX', 0, 0, stretch, curve);
    return i;
  }
  function bill(kind, x, y, z, size, life, delay, c1, a1 = 1, c2 = c1, d = 1.1) {
    const p = toward(x, y, z, d);
    return part(kind, p[0], p[1], p[2], 0, 0, 0, size, 0, life, delay, c1, a1, c2, 0, 0, 0, 0);
  }
  function ribbon(kind, ax, ay, az, bx, by, bz, width, arc, life, delay, c1, a1 = 1, c2 = c1, braid = 0, phase = 0) {
    const i = L.ribbon.emit(now(), kind, MODE.ribbon, life, delay);
    L.ribbon.set(i, 'aP', ax, ay, az, width); L.ribbon.set(i, 'aQ', bx, by, bz, 0); L.ribbon.set(i, 'aM', MODE.ribbon, arc, braid, phase);
    L.ribbon.col(i, 'aC1', rgb(c1), a1); L.ribbon.col(i, 'aC2', rgb(c2), 0);
    L.ribbon.set(i, 'aX', 0, Math.hypot(bx - ax, by - ay, bz - az), 0, 0);
    return i;
  }
  function spiral(x, y, z, size, r0, a0, turns, h0, life, delay, c1, a1 = 1, c2 = c1) {
    const i = L.air.emit(now(), K.MOTE, MODE.spiral, life, delay);
    L.air.set(i, 'aP', x, y, z, size); L.air.set(i, 'aQ', r0, a0, turns, h0); L.air.set(i, 'aM', MODE.spiral, 0, 0, 0);
    L.air.col(i, 'aC1', rgb(c1), a1); L.air.col(i, 'aC2', rgb(c2), 0);
    return i;
  }
  function burst(kind, x, y, z, n, speed, up, size, g, life, cols, opts = {}) {
    for (let j = 0; j < n; j++) {
      const a = R() * 6.283, s = speed * (0.55 + R() * 0.6);
      part(kind, x, y, z, Math.cos(a) * s, up * (0.6 + R() * 0.7), Math.sin(a) * s, size * (0.7 + R() * 0.6), g, life * (0.8 + R() * 0.4), (opts.delay || 0) + R() * (opts.spread || 0),
        cols[j % cols.length], opts.alpha ?? 1, opts.c2 || 'paper', opts.home || 0, opts.stretch ?? 1, 1);
    }
  }

  // ---- casts: one gesture per ability kind ----
  function cast(e) {
    const echo = !!e.echo, A = echo ? 0.5 : 1, S = echo ? 0.8 : 1, D = echo ? 0.08 : 0;
    const x = e.x + (echo ? 0.35 : 0), z = e.z + (echo ? -0.25 : 0), c = tone(e.aspect);
    switch (e.kind) {
      case 'invert': {
        const i = L.invert.emit(now(), K.INVERT, MODE.ground, 0.55, D);
        L.invert.set(i, 'aP', x, UNIT_Y + 1.7, z, 5.2 * S); L.invert.set(i, 'aQ', 1, 1, 0, R() * 6.28); L.invert.col(i, 'aC1', c, A);
        ring(x, UNIT_Y + 1.75, z, 0.4, 2.45 * S, 0.06, c, 0.55, D, A);
        ring(x, GY, z, 0.6, 2.6 * S, 0.08, c, 0.6, D + 0.04, A * 0.8);
        break;
      }
      case 'store':
        for (let j = 0; j < 3; j++) ring(x, GY, z, 2.7 * S - j * 0.3, 0.7, 0.09, j === 1 ? 'ink' : c, 0.42, D + j * 0.06, A, 0, 'ink', j === 2 ? 0.35 : 0);
        part(K.MOTE, ...toward(x, UNIT_Y + 0.4, z, 1.2), 0, 0, 0, 1.2 * S, 0, 0.4, D + 0.18, 'ink', A * 0.7, c, 0, 0, 1);
        break;
      case 'flurry':
        for (let j = 0; j < 5; j++) {
          const a = R() * 6.283, d = 1.8 + R() * 1.2;
          ribbon(K.STROKE, x, UNIT_Y + 0.4, z, x + Math.cos(a) * d, UNIT_Y + 0.2, z + Math.sin(a) * d, 0.42 * S, 0.45, 0.22, D + j * 0.045, c, A, mixC(c, 'ink', 0.35));
        }
        break;
      case 'retreat': {
        const a = Math.atan2(z, x) + Math.PI;
        ribbon(K.SWOOSH, x, UNIT_Y + 0.3, z, Math.cos(a) * 8.5, UNIT_Y + 0.3, Math.sin(a) * 8.5, 0.62 * S, 2.4, 0.34, D, c, A, mixC(c, 'paper', 0.4));
        decal(K.HOLE, x, GY, z, 1.6 * S, 0.4, D, c, A);
        break;
      }
      case 'heal':
        decal(K.ROSETTE, x, GY, z, 2.4 * S, 0.7, D, c, A, 'paper');
        for (let j = 0; j < 8; j++) {
          const a = (j / 8) * 6.283 + R() * 0.3, rr = 0.9 + R() * 0.3;
          part(K.PETAL, x + Math.cos(a) * rr, UNIT_Y - 0.2 + R() * 0.3, z + Math.sin(a) * rr, Math.cos(a) * 0.3, 1.5 + R() * 0.6, Math.sin(a) * 0.3, 0.5 * S, -0.4, 0.75, D + j * 0.03, c, A, 'paper', 0, 0, 0, 0, 1);
        }
        break;
      case 'transfer':
        bill(K.CRESCENT, x, UNIT_Y + 0.3, z, 2.6 * S, 0.5, D, c, A, 'blood', 1.3);
        decal(K.CRESCENT, x, GY, z, 2.2 * S, 0.5, D, c, A * 0.7, 'blood');
        break;
      case 'blink':
        decal(K.HOLE, x, GY, z, 2.4 * S, 0.45, D, c, A);
        bill(K.HOLE, x, UNIT_Y + 0.3, z, 3.0 * S, 0.4, D, c, A, c, 1.3);
        burst(K.SPARK, x, UNIT_Y + 0.4, z, 8, 5, 1.5, 0.22 * S, 0, 0.3, [c], { alpha: A, delay: D, c2: 'paper' });
        break;
      case 'burst_affect':
        decal(K.FLARE, x, GY, z, 4.5 * S, 0.55, D, 'yolk', A, 'tangerine');
        bill(K.FLARE, x, UNIT_Y + 0.3, z, 3.2 * S, 0.4, D, 'yolk', A * 0.9, 'tangerine', 1.4);
        burst(K.SPARK, x, UNIT_Y + 0.5, z, echo ? 7 : 14, 4.5, 4, 0.26, 3, 0.95, ['yolk', 'yolk', 'tangerine'], { alpha: A, delay: D, c2: 'tangerine', home: 0.35, spread: 0.08 });
        if (!echo) mood.flash = Math.max(mood.flash, 0.15);
        break;
      case 'taunt':
        decal(K.SPIKES, x, GY, z, 2.4 * S, 0.55, D, 'ink', A, c);
        ring(x, GY, z, 0.6, 2.2 * S, 0.06, c, 0.5, D + 0.1, A);
        break;
      case 'equalize': {
        const i = decal(K.SWEEP, 0, UNIT_Y + 0.45, 0, SEA_R, 0.8, D, c, A, mixC(c, 'paper', 0.5), 0, 0);
        L.ground.set(i, 'aX', 0, 0, 0, 0);
        ring(x, GY, z, 0.5, 2.0, 0.05, c, 0.4, D, A);
        break;
      }
      default:
        ring(x, GY, z, 0.4, 2.2 * S, 0.08, c, 0.5, D, A);
    }
  }

  function handle(e) {
    const t = now(), G = game.G;
    if (e.type === 'fxClear') { for (const k in L) L[k].clear(); return; }   // galleries/tests only
    if (e.type === 'reset') {
      for (const k in L) L[k].clear();
      silence = t + 0.6;
      const p = toward(0, CORE_Y, 0, 8);
      part(K.BLOOM, p[0], p[1], p[2], 0, 0, 0, 70, 0, 1.3, 0, 'paper', 1, 'yolk', 0, 0, 0);
      ring(0, GY, 0, 0.5, 12, 0.18, 'paper', 0.9, 0, 1);
      mood.flash = 1;
      return;
    }
    if (t < silence) return;
    switch (e.type) {
      case 'strike': {
        const len = Math.hypot(e.tx - e.x, e.tz - e.z); if (len < 0.05) return;
        const c = tone(e.aspect);
        ribbon(K.STROKE, e.x, UNIT_Y + 0.35, e.z, e.tx, UNIT_Y + 0.25, e.tz, 0.62, 0.22 + 0.06 * len, 0.26, 0, c, 1, mixC(c, 'ink', 0.35));
        break;
      }
      case 'hit': {
        const amt = Math.max(0, e.amt || 0); if (amt < 0.004) return;
        const size = 1.2 + Math.min(2.2, amt * 5.5);
        const c1 = e.side ? tone(e.aspect) : rgb('ink'), c2 = e.side ? mixC(c1, 'paper', 0.35) : rgb('blood');
        const i = bill(K.SPLAT, e.x, UNIT_Y + 0.3, e.z, size, 0.42 + Math.min(0.25, amt), 0, c1, 1, c2, 1.15);
        L.air.set(i, 'aX', 0.25 + Math.min(0.6, amt * 2), 1, 0, 0);
        burst(K.DROP, ...toward(e.x, UNIT_Y + 0.4, e.z, 1.1), 3 + Math.min(6, Math.round(amt * 16)), 3.2, 3.6, 0.22, 14, 0.45, [c1, c2]);
        break;
      }
      case 'miss': {
        const i = bill(K.SCUFF, e.x, UNIT_Y + 0.55, e.z, 1.9, 0.32, 0, 'paper', 0.8, mixC('paper', 'ink', 0.12), 1.2);
        void i; break;
      }
      case 'cast': cast(e); break;
      case 'death': {
        const B = G && G.battle, c = B && B.units.find((u) => u.id === e.id);
        const c1 = c ? tone(c.aspects[0]) : rgb('rose');
        for (let j = 0; j < 22; j++) {
          const a = R() * 6.283, rr = R() * 0.9;
          part(K.MOTE, e.x + Math.cos(a) * rr, UNIT_Y - 0.3 + R() * 0.9, e.z + Math.sin(a) * rr, Math.cos(a) * 0.5, 0.8 + R() * 1.0, Math.sin(a) * 0.5,
            0.42 + R() * 0.24, -0.4, 1.1 + R() * 0.35, j * 0.02, j % 3 ? c1 : 'paper', 0.95, 'paper', 0.42, 0, 0);
        }
        ring(e.x, GY, e.z, 0.4, 1.8, 0.05, 'paper', 0.6, 0, 0.8);
        break;
      }
      case 'enemyDeath': {
        const S = e.boss ? 2.4 : 1;
        const gi = decal(K.GSPLAT, e.x, GY, e.z, 1.7 * S, 0.95, 0, 'magenta', 1, 'ultra');
        L.ground.set(gi, 'aX', 0.65, 0, 0, 0);
        const bi = bill(K.SPLAT, e.x, UNIT_Y + 0.4, e.z, 1.7 * S, 0.5, 0, 'magenta', 1, 'ultra', 1.2 * S);
        L.air.set(bi, 'aX', 0.85, 0.6, 0, 0);
        ring(e.x, GY + 0.02, e.z, 0.3, 2.6 * S, 0.05 * S, 'magenta', 0.45, 0, 1);
        if (e.boss) { ring(e.x, GY + 0.03, e.z, 0.3, 4.4 * S, 0.09 * S, 'ultra', 0.6, 0.12, 1); ring(e.x, GY + 0.04, e.z, 0.3, 6 * S, 0.05 * S, 'yolk', 0.7, 0.24, 1); mood.flash = Math.max(mood.flash, 0.45); }
        burst(K.DROP, e.x, UNIT_Y + 0.5, e.z, e.boss ? 30 : 12, 4.2 * Math.sqrt(S), 4.5, 0.2 * Math.sqrt(S), 15, 0.6, ['magenta', 'ultra', 'yolk']);
        break;
      }
      case 'link': {
        const P = unitPos(e.id) || [0, 0], Q = posCache.get(e.gone), fc = famColors(e.id);
        const x = P[0], z = P[1];
        for (let s = 0; s < 2; s++) for (let j = 0; j < 9; j++)
          spiral(x, UNIT_Y + 0.1, z, 0.55 - j * 0.025, 2.7, s * Math.PI + j * 0.22, 1.25, 1.4 + j * 0.06, 0.55, j * 0.035, s ? fc.b : fc.a, 1);
        if (Q && Math.hypot(Q[0] - x, Q[1] - z) > 0.5) ribbon(K.STROKE, Q[0], UNIT_Y + 0.4, Q[1], x, UNIT_Y + 0.4, z, 0.5, 1.2, 0.34, 0, fc.b, 1, fc.a);
        ring(x, GY, z, 0.4, 2.3, 0.07, fc.glow, 0.75, 0.42, 1, Math.min(12, e.link || fc.link), fc.a, 0.3);
        burst(K.SPARK, x, UNIT_Y + 0.6, z, 6, 3, 2.5, 0.2, 2, 0.4, [fc.glow, 'paper'], { delay: 0.45 });
        mood.flash = Math.max(mood.flash, 0.25);
        break;
      }
      case 'integrate': {
        const P = unitPos(e.id) || [0, 0], fc = famColors(e.id), x = P[0], z = P[1];
        let Pa = posCache.get(e.a), Pb = posCache.get(e.b);
        const near = (Q) => !Q || Math.hypot(Q[0] - x, Q[1] - z) < 0.5;
        const ax = near(Pa) ? x - 2.6 : Pa[0], az = near(Pa) ? z + 0.6 : Pa[1], ay = near(Pa) ? UNIT_Y + 3.2 : UNIT_Y + 0.5;
        const bx = near(Pb) ? x + 2.6 : Pb[0], bz = near(Pb) ? z + 0.6 : Pb[1], by = near(Pb) ? UNIT_Y + 3.2 : UNIT_Y + 0.5;
        ribbon(K.BRAID, ax, ay, az, x, UNIT_Y + 0.2, z, 0.34, 1.1, 0.62, 0, fc.a, 1, 'teal', 0.45, 0);
        ribbon(K.BRAID, bx, by, bz, x, UNIT_Y + 0.2, z, 0.34, 1.1, 0.62, 0.02, fc.b, 1, 'teal', 0.45, Math.PI);
        ring(x, GY, z, 0.4, 2.4, 0.08, 'teal', 0.6, 0.42, 1, 0, fc.a, 0.3);
        bill(K.MOTE, x, UNIT_Y + 0.3, z, 2.0, 0.35, 0.44, 'teal', 0.6, fc.a, 1.2);
        mood.flash = Math.max(mood.flash, 0.2);
        break;
      }
      case 'subtract': {
        const P = unitPos(e.id) || [0, 0], fc = famColors(e.id), x = P[0], z = P[1];
        const p = toward(x, UNIT_Y + 0.4, z, 1.0), side = R() < 0.5 ? -1 : 1;
        const i = part(K.WEDGE, p[0], p[1], p[2], side * 1.3, 2.2, 0.6, 2.2, 9, 0.85, 0, 'blood', 1, fc.a, 0, 0, 0, side * 2.6, R());
        L.air.set(i, 'aX', 0.6, 0, 0, 0);
        ring(x, GY, z, 0.3, 2.0, 0.07, 'blood', 0.5, 0, 1);
        burst(K.DROP, p[0], p[1], p[2], 6, 2, 2.5, 0.16, 12, 0.5, ['blood', fc.a]);
        break;
      }
      case 'split': {
        const P = posCache.get(e.id) || unitPos(e.a) || [0, 0], fc = famColors(e.a), x = P[0], z = P[1];
        bill(K.SPLIT, x, UNIT_Y + 0.4, z, 2.9, 0.75, 0, 'violet', 1, fc.a, 1.2);
        burst(K.DROP, ...toward(x, UNIT_Y + 0.4, z, 1.3), 8, 1.8, 3.4, 0.14, 10, 0.55, ['paper'], { delay: 0.12, spread: 0.1 });
        ring(x, GY, z, 0.4, 2.3, 0.06, 'violet', 0.6, 0.25, 1);
        break;
      }
      case 'repurpose': {
        const P = posCache.get(e.id) || [0, 0], x = P[0], z = P[1];
        bill(K.SQUASH, x, UNIT_Y + 0.3, z, 2.5, 0.5, 0, 'tangerine', 1, mixC('tangerine', 'ink', 0.25), 1.2);
        decal(K.STAMP, x, GY, z, 1.6, 1.05, 0.28, 'tangerine', 1, 'paper');
        break;
      }
      case 'mutation': {
        const P = unitPos(e.id) || [0, 0], x = P[0], z = P[1];
        bill(K.SHELL, x, UNIT_Y + 0.3, z, 3.0, 0.42, 0, 'magenta', 1, 'ultra', 1.3);
        const i = L.invert.emit(t, K.INVERT, MODE.ground, 0.24, 0.05);
        L.invert.set(i, 'aP', x, UNIT_Y + 1.6, z, 2.6); L.invert.set(i, 'aQ', 1, 1, 0, 0); L.invert.col(i, 'aC1', rgb('paper'), 0.6);
        break;
      }
      case 'ending': {
        const P = posCache.get(e.id) || [0, 0], x = P[0], z = P[1];
        const i = L.air.emit(t, K.COLUMN, MODE.column, 2.0, 0);
        L.air.set(i, 'aP', x, SEA_Y, z, 2.8); L.air.set(i, 'aQ', 0, 24, 0, 0); L.air.set(i, 'aM', MODE.column, 0, 0, 0);
        L.air.col(i, 'aC1', rgb('paper'), 1); L.air.col(i, 'aC2', rgb('yolk'), 0);
        for (let j = 0; j < 24; j++) part(K.MOTE, x + (R() - 0.5) * 1.6, SEA_Y + R() * 2, z + (R() - 0.5) * 1.6, 0, 2 + R() * 2.5, 0, 0.22 + R() * 0.2, -0.6, 1.4 + R() * 0.5, R() * 0.9, j % 4 ? 'paper' : 'yolk', 1, 'paper', 0, 0, 0);
        ring(x, GY, z, 0.5, 3.2, 0.1, 'paper', 1.6, 0, 1, 12, 'yolk', 0.25);
        mood.flash = Math.max(mood.flash, 0.5);
        break;
      }
      case 'waveStart': {
        const pal = mixStagePalette(mood.stage), c2 = pal.primary.map(linearToSrgb);
        for (let d = 0; d < 10; d++) {
          const [gx, gz] = gatePos(d), a = Math.atan2(gz, gx), r0 = 11.3, r1 = 3.0, len = r0 - r1, mid = (r0 + r1) / 2;
          const i = L.ground.emit(t, K.SPOKE, MODE.ground, 0.5, d * 0.025);
          L.ground.set(i, 'aP', Math.cos(a) * mid, GY + 0.01, Math.sin(a) * mid, 0.6); L.ground.set(i, 'aQ', len / 0.6, 1, 0, a + Math.PI);
          L.ground.col(i, 'aC1', d % 2 ? rgb('ink') : c2, 1); L.ground.col(i, 'aC2', rgb('ink'), 0); L.ground.set(i, 'aX', 0, len, 0, 0);
        }
        ring(0, GY, 0, 0.5, 2.6, 0.08, 'ink', 0.5, 0.25, 1);
        break;
      }
      case 'waveWin': {
        const pal = mixStagePalette(mood.stage), sp = pal.primary.map(linearToSrgb), cols = ['yolk', 'magenta', 'teal', 'ultra', 'tangerine', 'rose', sp];
        for (let j = 0; j < 60; j++) {
          const a = R() * 6.283, rr = 6 + R() * 5, s = 1.5 + R() * 2.2;
          part(K.FLECK, Math.cos(a) * rr, 3.5 + R() * 3, Math.sin(a) * rr, -Math.cos(a) * s, -1.2 - R(), -Math.sin(a) * s, 0.3 + R() * 0.16, 2.2, 1.5 + R() * 0.5, R() * 0.35,
            cols[j % cols.length], 1, 'paper', 0, 0, 0, (R() - 0.5) * 10);
        }
        mood.flash = Math.max(mood.flash, 0.5);
        break;
      }
      case 'waveLose':
        decal(K.BLEED, 0, GY + 0.05, 0, SEA_R, 1.4, 0, 'ink', 0.82, 'violet', 0, R() * 6.28);
        break;
      case 'stage': {
        const sp = STAGE_PALETTES[Math.max(0, Math.min(STAGE_PALETTES.length - 1, e.stage | 0))];
        const cs = [sp.primary, sp.secondary, sp.tertiary, sp.accent, sp.glow];
        for (let j = 0; j < 5; j++) ring(0, GY + 0.01 * j, 0, 0.3, 6.5 + j * 1.2, 0.22 - j * 0.02, cs[j], 0.95, j * 0.07, 1);
        mood.flash = Math.max(mood.flash, 0.5);
        break;
      }
      case 'attend': {
        ring(0, GY, 0, 1.5, 2.8 + R() * 0.3, 0.16, 'yolk', 0.4, 0, 1, 0, 'tangerine', 0.22);
        for (let j = 0; j < 2; j++) { const a = R() * 6.283; part(K.SPARK, Math.cos(a) * 0.8, CORE_Y + 1.4, Math.sin(a) * 0.8, Math.cos(a) * 1.8, 2.6, Math.sin(a) * 1.8, 0.32, 9, 0.45, 0, 'yolk', 1, 'tangerine', 0, 1, 1); }
        break;
      }
      case 'coreHit': {
        const amt = Math.max(0, e.amt || 0);
        const i = bill(K.SPLAT, 0, CORE_Y, 0, 1.2 + Math.min(2.2, amt * 30), 0.45, 0, 'ink', 1, 'blood', 2.2);
        L.air.set(i, 'aX', 0.9, 1, 0, 0);
        break;
      }
      case 'beat': { const [x, z] = gatePos(e.gate); ring(x, GY, z, 0.2, 1.1, 0.05, 'ink', 0.5, 0, 0.9); break; }
      default: break;
    }
  }

  function frame(dt, camera) {
    if (typeof window !== 'undefined' && typeof window.__fxTime === 'number') fxClock.t = window.__fxTime;
    else fxClock.t += Math.min(dt, 0.1);
    const t = fxClock.t;
    cam.copy(camera.position);
    uniforms.uTime.value = t;
    if ((cacheT -= dt) <= 0) { cacheT = 0.25; cachePositions(); }
    for (const k in L) L[k].update(t);
  }
  const stats = () => Object.fromEntries(Object.entries(L).map(([k, l]) => [k, { cap: l.n, live: l.live(fxClock.t), dropped: l.dropped }]));
  function dispose() { for (const k in L) L[k].dispose(); mats.normal.dispose(); mats.invert.dispose(); }
  return { meshes, handle, frame, dispose, stats, cachePositions };
}

export function PaintFx() {
  const sys = useMemo(createSystem, []);
  const { camera } = useThree();
  useEffect(() => {
    sys.cachePositions();
    const off1 = onEvent((e) => sys.handle(e)), off2 = _registerFx(sys.handle);
    lastStats = sys.stats;
    return () => { off1(); off2(); sys.dispose(); };
  }, [sys]);
  useFrame((_, dt) => sys.frame(dt, camera));
  return <group>{sys.meshes.map((m) => <primitive key={m.uuid} object={m} />)}</group>;
}

export default PaintFx;
