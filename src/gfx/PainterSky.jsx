import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { mood, PALETTE } from './mood.js';
import vert from './glsl/sky.vert.glsl';
import frag from './glsl/sky.frag.glsl';

// Stroke palette order (ref a): index 0..2 dominate; depth rotates the ring.
const STROKE_KEYS = ['yolk', 'tangerine', 'magenta', 'teal', 'violet', 'sky', 'rose', 'blood'];
const RING_COUNT = 6;

// Fixed pseudo-random ring seeds (direction on the sphere, radius, drift axis).
const RING_SEEDS = Array.from({ length: RING_COUNT }, (_, i) => {
  const a = i * 2.39996 + 0.7;
  const y = Math.sin(i * 1.7 + 0.3) * 0.45;
  return {
    dir: new THREE.Vector3(Math.cos(a) * Math.sqrt(1 - y * y), y, Math.sin(a) * Math.sqrt(1 - y * y)),
    axis: new THREE.Vector3(Math.sin(i * 3.1), 1.0, Math.cos(i * 5.3)).normalize(),
    radius: 0.07 + 0.06 * ((i * 0.618) % 1),
    speed: 0.006 + 0.004 * ((i * 0.37) % 1),
    fillKey: STROKE_KEYS[(i * 3) % STROKE_KEYS.length],
    fillA: (i % 3 === 1) ? 0.0 : 0.85,
  };
});

const tmpV = new THREE.Vector3();

export function PainterSky({ radius = 400 }) {
  const mesh = useRef();
  const clock = useRef({ t: 0, last: null, depth: null });

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

    // depth rotates which palette colours dominate
    const depth = Math.floor(mood.depth) || 0;
    if (depth !== c.depth) {
      c.depth = depth;
      const n = STROKE_KEYS.length;
      for (let i = 0; i < n; i++) {
        const k = STROKE_KEYS[(((i + depth * 3) % n) + n) % n];
        u.uPal.value[i].set(...PALETTE[k]);
      }
      RING_SEEDS.forEach((s, i) => {
        const k = STROKE_KEYS[(((i * 3 + depth * 2) % n) + n) % n];
        u.uRingFill.value[i].set(...PALETTE[k], s.fillA);
      });
    }

    // rings drift around the sphere; more rings appear with complexity
    const visible = Math.round(1 + mood.complexity * (RING_COUNT - 1));
    RING_SEEDS.forEach((s, i) => {
      tmpV.copy(s.dir).applyAxisAngle(s.axis, c.t * s.speed);
      const pulse = 1 + mood.audio.low * 0.06;
      u.uRings.value[i].set(tmpV.x, tmpV.y, tmpV.z, i < visible ? s.radius * pulse : 0);
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
