import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { mood, PALETTE } from './mood.js';
import { mixStagePalette, linearToSrgb, HUE_SLOTS } from './palettes/stages.js';
import vert from './glsl/sky.vert.glsl';
import frag from './glsl/sky.frag.glsl';

// Stroke palette: the 5 stage hue slots (rotated by depth) + 3 on-token blends.
// Shader picks favour index 0..2, so depth changes which slots lead.
const STROKE_KEYS = ['yolk', 'tangerine', 'magenta', 'teal', 'violet', 'sky', 'rose', 'blood'];
const RING_COUNT = 6;

const ramp = (x, a, b) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

// The painting's STRUCTURE by stage: each stage switches one motif on.
//  0 bare canvas, one slow stroke family   1 wash      2 scratch curves   3 first hero ring
//  4 flecks          5 giant strokes        6 ring cells 7 knife smears     8 impasto + dry brush
//  9 small strokes  10 tighter swirls      11 ink accents 12 clustered discs 13 slow drips
// 14 torn strokes   15-16 full chord        17 collapse: white canvas + magenta/ultra splashes
export function skyMotifs(stage) {
  const s = stage;
  return {
    A: [ramp(s, 0.5, 1.5), ramp(s, 1.5, 2.5), ramp(s, 3.5, 4.5), ramp(s, 4.5, 5.5)],
    B: [ramp(s, 5.5, 6.5), ramp(s, 6.5, 7.5), ramp(s, 7.5, 8.5), ramp(s, 8.5, 9.5)],
    C: [ramp(s, 9.5, 10.5), ramp(s, 10.5, 11.5), ramp(s, 11.5, 12.5), ramp(s, 12.5, 13.5)],
    D: [ramp(s, 13.5, 14.5), ramp(s, 14.5, 16.0), ramp(s, 16.0, 17.0)],
  };
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

export function PainterSky({ radius = 400 }) {
  const mesh = useRef();
  const clock = useRef({ t: 0, last: null, key: null, density: 0 });

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
    uPal: { value: STROKE_KEYS.map((k) => new THREE.Vector3(...PALETTE[k])) },
    uSat: { value: 1 },
    uContrast: { value: 1 },
    uMotifA: { value: new THREE.Vector4() },
    uMotifB: { value: new THREE.Vector4() },
    uMotifC: { value: new THREE.Vector4() },
    uMotifD: { value: new THREE.Vector4() },
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

    // stage palette (eased float stage; overwhelm at 16 pushes toward the 17 collapse)
    const stage = Math.min(17, mood.stage + mood.overwhelm * 0.999 * (mood.stage >= 16 ? 1 : 0));
    const depth = Math.floor(mood.depth) || 0;
    const key = `${stage.toFixed(4)}|${depth}`;
    if (key !== c.key) {
      c.key = key;
      const p = mixStagePalette(stage);
      const srgb = (v) => v.map(linearToSrgb);
      u.uPaper.value.set(...srgb(p.ground));
      u.uInk.value.set(...srgb(p.ink));
      const n = HUE_SLOTS.length;
      const slots = HUE_SLOTS.map((_, i) => srgb(p[HUE_SLOTS[(((i + depth) % n) + n) % n]]));
      for (let i = 0; i < n; i++) u.uPal.value[i].set(...slots[i]);
      // on-token blends between neighbouring slots
      u.uPal.value[5].set(...slots[0]).lerp(tmpV.set(...slots[1]), 0.5);
      u.uPal.value[6].set(...slots[2]).lerp(tmpV.set(...slots[3]), 0.5);
      u.uPal.value[7].set(...slots[0]).lerp(tmpV.set(...slots[2]), 0.5);
      u.uSat.value = p.saturation;
      u.uContrast.value = p.contrast;
      c.density = p.strokeDensity;
      const m = skyMotifs(stage);
      u.uMotifA.value.set(...m.A);
      u.uMotifB.value.set(...m.B);
      u.uMotifC.value.set(...m.C);
      c.motifD = m.D;
      c.stage = stage;
      RING_SEEDS.forEach((s, i) => {
        const v = slots[(i * 2 + depth) % n];
        u.uRingFill.value[i].set(v[0], v[1], v[2], s.fillA);
      });
    }
    const D = Math.min(1, c.density * (0.75 + 0.5 * mood.complexity));
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
