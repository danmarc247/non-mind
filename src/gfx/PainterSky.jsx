import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { mood, PALETTE } from './mood.js';
import { mixStagePalette, linearToSrgb, HUE_SLOTS } from './palettes/stages.js';
import vert from './glsl/sky.vert.glsl';
import frag from './glsl/sky.frag.glsl';

// Stroke palette: the 5 stage hue slots + 3 paper tints of the leading slots.
// Shader picks favour index 0..2; depth and the wave composition rotate which slots lead.
const RING_COUNT = 6;
// Guest token hues fill stage slots that are still near-paper (early stages), so the
// sky is a full painting from the first second; stage 17 suppresses them (white collapse).
const GUESTS = ['yolk', 'sky', 'teal', 'tangerine', 'violet', 'magenta', 'ultra', 'leaf', 'rose', 'blood'];

const ramp = (x, a, b) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

// Ten wave compositions: [field id, stroke scale mul, warp, cross-hatch, slot rotation]
// 0 swirl, 1 radial burst, 2 horizontal bands, 3 diagonal rain, 4 vortex pair,
// 5 concentric rings, 6 woven cross-hatch, 7 drifting islands, 8 vertical drips, 9 storm
export const SKY_COMPOSITIONS = [
  [0, 1.0, 0.08, 0.0, 0], [1, 0.85, 0.04, 0.0, 2], [2, 1.15, 0.05, 0.0, 4], [3, 1.3, 0.03, 0.0, 1],
  [4, 0.9, 0.06, 0.0, 3], [5, 1.0, 0.03, 0.0, 0], [6, 1.35, 0.02, 1.0, 2], [7, 0.8, 0.1, 0.0, 4],
  [8, 1.2, 0.03, 0.0, 1], [9, 1.1, 0.16, 0.3, 3],
];
// wave 1..10 -> composition; each cycle shifts the mapping and turns the focal points
export const skyComposition = (wave, cycle) => ((((Math.round(wave) || 1) - 1 + (cycle | 0) * 3) % 10) + 10) % 10;
function focalDir(comp, cycle, out) {
  const a = comp * 2.39996 + (cycle | 0) * 1.1;
  const y = 0.12 + 0.18 * Math.sin(comp * 1.7 + cycle);
  return out.set(Math.cos(a), y, Math.sin(a)).normalize();
}

// The painting's richness by stage. Every stage is already a full painting
// (wash + giant + mid strokes from stage 0); each stage adds one motif:
//  1 more hues  2 scratch curves  3 first hero ring  4 flecks  6 ring cells  7 knife smears
//  8 impasto + dry brush  9 small strokes  10 tighter swirls  11 ink accents  12 clustered discs
// 13 slow drips  14 torn strokes  15-16 full chord  17 collapse: white canvas + magenta/ultra splashes
export function skyMotifs(stage) {
  const s = stage;
  return {
    A: [1, ramp(s, 1.5, 2.5), ramp(s, 3.5, 4.5), 1],
    B: [ramp(s, 5.5, 6.5), 0.35 + 0.65 * ramp(s, 6.5, 7.5), 0.5 + 0.5 * ramp(s, 7.5, 8.5), ramp(s, 8.5, 9.5)],
    C: [ramp(s, 9.5, 10.5), ramp(s, 10.5, 11.5), ramp(s, 11.5, 12.5), ramp(s, 12.5, 13.5)],
    D: [ramp(s, 13.5, 14.5), ramp(s, 14.5, 16.0), ramp(s, 16.0, 17.0)],
  };
}

const chroma = (c) => Math.max(...c) - Math.min(...c);
const lerp3 = (a, b, k) => a.map((v, i) => v + (b[i] - v) * k);

// 5 sRGB slots for (stage palette, depth, composition, cycle)
function buildSlots(p, stage, depth, comp, cycle, collapse) {
  const srgb = (v) => v.map(linearToSrgb);
  const paper = srgb(p.ground);
  let slots = HUE_SLOTS.map((k, i) => {
    const c = srgb(p[k]);
    const g = PALETTE[GUESTS[(i * 3 + comp + (cycle | 0)) % GUESTS.length]];
    const k2 = (1 - ramp(chroma(c), 0.15, 0.45)) * (1 - collapse);
    return lerp3(c, g, k2);
  });
  // calmer early stages use fewer hues: 3 at stage 0, all 5 from stage 6
  const nH = Math.min(5, 3 + Math.floor(stage / 3));
  slots = slots.map((c, i) => (i < nH ? c : lerp3(slots[i % nH], paper, 0.3)));
  const rot = depth + SKY_COMPOSITIONS[comp][4];
  return HUE_SLOTS.map((_, i) => slots[(((i + rot) % 5) + 5) % 5]);
}

// Fixed pseudo-random ring seeds (direction on the sphere, radius, drift axis).
const RING_SEEDS = Array.from({ length: RING_COUNT }, (_, i) => {
  const a = i * 2.39996 + 0.7;
  const y = Math.sin(i * 1.7 + 0.3) * 0.45;
  return {
    dir: new THREE.Vector3(Math.cos(a) * Math.sqrt(1 - y * y), y, Math.sin(a) * Math.sqrt(1 - y * y)),
    axis: new THREE.Vector3(Math.sin(i * 3.1), 1.0, Math.cos(i * 5.3)).normalize(),
    radius: 0.07 + 0.06 * ((i * 0.618) % 1),
    speed: 0.006 + 0.004 * ((i * 0.37) % 1),
    fillA: (i % 3 === 1) ? 0.0 : 0.85,
  };
});

const tmpV = new THREE.Vector3();

export function PainterSky({ radius = 400, fadeSeconds = 2.5 }) {
  const mesh = useRef();
  const clock = useRef({ t: 0, last: null, key: null, density: 0, prev: -1, cur: -1, blend: 1, motifD: [0, 0, 0] });
  const pals = useMemo(() => ({ A: [], B: [] }), []);

  const material = useMemo(() => new THREE.ShaderMaterial({
    vertexShader: vert,
    fragmentShader: frag,
    side: THREE.BackSide,
    depthWrite: false,
    depthTest: true,
    fog: false,
    toneMapped: false,
    uniforms: {
    uTime: { value: 0 },
    uComplexity: { value: 0 },
    uOverwhelm: { value: 0 },
    uFlash: { value: 0 },
    uAudio: { value: new THREE.Vector3() },
    uPal: { value: Array.from({ length: 8 }, () => new THREE.Vector3(...PALETTE.paper)) },
    uSat: { value: 1 },
    uContrast: { value: 1 },
    uMotifA: { value: new THREE.Vector4() },
    uMotifB: { value: new THREE.Vector4() },
    uMotifC: { value: new THREE.Vector4() },
    uMotifD: { value: new THREE.Vector4() },
    uCompA: { value: new THREE.Vector4(0, 1, 0.08, 0) },
    uCompB: { value: new THREE.Vector4(0, 1, 0.08, 0) },
    uFocA: { value: new THREE.Vector3(1, 0, 0) },
    uFocB: { value: new THREE.Vector3(1, 0, 0) },
    uBlend: { value: 1 },
    uPaper: { value: new THREE.Vector3(...PALETTE.paper) },
    uInk: { value: new THREE.Vector3(...PALETTE.ink) },
    uMagenta: { value: new THREE.Vector3(...PALETTE.magenta) },
    uUltra: { value: new THREE.Vector3(...PALETTE.ultra) },
    uRings: { value: Array.from({ length: RING_COUNT }, () => new THREE.Vector4()) },
    uRingFill: { value: Array.from({ length: RING_COUNT }, () => new THREE.Vector4()) },
    },
  }), []);
  useEffect(() => () => material.dispose(), [material]);

  useFrame(({ camera }) => {
    const c = clock.current;
    const u = material.uniforms;
    // own integrated clock so overwhelm can speed the paint up without jumps
    const dt = c.last === null ? 0 : Math.min(Math.max(mood.time - c.last, 0), 0.1);
    c.last = mood.time;
    const speed = 1 + mood.overwhelm * 2.5 + mood.audio.low * 0.4;
    c.t += dt * speed;

    u.uTime.value = c.t;
    u.uComplexity.value = mood.complexity;
    u.uOverwhelm.value = mood.overwhelm;
    u.uFlash.value = mood.flash;
    u.uAudio.value.set(mood.audio.low, mood.audio.mid, mood.audio.high);

    // wave composition: cross-fade prev -> cur over ~2.5 s when the wave changes
    const cycle = mood.cycle | 0;
    const compNow = skyComposition(mood.wave, cycle);
    if (c.cur < 0) { c.cur = c.prev = compNow; c.blend = 1; }
    if (compNow !== c.cur) { c.prev = c.cur; c.cur = compNow; c.blend = 0; c.key = null; }
    c.blend = Math.min(1, c.blend + dt / Math.max(fadeSeconds, 1e-3));
    const bl = c.blend * c.blend * (3 - 2 * c.blend);
    u.uBlend.value = bl;

    // stage palette (eased float stage; overwhelm at 16 pushes toward the 17 collapse)
    const stage = Math.min(17, mood.stage + mood.overwhelm * 0.999 * (mood.stage >= 16 ? 1 : 0));
    const depth = Math.floor(mood.depth) || 0;
    const key = `${stage.toFixed(4)}|${depth}|${c.prev}|${c.cur}|${cycle}`;
    if (key !== c.key) {
      c.key = key;
      const p = mixStagePalette(stage);
      const m = skyMotifs(stage);
      const collapse = m.D[2];
      u.uPaper.value.set(...p.ground.map(linearToSrgb));
      u.uInk.value.set(...p.ink.map(linearToSrgb));
      pals.A = buildSlots(p, stage, depth, c.prev, cycle, collapse);
      pals.B = buildSlots(p, stage, depth, c.cur, cycle, collapse);
      // pre-compensate the post chain's aerial fade + soft focus on the sky
      u.uSat.value = Math.max(p.saturation, 0.95) * 1.12;
      u.uContrast.value = Math.max(p.contrast, 1.0) * 1.08;
      c.density = 0.65 + 0.35 * p.strokeDensity;
      u.uMotifA.value.set(...m.A);
      u.uMotifB.value.set(...m.B);
      u.uMotifC.value.set(...m.C);
      c.motifD = m.D;
      c.stage = stage;
      const CA = SKY_COMPOSITIONS[c.prev], CB = SKY_COMPOSITIONS[c.cur];
      u.uCompA.value.set(CA[0], CA[1], CA[2], CA[3]);
      u.uCompB.value.set(CB[0], CB[1], CB[2], CB[3]);
      focalDir(c.prev, cycle, u.uFocA.value);
      focalDir(c.cur, cycle, u.uFocB.value);
    }
    // palette cross-fade (no allocation: cached slot arrays, Vector3 lerp)
    const paper = u.uPaper.value;
    for (let i = 0; i < 5; i++) u.uPal.value[i].set(...pals.A[i]).lerp(tmpV.set(...pals.B[i]), bl);
    u.uPal.value[5].copy(u.uPal.value[0]).lerp(paper, 0.4);
    u.uPal.value[6].copy(u.uPal.value[1]).lerp(paper, 0.4);
    u.uPal.value[7].copy(u.uPal.value[2]).lerp(paper, 0.4);
    RING_SEEDS.forEach((s, i) => {
      const v = u.uPal.value[(i * 2) % 5];
      u.uRingFill.value[i].set(v.x, v.y, v.z, s.fillA);
    });
    const D = Math.min(1, c.density * (0.9 + 0.15 * mood.complexity));
    u.uMotifD.value.set(c.motifD[0], c.motifD[1], c.motifD[2], D);

    // hero rings: one more drifts in every second stage from stage 3; gone at the collapse
    const collapse = c.motifD[2];
    RING_SEEDS.forEach((s, i) => {
      tmpV.copy(s.dir).applyAxisAngle(s.axis, c.t * s.speed);
      const pulse = 1 + mood.audio.low * 0.06;
      const on = ramp(c.stage, 2.5 + i * 2, 3.5 + i * 2) * (1 - collapse);
      u.uRings.value[i].set(tmpV.x, tmpV.y, tmpV.z, on > 0.01 ? s.radius * pulse * (0.4 + 0.6 * on) : 0);
    });

    if (mesh.current) mesh.current.position.copy(camera.position);
  });

  return (
    <mesh ref={mesh} renderOrder={-1000} frustumCulled={false} material={material}>
      <sphereGeometry args={[radius, 64, 32]} />
    </mesh>
  );
}

export default PainterSky;
